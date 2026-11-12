// Custom server: serves the Next.js app, mints Simli session tokens and runs the
// voice pipeline (Deepgram -> OpenAI -> ElevenLabs) over a WebSocket on the same
// origin. All provider keys stay in this process.
import { loadEnvConfig } from "@next/env";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import next from "next";
import { generateSimliSessionToken } from "simli-client";
import { WebSocketServer } from "ws";
import { loadConfig, type Config } from "./server/config";
import { Conversation } from "./server/conversation";
import { errMsg, installProcessHandlers, registerSecrets } from "./server/log";
import { clientKey, isAllowedOrigin, RateLimiter, SlotPool, TicketStore } from "./server/security";
import { SECURITY_HEADERS } from "./server/securityHeaders";

const dev = process.env.NODE_ENV !== "production";
// Same .env loading rules as `next dev` / `next start` (.env, .env.local, ...).
loadEnvConfig(process.cwd(), dev, { info: () => {}, error: (...a: unknown[]) => console.error(...a.map(errMsg)) });

const { config, errors, warnings } = loadConfig();
registerSecrets([config.simli.apiKey, config.deepgram.apiKey, config.openai.apiKey, config.elevenlabs.apiKey]);
installProcessHandlers();
for (const w of warnings) console.warn(`[config] warning: ${w}`);
if (errors.length) {
  console.error(
    "\n[config] Can't start: fix these in .env (see .env.example), then run the command again.\n" +
      errors.map((e) => `  - ${e}`).join("\n") +
      "\n",
  );
  process.exit(1);
}

const MAX_WS_MESSAGE_BYTES = 64 * 1024; // mic frames are ~3.2 KB
const tickets = new TicketStore(60_000);
const slots = new SlotPool(config.maxConcurrentSessions, config.maxSessionsPerClient);
const sessionLimiter = new RateLimiter(5, 5); // bursts of 5, then 5 per minute, per client

function sendJson(res: ServerResponse, status: number, body: object) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/**
 * POST /api/session: mints a short-lived Simli session token (the API key never
 * leaves the server) plus a one-time ticket for the conversation WebSocket.
 * The token can start a Simli session on its own, so a concurrency slot is
 * reserved here, not when the WebSocket opens.
 */
async function handleSessionRequest(req: IncomingMessage, res: ServerResponse, cfg: Config) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!isAllowedOrigin(req, cfg.allowedOrigins)) return sendJson(res, 403, { error: "Origin not allowed" });

  // TODO before deploying: check the signed-in user here (session cookie, JWT, ...)
  // and return 401 if there is none. Anyone who can call this endpoint can spend
  // your Simli minutes and provider credits. Until then, production refuses:
  if (!cfg.dev && !cfg.allowUnauthenticatedSessions) {
    return sendJson(res, 403, {
      error:
        "Sessions are disabled in production until you add authentication (see the TODO in server.ts). " +
        "For a private test you can set ALLOW_UNAUTHENTICATED_SESSIONS=true.",
    });
  }

  const key = clientKey(req);
  if (!sessionLimiter.allow(key)) return sendJson(res, 429, { error: "Too many sessions. Try again in a minute." });
  const slot = slots.reserve(key);
  if (slot === "busy") return sendJson(res, 503, { error: "The server is busy. Try again later." });
  if (slot === "per-client") {
    return sendJson(res, 429, { error: "Too many sessions open from your network. End one and try again." });
  }
  req.resume(); // the body isn't used

  try {
    const { session_token, warnings } = await generateSimliSessionToken({
      apiKey: cfg.simli.apiKey,
      config: {
        faceId: cfg.simli.faceId,
        maxSessionLength: cfg.simli.maxSessionLength,
        maxIdleTime: cfg.simli.maxIdleTime,
        // TTS audio arrives in bursts via sendAudioData: let Simli fill the gaps.
        handleSilence: true,
        // 16:9 (Trinity-2's full frame), to match the player in app/components/VideoBox.tsx.
        // For a square layout use 768 x 768 and change the player to aspect-square.
        streaming_width: 1366,
        streaming_height: 768,
      },
    });
    if (warnings?.length) console.warn("[simli] token warnings:", warnings.map(errMsg));
    sendJson(res, 200, { sessionToken: session_token, wsTicket: tickets.issue(slot) });
  } catch (err) {
    slot.release();
    // generateSimliSessionToken throws the API's raw response text: log it
    // (sanitized), and only show it to the developer in development.
    const detail = errMsg(err);
    console.error("[simli] token request failed:", detail);
    sendJson(res, 502, {
      error: cfg.dev ? `Simli token request failed: ${detail}` : "Could not start the avatar session. Try again later.",
    });
  }
}

async function main() {
  const app = next({ dev, port: config.port, hostname: config.host ?? "localhost" });
  const handle = app.getRequestHandler();
  await app.prepare();
  // Next.js registers process handlers that print whole error objects; provider
  // errors can carry request headers (API keys), so use our sanitized ones only.
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");
  installProcessHandlers();

  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/api/session") {
      handleSessionRequest(req, res, config).catch((err) => {
        console.error("[session] failed:", errMsg(err));
        if (!res.headersSent) sendJson(res, 500, { error: "Internal error" });
      });
      return;
    }
    void handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_MESSAGE_BYTES });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const reject = (status: string) => {
      socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    };
    // In development, Next.js handles its hot-reload socket (/_next/*) through its
    // own upgrade listener on this server. In production nothing does: reject.
    if (url.pathname.startsWith("/_next/")) {
      if (!dev) reject("404 Not Found");
      return;
    }
    if (url.pathname !== "/ws") return reject("404 Not Found");
    if (!isAllowedOrigin(req, config.allowedOrigins)) return reject("403 Forbidden");
    const slot = tickets.redeem(url.searchParams.get("ticket"));
    if (!slot) return reject("401 Unauthorized");
    // The slot is held until the connection's socket closes, however it ends.
    socket.once("close", slot.release);

    wss.handleUpgrade(req, socket, head, (ws) => {
      const id = Math.random().toString(36).slice(2, 8);
      const log = (msg: string) => console.log(`[conv ${id}] ${msg}`);
      log(`connected (${slots.active} active)`);
      const conversation = new Conversation(ws, config, log, config.logTranscripts);
      ws.once("close", () => {
        slot.release();
        conversation.close();
      });
      conversation.start().catch((err) => {
        log(`failed to start: ${errMsg(err)}`);
        ws.close(1011, "Failed to start");
      });
    });
  });

  const onListening = () => {
    const shown = config.host && config.host !== "0.0.0.0" && config.host !== "::" ? config.host : "localhost";
    console.log(`> Ready on http://${shown}:${config.port} (${dev ? "development" : "production"})`);
  };
  if (config.host) server.listen(config.port, config.host, onListening);
  else server.listen(config.port, onListening);

  const shutdown = () => {
    for (const client of wss.clients) client.close(1001, "Server shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3_000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[server] failed to start:", errMsg(err));
  process.exit(1);
});
