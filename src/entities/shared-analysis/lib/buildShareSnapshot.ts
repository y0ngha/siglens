import type {
    CreateShareInput,
    SharedAnalysisSnapshot,
    ShareableKind,
} from '../types';

/**
 * 클라 입력을 DB 저장용 스냅샷으로 변환한다.
 * JSON.stringify→parse 라운드트립으로 Date/undefined/함수를 제거해 jsonb 직렬화 안전성을 보장한다.
 *
 * `chartBars` is forwarded as-is from the input (already capped to MAX_CHART_BARS
 * by `isValidShareInput`). It is omitted from the snapshot when not provided so the
 * jsonb column stays compact for non-chart kinds.
 */
export function buildShareSnapshot<K extends ShareableKind>(
    input: CreateShareInput<K>
): SharedAnalysisSnapshot<K> {
    const snapshot: SharedAnalysisSnapshot<K> = {
        kind: input.kind,
        symbol: input.symbol.toUpperCase(),
        context: { ...input.context, symbol: input.symbol.toUpperCase() },
        result: input.result,
        ...(input.chartBars !== undefined && { chartBars: input.chartBars }),
    };
    // Safe: JSON.stringify → JSON.parse produces a JSON-safe plain object (no
    // Date instances, undefined fields are dropped, functions are stripped).
    // Non-finite numbers (NaN/Infinity) become null via JSON round-trip:
    //   - chartBars price fields: finite-validated by isValidShareInput, so no
    //     NaN/Infinity reaches here for bar numbers.
    //   - result interior numbers: NOT finite-checked by isValidShareInput, so
    //     NaN/Infinity inside result fields will silently become null. This is
    //     acceptable — jsonb storage requires JSON-safe values, and the display
    //     layer already handles null gracefully.
    // The cast narrows the `unknown` parse result back to the typed snapshot
    // without re-running validation.
    return JSON.parse(JSON.stringify(snapshot)) as SharedAnalysisSnapshot<K>;
}
