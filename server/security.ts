import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";

// Basic, in-memory protections for a local demo. They stop other websites from
// using your keys through a visitor's browser and keep one client from hogging
// the server, but they are NOT authentication: anyone who can reach the server
// directly can still start sessions and spend your Simli, Deepgram, OpenAI and
// ElevenLabs credits.
//
// TODO before deploying: require a signed-in user in handleSessionRequest()
// (server.ts) and replace these in-memory limits with your platform's rate
// limiting (they reset on restart and don't work across multiple instances).

export function isAllowedOrigin(req: IncomingMessage, allowed: Set<string>): boolean {
  const origin = req.headers.origin;
  return typeof origin === "string" && allowed.has(origin);
}

export function clientIp(req: IncomingMessage): string {
  // Behind a proxy this is the proxy's address. Use your platform's client-IP
  // header there, and only if the proxy overwrites it.
  return req.socket.remoteAddress ?? "unknown";
}

/** Fixed-window counter: `limit` hits per `windowMs` per key. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }
}

/**
 * One-time tickets: the browser gets one together with its Simli session token
 * and must present it to open the conversation WebSocket. A ticket is valid for
 * 60 seconds and can be used once.
 */
export class TicketStore {
  private tickets = new Map<string, number>();
  constructor(private ttlMs = 60_000) {}

  issue(): string {
    const now = Date.now();
    for (const [t, exp] of this.tickets) if (exp <= now) this.tickets.delete(t);
    const ticket = randomBytes(24).toString("base64url");
    this.tickets.set(ticket, now + this.ttlMs);
    return ticket;
  }

  redeem(ticket: string | null): boolean {
    if (!ticket) return false;
    const exp = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    return exp !== undefined && exp > Date.now();
  }
}
