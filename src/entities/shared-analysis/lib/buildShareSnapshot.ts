import type {
    CreateShareInput,
    ShareContext,
    SharedAnalysisSnapshot,
    ShareableKind,
} from '../types';

/**
 * 컨텍스트에서 선언된 필드만 옮긴다. 검증(`isValidShareInput`)은 `displayName`·
 * `assetClass` 길이만 제한하므로 알 수 없는 키를 그대로 펼치면 크기 상한 없이
 * jsonb에 저장된다.
 */
function pickContext(context: ShareContext, symbol: string): ShareContext {
    const { displayName, assetClass, analyzedAt } = context;
    return { symbol, displayName, assetClass, analyzedAt };
}

/**
 * 클라 입력을 DB 저장용 스냅샷으로 변환한다. `createShareSnapshotAction`이 검증 뒤에 호출한다.
 *
 * JSON.stringify→parse 라운드트립으로 Date/undefined/함수를 제거해 jsonb 직렬화 안전성을 보장한다.
 * 비유한 숫자(NaN/Infinity)는 null이 된다. `chartBars`의 가격 필드는 `isValidShareInput`이
 * 유한성을 검증하지만 `result` 내부 숫자는 검증하지 않는다 — 분석 응답이 문자열 위주이고
 * 화면이 null을 이미 처리하므로 의도적으로 허용한다.
 *
 * `chartBars`(이미 `MAX_CHART_BARS` 이하로 검증됨)와 `plain`은 입력에 있을 때만 싣는다.
 * 비 chart kind의 jsonb를 작게 유지하기 위해서다.
 */
export function buildShareSnapshot<K extends ShareableKind>(
    input: CreateShareInput<K>
): SharedAnalysisSnapshot<K> {
    const symbol = input.symbol.toUpperCase();
    const snapshot: SharedAnalysisSnapshot<K> = {
        kind: input.kind,
        symbol,
        context: pickContext(input.context, symbol),
        result: input.result,
        ...(input.chartBars !== undefined && { chartBars: input.chartBars }),
        ...(input.plain !== undefined && { plain: input.plain }),
    };
    // 라운드트립 결과는 `unknown`이므로 검증을 다시 돌리지 않고 같은 형태로 좁힌다
    // (방금 JSON-safe로 정규화한 같은 객체다).
    return JSON.parse(JSON.stringify(snapshot)) as SharedAnalysisSnapshot<K>;
}
