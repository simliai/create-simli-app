// Server-only configuration. Everything here is read from environment variables
// on the server and never sent to the browser.

/** Trinity-2 preset "Anna". Swap for your own face ID from https://app.simli.com. */
export const DEFAULT_SIMLI_FACE_ID = "bf13113a-355a-4d97-8b90-4edccd1da7b2";

// The avatar's persona. Edit these to make the agent your own.
export const SYSTEM_PROMPT = [
  "You are a friendly support agent for Simli, living inside Create Simli App:",
  "the starter project developers use to build real-time talking avatars with Simli.",
  "Your words are spoken aloud by an avatar, so answer in one or two short, natural sentences.",
  "Don't use markdown, lists, emojis or URLs.",
].join(" ");

export const GREETING = "Hi! I'm your Simli avatar. Ask me anything.";

const REQUIRED_KEYS = [
  { name: "SIMLI_API_KEY", where: "https://app.simli.com" },
  { name: "DEEPGRAM_API_KEY", where: "https://console.deepgram.com" },
  { name: "OPENAI_API_KEY", where: "https://platform.openai.com/api-keys" },
  { name: "ELEVENLABS_API_KEY", where: "https://elevenlabs.io/app/settings/api-keys" },
] as const;

export interface Config {
  dev: boolean;
  port: number;
  /** Interface to bind; undefined = all interfaces (Node's default). */
  host: string | undefined;
  allowedOrigins: Set<string>;
  maxConcurrentSessions: number;
  maxSessionsPerClient: number;
  /** Production only: serve /api/session without authentication. */
  allowUnauthenticatedSessions: boolean;
  logTranscripts: boolean;
  simli: { apiKey: string; faceId: string; maxSessionLength: number; maxIdleTime: number };
  deepgram: { apiKey: string; model: string; language: string };
  openai: { apiKey: string; model: string; reasoningEffort: string };
  elevenlabs: { apiKey: string; voiceId: string; modelId: string };
}

function intFromEnv(name: string, fallback: number, errors: string[]): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    errors.push(`${name} must be a positive integer.`);
    return fallback;
  }
  return n;
}

const str = (name: string, fallback = "") => process.env[name]?.trim() || fallback;

/**
 * Reads and validates the environment. Never logs or returns key values in error
 * messages: only variable names.
 */
export function loadConfig(): { config: Config; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const { name, where } of REQUIRED_KEYS) {
    const raw = process.env[name];
    if (!raw || !raw.trim()) {
      errors.push(`${name} is missing. Get one at ${where} and add it to .env`);
    } else if (raw !== raw.trim() || /^["'].*["']$/.test(raw.trim())) {
      warnings.push(`${name} has surrounding whitespace or quotes. Check .env if requests fail with 401.`);
    }
  }

  // Catch the old variable name from earlier versions of this repo.
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("NEXT_PUBLIC_") && /KEY|SECRET|TOKEN/i.test(name)) {
      errors.push(
        `${name} is set. Variables starting with NEXT_PUBLIC_ are bundled into the browser. ` +
          `Remove it, use the server-only name (e.g. SIMLI_API_KEY), and rotate that key: it may have been exposed.`,
      );
    }
  }

  const dev = process.env.NODE_ENV !== "production";
  const port = intFromEnv("PORT", 3000, errors);
  // Development listens on loopback only; production uses the platform's bind.
  const host = str("HOST") || (dev ? "127.0.0.1" : undefined);
  const allowUnauthenticatedSessions = str("ALLOW_UNAUTHENTICATED_SESSIONS") === "true";
  if (!dev && allowUnauthenticatedSessions) {
    warnings.push(
      "ALLOW_UNAUTHENTICATED_SESSIONS=true: anyone who can reach this server can start sessions and spend your credits.",
    );
  }
  const logTranscriptsRaw = str("LOG_TRANSCRIPTS");
  const logTranscripts = logTranscriptsRaw ? logTranscriptsRaw === "1" || logTranscriptsRaw === "true" : dev;

  const originsRaw = str("ALLOWED_ORIGINS");
  const allowedOrigins = new Set(
    originsRaw
      ? originsRaw.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean)
      : [`http://localhost:${port}`, `http://127.0.0.1:${port}`],
  );
  if (!dev && !originsRaw) {
    warnings.push(
      `ALLOWED_ORIGINS is not set, so only http://localhost:${port} may connect. ` +
        `Set it to your site's origin (e.g. https://avatar.example.com) in production.`,
    );
  }

  const faceId = str("SIMLI_FACE_ID", DEFAULT_SIMLI_FACE_ID);
  if (!/^[0-9a-f-]{36}$/i.test(faceId)) {
    warnings.push("SIMLI_FACE_ID doesn't look like a face ID (a UUID). Copy it from https://app.simli.com.");
  }

  const config: Config = {
    dev,
    port,
    host,
    allowedOrigins,
    maxConcurrentSessions: intFromEnv("MAX_CONCURRENT_SESSIONS", 5, errors),
    maxSessionsPerClient: intFromEnv("MAX_SESSIONS_PER_IP", 2, errors),
    allowUnauthenticatedSessions,
    logTranscripts,
    simli: {
      apiKey: str("SIMLI_API_KEY"),
      faceId,
      maxSessionLength: intFromEnv("SIMLI_MAX_SESSION_LENGTH", 600, errors), // seconds
      maxIdleTime: intFromEnv("SIMLI_MAX_IDLE_TIME", 180, errors), // seconds without audio
    },
    deepgram: {
      apiKey: str("DEEPGRAM_API_KEY"),
      model: str("DEEPGRAM_MODEL", "nova-3"),
      language: str("DEEPGRAM_LANGUAGE", "en"),
    },
    openai: {
      apiKey: str("OPENAI_API_KEY"),
      model: str("OPENAI_MODEL", "gpt-6-luna"),
      // "none" keeps replies fast. Set OPENAI_REASONING_EFFORT=off for models without reasoning support.
      reasoningEffort: str("OPENAI_REASONING_EFFORT", "none"),
    },
    elevenlabs: {
      apiKey: str("ELEVENLABS_API_KEY"),
      voiceId: str("ELEVENLABS_VOICE_ID", "cgSgspJ2msm6clMCkdW9"),
      modelId: str("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5"),
    },
  };

  return { config, errors, warnings };
}
