import { redis } from "@/lib/redis";
import { rateLimit as memoryRateLimit } from "@/lib/rate-limit";

// ------------------------------------------------------------------
// Distributed rate limiter for API route handlers (Node runtime).
// Uses a Redis INCR + EXPIRE sliding window so limits hold across
// multiple app instances. Falls back to the in-memory limiter when
// Redis is unavailable. (The edge middleware keeps using the pure
// in-memory limiter, since ioredis can't run in the edge runtime.)
// ------------------------------------------------------------------

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number; remaining: number }> {
  if (!redis) {
    const r = memoryRateLimit(key, limit, windowMs);
    return { ...r, remaining: r.allowed ? limit : 0 };
  }

  const redisKey = `rl:${key}`;
  const ttl = Math.ceil(windowMs / 1000);

  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, ttl);
    }
    if (count > limit) {
      const pttl = await redis.pttl(redisKey);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((pttl > 0 ? pttl : windowMs) / 1000)),
        remaining: 0,
      };
    }
    return { allowed: true, retryAfterSeconds: 0, remaining: limit - count };
  } catch {
    // Redis hiccup — fail open via the in-memory limiter
    const r = memoryRateLimit(key, limit, windowMs);
    return { ...r, remaining: r.allowed ? limit : 0 };
  }
}

/** Client identifier from request headers (IP-based). */
export function clientKeyFromRequest(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}
