/**
 * Analysis gate types and runtime guards.
 *
 * These describe siglens-side denial outcomes from the BYOK/tier gate
 * (`resolveTierAndByok` in infrastructure). The types live in the domain
 * layer so consumer hooks can narrow on action results without depending
 * on the infrastructure implementation.
 */

/** Machine-readable codes for siglens-side analysis gate denials. */
export type AnalysisGateErrorCode =
    | 'tier_premium_blocked'
    | 'invalid_model'
    | 'api_key_corrupted'
    | 'unexpected_error';

/** Structured gate error returned from action layer. */
export interface AnalysisGateError {
    code: AnalysisGateErrorCode;
    message: string;
}

/** Gate denial result — mirrors core's `{ status: 'error' }` discriminator. */
export interface AnalysisGateBlockedResult {
    status: 'error';
    error: AnalysisGateError;
}

/**
 * All gate error codes as a runtime array. Used by `isGateBlockedResult`
 * to distinguish gate denials from other `status: 'error'` variants
 * (e.g. SubmitXxxLimitError) which also have an `error.code` field.
 *
 * Keep in sync with {@link AnalysisGateErrorCode}.
 */
export const GATE_ERROR_CODES: readonly AnalysisGateErrorCode[] = [
    'tier_premium_blocked',
    'invalid_model',
    'api_key_corrupted',
    'unexpected_error',
];

/**
 * Type guard distinguishing `AnalysisGateBlockedResult` from sibling
 * `status: 'error'` variants whose `error` is a different shape
 * (e.g. `SubmitFundamentalAnalysisLimitError.error` is `AnalysisLimitError`).
 *
 * The shape check (`'code' in error` + known-codes lookup) catches the
 * gate-specific code values; non-gate `status: 'error'` results have
 * different code namespaces (`'fetch_failed'`, `'no_news'`,
 * `'usage_limit_exceeded'`) and won't match.
 */
export function isGateBlockedResult(result: {
    status: 'error';
    error?: unknown;
}): result is AnalysisGateBlockedResult {
    if (typeof result.error !== 'object' || result.error === null) {
        return false;
    }
    if (!('code' in result.error)) {
        return false;
    }
    // After 'code' in result.error, TS narrows result.error to `object & {code: unknown}`.
    // The array's element type is the literal union AnalysisGateErrorCode, but
    // .includes() on a literal-union array refuses non-literal arguments —
    // widen to readonly string[] for the lookup. Safe: read-only check, no mutation.
    const code = (result.error as { code: unknown }).code;
    return (GATE_ERROR_CODES as readonly string[]).includes(code as string);
}
