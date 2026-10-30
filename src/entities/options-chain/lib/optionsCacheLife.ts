import { getEtSessionStatus, isUsTradingDay } from '@y0ngha/siglens-core';

export type OptionsCacheLifeProfile =
    | 'options-market-open'
    | 'options-market-closed'
    | 'options-weekend';

/**
 * 현재 ET 시각으로 캐시 수명 프로파일을 고른다. 프로파일은 `next.config.ts`의 `cacheLife`
 * 맵에 등록돼 있다.
 *
 * - 토·일 **및 NYSE 휴장일** → `options-weekend`
 * - 거래일 09:30–16:00 ET(반장은 13:00, 종료 시각 제외) → `options-market-open`
 * - 거래일 장외 시간(종가 종소리 순간 포함) → `options-market-closed`
 *
 * 이름은 "weekend"지만 조건은 "오늘 세션이 아예 없음"이다. 휴장일은 토요일과 같은 상황이라
 * — Yahoo가 다음 개장 전까지 새 옵션 스냅샷을 내지 않는다 — 30분짜리 `options-market-closed`
 * TTL로는 같은 데이터를 하루에 ~48번 다시 받을 뿐이고, 그 TTL은 Redis TTL
 * (`optionsDataCache`)이기도 하다. 이름은 `next.config.ts`에 등록된 `cacheLife` 프로파일 키라
 * 그대로 둔다.
 */
export function getOptionsCacheLifeProfile(
    now: Date = new Date()
): OptionsCacheLifeProfile {
    if (!isUsTradingDay(now)) return 'options-weekend';
    const status = getEtSessionStatus(now);
    return status === 'open' ? 'options-market-open' : 'options-market-closed';
}
