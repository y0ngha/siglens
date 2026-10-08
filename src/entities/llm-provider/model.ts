import type { CallAiProviderOptions } from '@y0ngha/siglens-core';

/**
 * Options handed to a concrete provider adapter after key resolution.
 *
 * siglens-core's `CallAiProviderOptions` carries **two** mutually exclusive key
 * fields (`userApiKey` for BYOK, `serverApiKey` for server-paid calls) and
 * leaves the choice to the adapter. Adapters must not make that choice: a
 * single adapter reading the wrong field silently bills the wrong party — the
 * SDKs fall back to `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` env vars when handed
 * `undefined`, so a BYOK call would quietly charge the server's analysis key.
 *
 * `callAiProviderRouter` resolves the pair into this single non-optional
 * `apiKey` once, so an adapter has no wrong field left to read.
 */
export interface ProviderCallOptions extends Omit<
    CallAiProviderOptions,
    'userApiKey' | 'serverApiKey'
> {
    /** Effective key for this call — BYOK key when present, server key otherwise. */
    apiKey: string;
    /**
     * Label identifying the calling surface in `[Usage]` telemetry. Defaults to
     * `CHAT_JOB_ID` when omitted, which is what router-dispatched chat calls
     * want; direct adapter callers (e.g. the Korean translator) pass their own.
     */
    jobId?: string;
    /** Optional per-call caps. Omitted → each adapter's previous defaults. */
    limits?: ProviderCallLimits;
}

/**
 * Per-call caps for callers that know their output is short and that a hung call
 * should not be billed repeatedly.
 *
 * Without these, every adapter falls back to the model spec's `maxOutputTokens`
 * (393,216 for DeepSeek) and the SDK's transport defaults (OpenAI/Anthropic: 10-minute
 * timeout × 3 attempts). That is right for the chatbot, whose answers are long and
 * whose stream has its own abort, but a one-paragraph rewrite that hangs can then be
 * billed up to three times in the background after its caller has already given up.
 *
 * Every field is optional and independent — an omitted field keeps the adapter's old
 * behaviour, so existing callers are unchanged.
 */
export interface ProviderCallLimits {
    /** Output-token ceiling. Clamped to the spec's own maximum, never raised above it. */
    readonly maxOutputTokens?: number;
    /**
     * Whole-call deadline (ms) including the response body. Every adapter enforces it
     * via `createCallDeadline`: on expiry the request is aborted and the call rejects
     * with `ProviderCallTimeoutError`. The SDK's own `timeout` only covers response headers.
     */
    readonly timeoutMs?: number;
    /** SDK-level retries after the first attempt. `0` disables them. */
    readonly maxRetries?: number;
}
