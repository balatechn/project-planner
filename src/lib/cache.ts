import { redis } from "@/lib/redis";

// ------------------------------------------------------------------
// Tiny Redis JSON cache with graceful fallback. If Redis is not
// configured or errors, `cached()` simply runs the loader directly —
// the app keeps working, just without the cache layer.
// ------------------------------------------------------------------

/**
 * Return a cached value or compute + store it.
 * @param key     cache key (namespace your keys, e.g. `dash:user:<id>`)
 * @param ttlSec  time-to-live in seconds
 * @param loader  async function that produces the value on a miss
 */
export async function cached<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (!redis) return loader();

  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // cache read failed — fall through to loader
  }

  const value = await loader();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    // cache write failed — value is still returned
  }
  return value;
}

/** Invalidate one or more cache keys (best-effort). */
export async function invalidate(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // ignore
  }
}
