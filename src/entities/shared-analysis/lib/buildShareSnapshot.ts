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
    // Safe: JSON round-trip produces a plain object with the same shape as
    // SharedAnalysisSnapshot<K>; the cast narrows the `unknown` parse result
    // back to the typed snapshot without re-running validation.
    return JSON.parse(JSON.stringify(snapshot)) as SharedAnalysisSnapshot<K>;
}
