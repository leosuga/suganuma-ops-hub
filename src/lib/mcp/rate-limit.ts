// In-memory sliding-window rate limiter.
// For multi-instance deployments, replace with Redis or a shared store.

interface Bucket {
  count: number
  resetAt: number
  blockedUntil: number
}

interface LimitConfig {
  windowMs: number
  maxRequests: number
  blockMs: number
}

const NAMESPACES: Record<string, LimitConfig> = {
  mcp: {
    windowMs: 60_000,
    maxRequests: Number(process.env.MCP_RATE_LIMIT_MAX_REQUESTS ?? "120"),
    blockMs: Number(process.env.MCP_RATE_LIMIT_BLOCK_DURATION_MS ?? "60000"),
  },
  agent: {
    windowMs: 60_000,
    maxRequests: Number(process.env.AGENT_RATE_LIMIT_MAX_REQUESTS ?? "60"),
    blockMs: Number(process.env.AGENT_RATE_LIMIT_BLOCK_DURATION_MS ?? "60000"),
  },
}

const buckets = new Map<string, Bucket>()

function now() {
  return Date.now()
}

function check(namespace: string, clientIp: string): { allowed: boolean; retryAfter: number } {
  const config = NAMESPACES[namespace]
  if (!config) throw new Error(`Unknown rate-limit namespace: ${namespace}`)

  const ip = clientIp || "unknown"
  const key = `${namespace}:${ip}`
  const t = now()
  let bucket = buckets.get(key)

  if (!bucket || t > bucket.resetAt) {
    bucket = { count: 0, resetAt: t + config.windowMs, blockedUntil: 0 }
    buckets.set(key, bucket)
  }

  if (t < bucket.blockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((bucket.blockedUntil - t) / 1000) }
  }

  bucket.count += 1

  if (bucket.count > config.maxRequests) {
    bucket.blockedUntil = t + config.blockMs
    return { allowed: false, retryAfter: Math.ceil(config.blockMs / 1000) }
  }

  return { allowed: true, retryAfter: 0 }
}

export function checkMcpRateLimit(clientIp: string): { allowed: boolean; retryAfter: number } {
  return check("mcp", clientIp)
}

export function checkAgentRateLimit(clientIp: string): { allowed: boolean; retryAfter: number } {
  return check("agent", clientIp)
}

export function cleanupStaleRateLimitBuckets(maxAgeMs = 5 * 60_000) {
  const t = now()
  for (const [key, bucket] of buckets.entries()) {
    if (t > bucket.resetAt + maxAgeMs) {
      buckets.delete(key)
    }
  }
}