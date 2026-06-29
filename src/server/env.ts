// @ts-nocheck
"use strict";

/**
 * Bun loads .env into Bun.env/process.env before this entrypoint runs.
 * Keep this hook so older server imports do not need to know about that detail.
 */
function loadEnv() {}

export { loadEnv };
