/**
 * Explicitly disables extended thinking for per-card translation/classification
 * tasks. Deterministic transformations gain no quality benefit from extended
 * thinking while incurring extra latency and cost.
 */
export const DISABLED_THINKING_BUDGET = 0;

/** LLM card analysis poll interval (ms). */
export const NEWS_CARD_ANALYSIS_POLL_INTERVAL_MS = 2_000;
/**
 * Flash-lite typical wall-clock: <10 s. 30 attempts × 2 s = 60 s ceiling,
 * well within waitUntil's serverless budget.
 */
export const POLL_MAX_ATTEMPTS = 30;
