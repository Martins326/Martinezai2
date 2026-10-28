export interface FixedWindowRateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-process fixed-window limiter for single-instance deployments.
 * Use a shared store (such as Redis) if the application is scaled horizontally.
 */
export function createFixedWindowRateLimiter({
  limit,
  windowMs,
}: FixedWindowRateLimitOptions) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(
      "Rate-limit limit must be a positive integer.",
    );
  }

  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error(
      "Rate-limit window must be a positive duration.",
    );
  }

  const buckets = new Map<string, Bucket>();
  let callsSinceCleanup = 0;

  return function checkRateLimit(
    key: string,
    now = Date.now(),
  ): RateLimitDecision {
    if (!key) {
      throw new Error(
        "A non-empty rate-limit key is required.",
      );
    }

    callsSinceCleanup += 1;

    if (callsSinceCleanup >= 100 || buckets.size > 5_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }

      callsSinceCleanup = 0;
    }

    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + windowMs,
      };

      buckets.set(key, bucket);
    }

    if (bucket.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1000),
        ),
      };
    }

    bucket.count += 1;

    return {
      allowed: true,
      remaining: Math.max(
        0,
        limit - bucket.count,
      ),
      retryAfterSeconds: 0,
    };
  };
}