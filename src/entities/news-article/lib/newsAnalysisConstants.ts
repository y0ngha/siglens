/**
 * Explicitly disables extended thinking for per-card translation/classification
 * tasks. Deterministic transformations gain no quality benefit from extended
 * thinking while incurring extra latency and cost.
 */
export const DISABLED_THINKING_BUDGET = 0;
