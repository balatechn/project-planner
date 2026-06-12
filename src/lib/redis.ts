import Redis from "ioredis";

// ------------------------------------------------------------------
// Shared Redis client (Node runtime only — never import into edge
// middleware). Lazily connects from REDIS_URL. When REDIS_URL is unset
// the helpers degrade gracefully so the app still runs without Redis.
// ------------------------------------------------------------------

const globalForRedis = globalThis as unknown as { redis: Redis | null };

function createClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  client.on("error", (e) => {
    // Don't crash the app on transient Redis errors; just log once in a while
    if (process.env.NODE_ENV !== "production") console.warn("[redis]", e.message);
  });
  return client;
}

export const redis: Redis | null =
  globalForRedis.redis ?? (globalForRedis.redis = createClient());

export function isRedisEnabled(): boolean {
  return redis !== null;
}
