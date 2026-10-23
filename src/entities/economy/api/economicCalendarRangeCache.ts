import 'server-only';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { getEconomyProvider } from '@/shared/api/economy/getEconomyProvider';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * 범위 캘린더 캐시 TTL(3시간). 발표 직후 `actual`이 붙고 예상치가 고쳐지므로 하루를 묵히지 않는다.
 * 같은 범위를 묻는 에이전트 호출은 이 동안 FMP를 다시 부르지 않는다.
 */
export const ECONOMIC_CALENDAR_RANGE_TTL_SECONDS = 3 * SECONDS_PER_HOUR;

/** 캐시 키 — 범위 자체가 키라 날짜가 바뀌면 기본 창도 새 키로 넘어간다. */
export function buildEconomicCalendarRangeCacheKey(
    from: string,
    to: string
): string {
    return `economy:calendar-range:v1:${from}:${to}`;
}

/**
 * `from`~`to`(YYYY-MM-DD, 양끝 포함)의 미국 경제 캘린더. SiglensAI `get_economy`가 읽는다.
 *
 * 경제 스냅샷(`getEconomySnapshot`)의 캘린더는 매크로 브리핑용 14일 창이고 최대 약 48h 묵는다.
 * 에이전트는 다음 금리 결정처럼 몇 주 뒤의 날짜와, 사용자가 지정한 기간을 물으므로 범위를
 * 따로 읽는다. 실패는 그대로 던져 호출부가 degrade를 정한다(빈 배열은 "일정 없음"으로 읽히므로
 * 실패를 빈 배열로 바꾸지 않는다).
 *
 * 빈 결과는 캐시하지 않는다. FMP는 장애 때도 200으로 `[]`나 배열이 아닌 본문을 주고, 정규화가
 * 그것을 `[]`로 만든다. 그걸 3시간 굳히면 모든 사용자의 기본 창이 "일정 0건"이 된다. 정말 비어 있는
 * 먼 범위는 매번 다시 읽지만 응답이 작다.
 */
export function getEconomicCalendarRange(
    from: string,
    to: string
): Promise<EconomicCalendarEvent[]> {
    return getOrSetCache(
        buildEconomicCalendarRangeCacheKey(from, to),
        ECONOMIC_CALENDAR_RANGE_TTL_SECONDS,
        () => getEconomyProvider().getCalendar(from, to),
        rows => rows.length > 0
    );
}
