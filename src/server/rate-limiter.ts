// @ts-nocheck

import { log } from "@/util";

class TokenBucket {
    /**
     * @param {object} config Token bucket configuration.
     */
    constructor(config) {
        this.tokensPerInterval = config.tokensPerInterval;
        this.intervalMs = config.interval === "minute" ? 60_000 : Number(config.interval) || 60_000;
        this.tokens = config.fireImmediately ? this.tokensPerInterval : 0;
        this.lastRefill = Date.now();
    }

    /**
     * Refill tokens based on elapsed time.
     * @returns {void}
     */
    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        if (elapsed <= 0) {
            return;
        }

        const tokensToAdd = (elapsed / this.intervalMs) * this.tokensPerInterval;
        this.tokens = Math.min(this.tokensPerInterval, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    /**
     * Remove tokens from the bucket.
     * @param {number} count Number of tokens to remove.
     * @returns {number} Remaining tokens.
     */
    removeTokens(count = 1) {
        this.refill();
        this.tokens -= count;
        return this.tokens;
    }
}

class KumaRateLimiter {
    /**
     * @param {object} config Rate limiter configuration object
     */
    constructor(config) {
        this.errorMessage = config.errorMessage;
        this.rateLimiter = new TokenBucket(config);
    }

    /**
     * Callback for pass
     * @callback passCB
     * @param {object} err Too many requests
     */

    /**
     * Should the request be passed through
     * @param {passCB} callback Callback function to call with decision
     * @param {number} num Number of tokens to remove
     * @returns {Promise<boolean>} Should the request be allowed?
     */
    async pass(callback, num = 1) {
        const remainingRequests = await this.removeTokens(num);
        log.info("rate-limit", "remaining requests: " + remainingRequests);
        if (remainingRequests < 0) {
            if (callback) {
                callback({
                    ok: false,
                    msg: this.errorMessage,
                });
            }
            return false;
        }
        return true;
    }

    /**
     * Remove a given number of tokens
     * @param {number} num Number of tokens to remove
     * @returns {Promise<number>} Number of remaining tokens
     */
    async removeTokens(num = 1) {
        return this.rateLimiter.removeTokens(num);
    }
}

const loginRateLimiter = new KumaRateLimiter({
    tokensPerInterval: 20,
    interval: "minute",
    fireImmediately: true,
    errorMessage: "Too frequently, try again later.",
});

const apiRateLimiter = new KumaRateLimiter({
    tokensPerInterval: 60,
    interval: "minute",
    fireImmediately: true,
    errorMessage: "Too frequently, try again later.",
});

const twoFaRateLimiter = new KumaRateLimiter({
    tokensPerInterval: 30,
    interval: "minute",
    fireImmediately: true,
    errorMessage: "Too frequently, try again later.",
});

export { TokenBucket, KumaRateLimiter, loginRateLimiter, apiRateLimiter, twoFaRateLimiter };
