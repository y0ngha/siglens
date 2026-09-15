/**
 * Pre-warm submits have no user-chosen model (SEO pre-warm runs without a
 * request context), so the DeepSeek→Gemini fallback introduced in core 1.7.0
 * is always safe to opt into: there is no user preference to override.
 */
export const PREWARM_PROVIDER_FALLBACK = true;
