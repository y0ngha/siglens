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
 * Marker record forcing compile-time exhaustiveness for {@link GATE_ERROR_CODES}.
 *
 * The `Record<AnalysisGateErrorCode, true>` type ensures every union member
 * appears as a key — adding a new code to `AnalysisGateErrorCode` will fail
 * to compile until added here. The values are unused; only keys are read.
 */
const GATE_ERROR_CODE_KEYS: Record<AnalysisGateErrorCode, true> = {
    tier_premium_blocked: true,
    invalid_model: true,
    api_key_corrupted: true,
    unexpected_error: true,
};

/**
 * All gate error codes as a runtime array. Derived from {@link GATE_ERROR_CODE_KEYS}
 * so the array stays in sync with the {@link AnalysisGateErrorCode} union
 * automatically.
 */
// Object.keys widens to string[], but GATE_ERROR_CODE_KEYS: Record<AnalysisGateErrorCode, true>
// guarantees every union member appears as a key — TS limitation, not a runtime risk.
export const GATE_ERROR_CODES: readonly AnalysisGateErrorCode[] = Object.keys(
    GATE_ERROR_CODE_KEYS
) as AnalysisGateErrorCode[];

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
    // The array's element type is the literal union AnalysisGateErrorCode, but
    // .includes() on a literal-union array refuses non-literal arguments —
    // widen to readonly string[] for the lookup. Safe: read-only check, no mutation.
    // result.error is proven non-null object with 'code' property by the guards above.
    // TypeScript doesn't narrow 'object' + 'in' check to { code: unknown } — TS limitation.
    const code = (result.error as { code: unknown }).code;
    // typeof guard avoids casting unknown to string; non-string code returns false.
    return (
        typeof code === 'string' &&
        (GATE_ERROR_CODES as readonly string[]).includes(code)
    );
}
