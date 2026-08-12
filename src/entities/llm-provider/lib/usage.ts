/**
 * Token-usage telemetry for the chat/translate provider adapters.
 *
 * `@y0ngha/siglens-core` emits an identical `[Usage]` line from its own
 * provider clients, but only on the **analysis** path — chat and translation go
 * through the adapters in this slice, which produced no telemetry at all. That
 * blind spot made a production cost question ("who is burning Opus 5 on our
 * key?") unanswerable from logs: analysis usage was fully attributable while
 * chat usage left no trace.
 *
 * Core's extractors are not part of its public API (and deep imports are
 * banned), so they are mirrored here. The **field names and the `[Usage]` tag
 * are deliberately identical to core's** so a single CloudWatch Logs Insights
 * query aggregates both paths:
 *
 *     filter @message like /\[Usage\]/
 *     | parse @message /"model":"(?<model>[^"]+)"/
 *     | stats count(*) by model
 *
 * If core's shape ever changes, change it here in the same commit.
 */

/**
 * Normalized per-call token counts.
 *
 * The three input buckets are disjoint and sum to the provider's reported total
 * input: `promptTokens + cachedTokens + cacheWriteTokens`.
 *
 * - `promptTokens` — standard-price, non-cached input (1x).
 * - `cachedTokens` — cache **reads**, billed at roughly 0.1x by Anthropic.
 * - `cacheWriteTokens` — cache **writes**, billed at roughly 1.25x. Only Claude
 *   reports this separately; the other providers always report 0. Kept out of
 *   `promptTokens` so the standard-price bucket is not inflated by the write
 *   premium.
 */
export interface NormalizedUsage {
    promptTokens: number;
    cachedTokens: number;
    cacheWriteTokens: number;
    outputTokens: number;
}

const ZERO_USAGE: NormalizedUsage = Object.freeze({
    promptTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
});

/** Anthropic Messages API usage (`@anthropic-ai/sdk` `Message.usage`). */
export interface ClaudeUsageLike {
    input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    output_tokens?: number | null;
}

export function extractClaudeUsage(
    usage: ClaudeUsageLike | undefined | null
): NormalizedUsage {
    if (!usage) return { ...ZERO_USAGE };
    return {
        promptTokens: usage.input_tokens ?? 0,
        cachedTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
    };
}

/** Gemini `GenerateContentResponse.usageMetadata` (`@google/genai`). */
export interface GeminiUsageLike {
    promptTokenCount?: number;
    cachedContentTokenCount?: number;
    candidatesTokenCount?: number;
}

export function extractGeminiUsage(
    usage: GeminiUsageLike | undefined | null
): NormalizedUsage {
    if (!usage) return { ...ZERO_USAGE };
    return {
        promptTokens: Math.max(
            0,
            (usage.promptTokenCount ?? 0) - (usage.cachedContentTokenCount ?? 0)
        ),
        cachedTokens: usage.cachedContentTokenCount ?? 0,
        // Gemini reports no separate cache-write metric.
        cacheWriteTokens: 0,
        outputTokens: usage.candidatesTokenCount ?? 0,
    };
}

/**
 * OpenAI **Responses API** usage (`openai.ts` calls `client.responses.create`).
 *
 * The Responses API reports `input_tokens` / `input_tokens_details.cached_tokens`
 * / `output_tokens` — NOT the Chat Completions names (`prompt_tokens` /
 * `completion_tokens`). Using the latter here would silently extract all zeros.
 */
export interface OpenAIUsageLike {
    input_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens?: number;
}

export function extractOpenAIUsage(
    usage: OpenAIUsageLike | undefined | null
): NormalizedUsage {
    if (!usage) return { ...ZERO_USAGE };
    const cached = usage.input_tokens_details?.cached_tokens ?? 0;
    return {
        promptTokens: Math.max(0, (usage.input_tokens ?? 0) - cached),
        cachedTokens: cached,
        // OpenAI reports no separate cache-write metric.
        cacheWriteTokens: 0,
        outputTokens: usage.output_tokens ?? 0,
    };
}

/**
 * DeepSeek `chat.completions` usage — the classic Chat Completions shape, not
 * the Responses shape above (`deepseek.ts` calls `chat.completions.create`).
 *
 * Cache reads arrive either as DeepSeek's own `prompt_cache_hit_tokens` (where
 * `prompt_tokens = hit + miss`) or the OpenAI-compatible
 * `prompt_tokens_details.cached_tokens`; both are subtracted out of the
 * standard-price bucket.
 */
export interface DeepSeekUsageLike {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
}

export function extractDeepSeekUsage(
    usage: DeepSeekUsageLike | undefined | null
): NormalizedUsage {
    if (!usage) return { ...ZERO_USAGE };
    const cached =
        usage.prompt_cache_hit_tokens ??
        usage.prompt_tokens_details?.cached_tokens ??
        0;
    return {
        promptTokens: Math.max(0, (usage.prompt_tokens ?? 0) - cached),
        cachedTokens: cached,
        // DeepSeek bills cache writes as ordinary misses — no separate metric.
        cacheWriteTokens: 0,
        outputTokens: usage.completion_tokens ?? 0,
    };
}

export interface UsageLogFields extends NormalizedUsage {
    /**
     * Which caller produced the call. `'chat'` for anything dispatched through
     * `callAiProviderRouter`; direct adapter callers pass their own label (e.g.
     * `'translate'`). Core uses `'<SYMBOL>:<jobType>'` on the analysis path, so
     * the three surfaces stay distinguishable in one query.
     */
    jobId: string;
    model: string;
    latencyMs: number;
}

/** Emits the single normalized `[Usage]` telemetry line. */
export function logUsage(fields: UsageLogFields): void {
    console.info('[Usage]', JSON.stringify(fields));
}

/** Default `jobId` for calls dispatched through the provider router. */
export const CHAT_JOB_ID = 'chat';
