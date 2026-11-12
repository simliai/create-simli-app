// Safe logging. Provider SDKs can reject with objects that carry the request
// (including the Authorization header), so never log raw error objects: log
// errMsg(err), which keeps only a message and redacts anything key-like.

const secrets = new Set<string>();

/** Register secret values (API keys) so they are scrubbed from every log line. */
export function registerSecrets(values: string[]) {
  for (const v of values) if (v && v.length >= 6) secrets.add(v);
}

export function redact(text: string): string {
  let s = text;
  for (const v of secrets) s = s.split(v).join("[redacted]");
  return s
    .replace(/\b(Token|Bearer|Basic)\s+[^\s"',;}]+/gi, "$1 [redacted]")
    .replace(/((?:authorization|x-simli-api-key|xi[-_]api[-_]key|api[-_]?key)["']?\s*[:=]\s*["']?)[^\s"',;}]+/gi, "$1[redacted]")
    .replace(/(api key provided:\s*)\S+/gi, "$1[redacted]")
    .replace(/\bsk-[A-Za-z0-9_*-]{6,}/g, "[redacted]");
}

/** A short, redacted description of any thrown value. */
export function errMsg(err: unknown): string {
  let msg: unknown;
  if (typeof err === "string") msg = err;
  else if (err && typeof err === "object") {
    const e = err as { message?: unknown; error?: { message?: unknown }; type?: unknown };
    msg = e.message ?? e.error?.message ?? e.type;
  }
  const text = typeof msg === "string" && msg ? msg : "unknown error";
  return redact(text).slice(0, 300);
}

/** Logs process-level failures without dumping error objects. */
export function installProcessHandlers() {
  process.on("uncaughtException", (err) => console.error("[process] uncaught exception:", errMsg(err)));
  process.on("unhandledRejection", (reason) => console.error("[process] unhandled rejection:", errMsg(reason)));
}
