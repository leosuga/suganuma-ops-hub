// In-memory sliding-window rate limiter for /api/mcp.
// For multi-instance deployments, replace with Redis or a shared store.

interface Bucket {
  count: number
  resetAt: number
  blockedUntil: number
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.MCP_RATE_LIMIT_MAX_REQUESTS ?? "120")
const RATE_LIMIT_BLOCK_DURATION_MS = Number(process.env.MCP_RATE_LIMIT_BLOCK_DURATION_MS ?? "60000")

const buckets = new Map<string, Bucket>()

function now() {
  return Date.now()
}

export function checkMcpRateLimit(clientIp: string): { allowed: boolean; retryAfter: number } {
  const ip = clientIp || "unknown"
  const t = now()
  let bucket = buckets.get(ip)

  if (!bucket || t > bucket.resetAt) {
    bucket = { count: 0, resetAt: t + RATE_LIMIT_WINDOW_MS, blockedUntil: 0 }
    buckets.set(ip, bucket)
  }

  if (t < bucket.blockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((bucket.blockedUntil - t) / 1000) }
  }

  bucket.count += 1

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    bucket.blockedUntil = t + RATE_LIMIT_BLOCK_DURATION_MS
    return { allowed: false, retryAfter: Math.ceil(RATE_LIMIT_BLOCK_DURATION_MS / 1000) }
  }

  return { allowed: true, retryAfter: 0 }
}

// Optional cleanup to prevent memory leaks in long-running container
export function cleanupStaleRateLimitBuckets(maxAgeMs = 5 * 60_000) {
  const t = now()
  for (const [ip, bucket] of buckets.entries()) {
    if (t > bucket.resetAt + maxAgeMs) {
      buckets.delete(ip)
    }
  }
}
