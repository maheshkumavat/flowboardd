/**
 * In-Memory Sliding-Window Rate Limiter
 * Provides request rate limiting with automatic background memory cleanup.
 */
const rateLimitMap = new Map();

// Periodic cleanup every 5 minutes to sweep expired rate limit keys
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of rateLimitMap.entries()) {
      const valid = timestamps.filter((ts) => ts > now - 300000);
      if (valid.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, valid);
      }
    }
  }, 300000);
}

/**
 * Checks whether an incoming request identifier exceeds rate limits.
 * @param {string} identifier IP address or user ID to rate limit.
 * @param {Object} options Rate limit configuration.
 * @param {number} options.limit Max requests allowed per window (default: 10).
 * @param {number} options.windowMs Window duration in milliseconds (default: 60,000ms / 1 min).
 * @returns {{ success: boolean, remaining: number, resetMs: number }} Rate limit evaluation result.
 */
export function checkRateLimit(identifier, { limit = 10, windowMs = 60000 } = {}) {
  const now = Date.now();
  const key = `${identifier}`;
  const record = rateLimitMap.get(key) || [];

  const validTimestamps = record.filter((ts) => ts > now - windowMs);

  if (validTimestamps.length >= limit) {
    const oldest = validTimestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return { success: false, remaining: 0, resetMs };
  }

  validTimestamps.push(now);
  rateLimitMap.set(key, validTimestamps);

  return { success: true, remaining: limit - validTimestamps.length, resetMs: windowMs };
}

/**
 * Extracts client IP address from request headers.
 * @param {Request} req Next.js / Web Request object.
 * @returns {string} Client IP address.
 */
export function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers?.get?.('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers?.get?.('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

