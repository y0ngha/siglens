import type { BarsData, IndicatorResult } from '@y0ngha/siglens-core';
import { isEtRegularSessionOpen } from '@y0ngha/siglens-core';

/**
 * Drops the last per-bar element from every per-bar indicator array in lockstep
 * with the forming bar being stripped from `bars`. Whole-series snapshot fields
 * (volumeProfile, smc) are left untouched.
 *
 * Per-bar fields fall into three shapes:
 *   1. Plain arrays (`rsi`, `macd`, `bollinger`, etc.) — direct `.slice(0, -1)`.
 *   2. Record-of-arrays (`ma`, `ema`: `Record<number, (number|null)[]>`) —
 *      all values are arrays → slice each value array.
 *   3. Snapshot objects (`volumeProfile`: VolumeProfileResult|null, `smc`: SMCResult) —
 *      NOT all values are arrays (e.g. smc.premiumZone is an object, not an array)
 *      → pass through untouched.
 *
 * The "all values are arrays" predicate is the distinguishing heuristic:
 *   - ma/ema entries: every value is `(number|null)[]` → allArrays = true → slice.
 *   - smc: premiumZone/discountZone/equilibriumZone are objects → allArrays = false → skip.
 *   - volumeProfile: it is `null` or a single object with non-array props → skip.
 */
function dropLastIndicatorBar(indicators: IndicatorResult): IndicatorResult {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(indicators)) {
        if (Array.isArray(value)) {
            // Plain per-bar array (rsi, macd, bollinger, dmi, stochastic, …)
            out[key] = value.slice(0, -1);
        } else if (value !== null && typeof value === 'object') {
            // Could be Record<number, array> (ma/ema) or a snapshot object (volumeProfile/smc).
            // Distinguish by checking whether ALL values of this object are arrays.
            const entries = Object.entries(value as Record<string, unknown>);
            const allArrays =
                entries.length > 0 &&
                entries.every(([, v]) => Array.isArray(v));
            out[key] = allArrays
                ? Object.fromEntries(
                      // safe: allArrays(=true) verified Array.isArray(v) for every entry above.
                      entries.map(([k, v]) => [
                          k,
                          (v as unknown[]).slice(0, -1),
                      ])
                  )
                : value;
        } else {
            // null, primitive, undefined — pass through (handles volumeProfile: null)
            out[key] = value;
        }
    }
    // safe: `out` preserves every key of `indicators`, only removing the last element
    // from per-bar arrays — runtime shape is structurally identical to IndicatorResult.
    return out as unknown as IndicatorResult;
}

/**
 * SSR 직렬화 전용: 정규장 중에는 진행 중(forming) 당일 봉을 bars와 indicators 양쪽에서
 * lockstep으로 제외해 SSR 출력이 장 마감 시 하루 1회만 변경되게 한다(ISR write churn 제거).
 *
 * 차트·fear-greed 페이지는 일봉(DEFAULT_TIMEFRAME='1Day') BarsData를 TechnicalFactsSummary와
 * dehydrate seed로 SSR HTML에 박는다. bars Redis TTL이 장중 60초라, 가공 없이 박으면 ISR
 * 재생성마다 forming 봉의 가격과 지표값(RSI/MACD/etc.)이 달라 매번 ISR write가 발생한다
 * (= $25/사이클의 주범). indicators도 per-bar 배열이므로 forming 봉의 마지막 원소를 함께 제거해야
 * buildTechnicalFacts의 lastNonNull(rsi) 등이 완료 봉 기준으로 읽힌다.
 *
 * 정규장 중에는 마지막 일봉이 아직 확정되지 않았으므로(forming) 제외한다 → SSR 출력이
 * 장 마감 시 하루 1회만 변경된다. 장 마감 후·주말·휴일에는 마지막 봉이 이미 완료이므로 보존한다.
 * 클라이언트(useBars/getBarsAction)는 이 함수를 거치지 않으므로 사용자는 라이브 가격을 그대로 본다.
 *
 * volumeProfile / smc은 전체 시리즈 스냅샷이므로 슬라이스 대상에서 제외한다.
 */
export function quantizeBarsDataToLastClosed(
    data: BarsData,
    now: Date
): BarsData {
    if (data.bars.length === 0 || !isEtRegularSessionOpen(now)) return data;
    return {
        ...data,
        bars: data.bars.slice(0, -1),
        indicators: dropLastIndicatorBar(data.indicators),
    };
}
