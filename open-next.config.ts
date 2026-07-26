import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext adapter config.
 *
 * Deliberately minimal. Incremental cache, tag cache and queue are all left at
 * their defaults (in-memory / no-op) because every route in this app is
 * server-rendered against the database — there is no ISR surface to cache, so
 * wiring an R2 or KV cache would add moving parts that never get used.
 *
 * If a public, cacheable page is added later, that is the point to configure
 * `incrementalCache` — not before.
 */
export default defineCloudflareConfig();
