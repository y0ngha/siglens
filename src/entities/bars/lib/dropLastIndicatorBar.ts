import type { IndicatorResult } from '@y0ngha/siglens-core';
import { isRecord } from './isRecord';

/** 값의 모양에 따라 마지막 봉 원소를 뗀다. 지표 필드는 세 모양이다(함수 JSDoc 참고). */
function dropLastBar(value: unknown): unknown {
    if (Array.isArray(value)) return value.slice(0, -1);
    if (!isRecord(value)) return value;
    const entries = Object.entries(value);
    const allArrays =
        entries.length > 0 && entries.every(([, v]) => Array.isArray(v));
    if (!allArrays) return value;
    return Object.fromEntries(
        entries.map(([k, v]) => [k, Array.isArray(v) ? v.slice(0, -1) : v])
    );
}

/**
 * `bars`에서 형성 중 봉을 뗄 때, 모든 봉별 지표 배열에서도 마지막 원소를 lockstep으로 뗀다
 * (`quantizeBarsDataToLastClosed`). 전체 구간 스냅샷 필드(volumeProfile, smc)는 건드리지 않는다.
 *
 * 봉별 필드는 세 모양이다:
 *   1. 평면 배열(`rsi`, `macd`, `bollinger` 등) — 바로 `.slice(0, -1)`.
 *   2. 배열의 Record(`ma`, `ema`: `Record<number, (number|null)[]>`) — 값이 전부 배열이므로 각 값 배열을 자른다.
 *   3. 스냅샷 객체(`volumeProfile`: `VolumeProfileResult | null`, `smc`: `SMCResult`) — 값이 전부 배열은
 *      아니므로(예: `smc.premiumZone`은 객체) 그대로 통과시킨다.
 *
 * 구분 기준은 "객체의 값이 **전부 배열**인가"라는 휴리스틱이다. ma/ema는 전부 배열이라 자르고,
 * smc는 premiumZone 등이 객체/null이라 건너뛰며, volumeProfile은 `null`이거나 배열이 아닌 필드를 가진
 * 단일 객체라 건너뛴다.
 *
 * ⚠️ 이 휴리스틱은 스냅샷 필드(volumeProfile, smc)에 배열이 아닌 값이 하나 이상 있다는 전제에 기댄다. core가
 * 값이 전부 배열인 스냅샷(`{ segments: [], zones: [] }` 등)을 추가하면 잘못 잘린다. `@y0ngha/siglens-core`를
 * 올릴 때 `IndicatorResult`에 새로 생긴 필드가 이 경우인지 점검한다.
 */
export function dropLastIndicatorBar(
    indicators: IndicatorResult
): IndicatorResult {
    // 키를 그대로 보존하고 봉별 배열에서 마지막 원소만 떼므로 런타임 모양은 IndicatorResult와 구조적으로 같다.
    return Object.fromEntries(
        Object.entries(indicators).map(([key, value]) => [
            key,
            dropLastBar(value),
        ])
    ) as unknown as IndicatorResult;
}
