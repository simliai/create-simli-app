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
import { clientIp, isAllowedOrigin, RateLimiter, TicketStore } from "./server/security";

const dev = process.env.NODE_ENV !== "production";
// Same .env loading rules as `next dev` / `next start` (.env, .env.local, ...).
loadEnvConfig(process.cwd(), dev);

const { config, errors, warnings } = loadConfig();
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
const tickets = new TicketStore();
const sessionLimiter = new RateLimiter(5, 60_000); // 5 sessions per minute per IP
let activeConversations = 0;

function sendJson(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/**
 * POST /api/session: mints a short-lived Simli session token (the API key never
 * leaves the server) plus a one-time ticket for the conversation WebSocket.
 *
 * TODO before deploying: check the signed-in user here. Anyone who can call this
 * endpoint can spend your Simli minutes and provider credits.
 */
async function handleSessionRequest(req: IncomingMessage, res: ServerResponse, cfg: Config) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!isAllowedOrigin(req, cfg.allowedOrigins)) return sendJson(res, 403, { error: "Origin not allowed" });
  if (!sessionLimiter.allow(clientIp(req))) return sendJson(res, 429, { error: "Too many sessions. Try again in a minute." });
  if (activeConversations >= cfg.maxConcurrentSessions) {
    return sendJson(res, 503, { error: "The server is busy (MAX_CONCURRENT_SESSIONS reached). Try again later." });
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
        // Square, to match the square video box in the UI (app/components/VideoBox.tsx).
        // For a 16:9 layout use 1366 x 768 and change the box's aspect ratio to match.
        streaming_width: 768,
        streaming_height: 768,
      },
    });
    if (warnings?.length) console.warn("[simli] token warnings:", warnings);
    sendJson(res, 200, { sessionToken: session_token, wsTicket: tickets.issue() });
  } catch (err) {
    // generateSimliSessionToken throws the API's response body (no key in it).
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[simli] token request failed:", detail);
    sendJson(res, 502, { error: `Simli token request failed: ${detail}` });
  }
}

async function main() {
  const app = next({ dev, port: config.port, hostname: "localhost" });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/api/session") {
      handleSessionRequest(req, res, config).catch((err) => {
        console.error("[session]", err);
        if (!res.headersSent) sendJson(res, 500, { error: "Internal error" });
      });
      return;
    }
    void handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_MESSAGE_BYTES });

  // Next.js attaches its own upgrade listener (dev HMR on /_next/*) to this server
  // and ignores paths it doesn't own, so only /ws is handled here.
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/_next/")) return;
    const reject = (status: string) => {
      socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
    };
    if (url.pathname !== "/ws") return reject("404 Not Found");
    if (!isAllowedOrigin(req, config.allowedOrigins)) return reject("403 Forbidden");
    if (!tickets.redeem(url.searchParams.get("ticket"))) return reject("401 Unauthorized");
    if (activeConversations >= config.maxConcurrentSessions) return reject("503 Service Unavailable");

    wss.handleUpgrade(req, socket, head, (ws) => {
      activeConversations += 1;
      const id = Math.random().toString(36).slice(2, 8);
      const log = (msg: string, ...rest: unknown[]) => console.log(`[conv ${id}] ${msg}`, ...rest);
      log(`connected (${activeConversations} active)`);
      const conversation = new Conversation(ws, config, log);
      ws.once("close", () => {
        activeConversations -= 1;
        conversation.close();
      });
      conversation.start().catch((err) => {
        log("failed to start:", err);
        ws.close(1011, "Failed to start");
      });
    });
  });

  server.listen(config.port, () => {
    console.log(`> Ready on http://localhost:${config.port} (${dev ? "development" : "production"})`);
  });

  const shutdown = () => {
    for (const client of wss.clients) client.close(1001, "Server shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3_000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
