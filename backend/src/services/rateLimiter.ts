import type { Redis } from "ioredis";
import { env } from "../config/env";

/**
 * Fixed-hour-window counter, keyed by sender + calendar hour (UTC), stored in Redis.
 *
 * Why Redis and not an in-memory counter: the worker can (and in production should) run
 * as multiple processes/instances. An in-memory counter is per-process and would let each
 * instance send up to the limit independently, blowing the real limit past
 * MAX_EMAILS_PER_HOUR_PER_SENDER. A single shared Redis counter, incremented atomically,
 * gives one true count no matter how many worker processes are running.
 *
 * Atomicity: INCR is O(1) and atomic in Redis. We set an expiry only on the first
 * increment (checked via the INCR return value == 1) so the key self-cleans ~1h after the
 * window closes, with no separate cron/sweep needed.
 */
export class SenderHourlyRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly limitPerSender: number = env.MAX_EMAILS_PER_HOUR_PER_SENDER,
  ) {}

  private windowKey(senderId: string, at: Date = new Date()): string {
    // Truncate to the current UTC hour so every send in the same clock hour shares a key.
    const hourBucket = new Date(at);
    hourBucket.setUTCMinutes(0, 0, 0);
    return `ratelimit:sender:${senderId}:${hourBucket.getTime()}`;
  }

  /**
   * Atomically reserve one send slot for this sender in the current hour window.
   * `limitOverride` lets a caller apply a per-campaign `hourlyLimitPerSender` instead of
   * the global `MAX_EMAILS_PER_HOUR_PER_SENDER` default.
   * Returns { allowed: true } if under the limit (and the slot is now consumed), or
   * { allowed: false } if the sender is at capacity for this hour — the caller must NOT
   * send, and should re-enqueue the job for the next window instead.
   */
  async tryReserveSlot(
    senderId: string,
    limitOverride?: number,
  ): Promise<{ allowed: boolean; count: number }> {
    const limit = limitOverride ?? this.limitPerSender;
    const key = this.windowKey(senderId);

    const count = await this.redis.incr(key);
    if (count === 1) {
      // First send in this window — arm the expiry (70 min covers clock skew at the edges).
      await this.redis.expire(key, 70 * 60);
    }

    if (count > limit) {
      // We already incremented past the limit; release the over-count back so the number
      // stays meaningful for observability instead of climbing unbounded.
      await this.redis.decr(key);
      return { allowed: false, count: count - 1 };
    }

    return { allowed: true, count };
  }

  async getCurrentCount(senderId: string): Promise<number> {
    const value = await this.redis.get(this.windowKey(senderId));
    return value ? parseInt(value, 10) : 0;
  }
}
