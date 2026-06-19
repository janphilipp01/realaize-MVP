import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

interface Window {
  name: string;
  windowMs: number;
  max: number;
}

interface Slot {
  startedAt: number;
  count: number;
}

interface Options {
  // Rate-limit keyed on the authenticated user (preferred). If unauthenticated
  // fall back to IP — useful for a single middleware that protects both
  // public and private routes.
  windows: Window[];
  // Optional namespace so multiple routes don't share the same bucket.
  bucket?: string;
}

const stores = new Map<string, Map<string, Slot[]>>();

function getStore(bucket: string): Map<string, Slot[]> {
  let store = stores.get(bucket);
  if (!store) {
    store = new Map();
    stores.set(bucket, store);
  }
  return store;
}

function getKey(req: Request): string {
  if (req.auth?.authId) return `u:${req.auth.authId}`;
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0]?.trim();
  return `ip:${first || req.ip || req.socket.remoteAddress || "unknown"}`;
}

export function rateLimitByUser(opts: Options) {
  const { windows, bucket = "default" } = opts;
  const store = getStore(bucket);

  // Sweep stale entries every 5 minutes to bound memory.
  setInterval(() => {
    const now = Date.now();
    const longest = windows[windows.length - 1]!.windowMs;
    for (const [key, slots] of store) {
      if (slots.every((s) => now - s.startedAt >= longest)) store.delete(key);
    }
  }, 5 * 60_000).unref?.();

  return function (req: Request, res: Response, next: NextFunction): void {
    const key = getKey(req);
    const now = Date.now();
    let slots = store.get(key);
    if (!slots) {
      slots = windows.map(() => ({ startedAt: now, count: 0 }));
      store.set(key, slots);
    }
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i]!;
      const slot = slots[i]!;
      if (now - slot.startedAt >= w.windowMs) {
        slot.startedAt = now;
        slot.count = 0;
      }
      if (slot.count >= w.max) {
        const retryAfterSec = Math.ceil((w.windowMs - (now - slot.startedAt)) / 1000);
        res.setHeader("Retry-After", String(retryAfterSec));
        logger.warn(
          { key, bucket, window: w.name, retryAfterSec },
          "rate limit exceeded",
        );
        res.status(429).json({
          error: `Rate limit exceeded (per ${w.name}). Try again in ${retryAfterSec}s.`,
        });
        return;
      }
    }
    for (const slot of slots) slot.count += 1;
    next();
  };
}
