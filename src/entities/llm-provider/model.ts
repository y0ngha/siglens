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
}
