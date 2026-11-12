import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { isIPv6 } from "node:net";

// Basic, in-memory protections for a local demo. They stop other websites from
// using your keys through a visitor's browser and keep one client from hogging
// the server, but they are NOT authentication: anyone who can reach the server
// directly can still start sessions and spend your Simli, Deepgram, OpenAI and
// ElevenLabs credits. A Simli session token is usable on its own for a whole
// session, so per-user auth is the only real bound.
//
// TODO before deploying: require a signed-in user in handleSessionRequest()
// (server.ts) and replace these in-memory limits with your platform's rate
// limiting (they reset on restart and don't work across multiple instances).

export function isAllowedOrigin(req: IncomingMessage, allowed: Set<string>): boolean {
  const origin = req.headers.origin;
  return typeof origin === "string" && allowed.has(origin);
}

/**
 * The key used for per-client limits: the IPv4 address, or the /64 prefix of an
 * IPv6 address (one user typically controls a whole /64).
 */
export function clientKey(req: IncomingMessage): string {
  // Behind a proxy this is the proxy's address. Use your platform's client-IP
  // header there, and only if the proxy overwrites it.
  let ip = req.socket.remoteAddress ?? "unknown";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7); // IPv4-mapped
  if (!isIPv6(ip)) return ip;
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

/** Token bucket per key: bursts up to `capacity`, refilled at `perMinute`. */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(
    private capacity: number,
    private perMinute: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) if (this.refill(b, now) >= this.capacity) this.buckets.delete(k);
    }
    const b = this.buckets.get(key) ?? { tokens: this.capacity, at: now };
    b.tokens = this.refill(b, now);
    b.at = now;
    this.buckets.set(key, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  private refill(b: { tokens: number; at: number }, now: number) {
    return Math.min(this.capacity, b.tokens + ((now - b.at) / 60_000) * this.perMinute);
  }
}

export interface Slot {
  key: string;
  release: () => void;
}

/**
 * Concurrency slots, global and per client. A slot is taken when a Simli token is
 * issued (the token alone can run a session) and released when its WebSocket
 * closes, or when the ticket expires unused.
 */
export class SlotPool {
  private total = 0;
  private perKey = new Map<string, number>();
  constructor(
    private maxTotal: number,
    private maxPerKey: number,
  ) {}

  /** Returns a slot, or the reason none is free. */
  reserve(key: string): Slot | "busy" | "per-client" {
    if (this.total >= this.maxTotal) return "busy";
    const n = this.perKey.get(key) ?? 0;
    if (n >= this.maxPerKey) return "per-client";
    this.total += 1;
    this.perKey.set(key, n + 1);
    let released = false;
    return {
      key,
      release: () => {
        if (released) return;
        released = true;
        this.total -= 1;
        const left = (this.perKey.get(key) ?? 1) - 1;
        if (left <= 0) this.perKey.delete(key);
        else this.perKey.set(key, left);
      },
    };
  }

  get active() {
    return this.total;
  }
}

/**
 * One-time tickets: the browser gets one together with its Simli session token
 * and must present it to open the conversation WebSocket. A ticket is valid for
 * `ttlMs` and can be used once. It carries the concurrency slot reserved for it.
 */
export class TicketStore {
  private tickets = new Map<string, { slot: Slot; timer: NodeJS.Timeout }>();
  constructor(private ttlMs = 60_000) {}

  issue(slot: Slot): string {
    const ticket = randomBytes(24).toString("base64url");
    const timer = setTimeout(() => {
      this.tickets.delete(ticket);
      slot.release(); // never used: free the slot
    }, this.ttlMs);
    timer.unref();
    this.tickets.set(ticket, { slot, timer });
    return ticket;
  }

  /** Returns the ticket's slot (now owned by the caller), or null if invalid. */
  redeem(ticket: string | null): Slot | null {
    if (!ticket) return null;
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    this.tickets.delete(ticket);
    clearTimeout(entry.timer);
    return entry.slot;
  }
}
