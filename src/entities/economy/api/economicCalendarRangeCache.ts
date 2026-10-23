import 'server-only';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { getEconomyProvider } from '@/shared/api/economy/getEconomyProvider';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

import {
    CALENDAR_COUNTRY,
    CALENDAR_COUNTRY_KR,
    type CalendarCountry,
} from '../lib/economyCalendarConstants';

/**
 * 범위 캘린더 캐시 TTL(3시간). 발표 직후 `actual`이 붙고 예상치가 고쳐지므로 하루를 묵히지 않는다.
 * 같은 범위를 묻는 에이전트 호출은 이 동안 FMP를 다시 부르지 않는다.
 */
export const ECONOMIC_CALENDAR_RANGE_TTL_SECONDS = 3 * SECONDS_PER_HOUR;

/** 범위 하나를 읽을 때 함께 나눠 담는 국가들 — 미국·한국이 같은 FMP 응답을 나눠 쓴다. */
const RANGE_COUNTRIES = [CALENDAR_COUNTRY, CALENDAR_COUNTRY_KR] as const;

/**
 * 캐시 키 — 범위가 키라 날짜가 바뀌면 기본 창도 새 키로 넘어간다. v3: 값이 국가별 묶음이 됐다
 * (v1은 미국 배열, v2는 국가별 키였다 — 같은 범위를 국가마다 따로 FMP에서 받았다).
 */
export function buildEconomicCalendarRangeCacheKey(
    from: string,
    to: string
): string {
    return `economy:calendar-range:v3:${from}:${to}`;
}

/**
 * `from`~`to`(YYYY-MM-DD, 양끝 포함)의 국가별 경제 캘린더. SiglensAI `get_economy`가 읽는다.
 *
 * 경제 스냅샷(`getEconomySnapshot`)의 캘린더는 매크로 브리핑용 14일 창이고 최대 약 48h 묵는다.
 * 에이전트는 다음 금리 결정처럼 몇 주 뒤의 날짜와, 사용자가 지정한 기간을 물으므로 범위를
 * 따로 읽는다. FMP는 한 응답에 전 국가를 담으므로 미국·한국을 한 번에 나눠 캐시한다 — 두 국가의
 * 기본 창이 같아 같은 응답을 두 번 받지 않는다.
 *
 * 실패는 그대로 던져 호출부가 degrade를 정한다(빈 배열은 "일정 없음"으로 읽히므로 실패를 빈 배열로
 * 바꾸지 않는다). 원본 행이 하나도 없으면 캐시하지 않는다(SERVER.md#SA-18) — FMP는 장애 때도 200 `[]`를
 * 준다. 원본에 행이 있으면 한 국가가 비어도 그 국가에 일정이 없다는 진짜 결과라 캐시한다.
 */
export async function getEconomicCalendarRange(
    country: CalendarCountry,
    from: string,
    to: string
): Promise<EconomicCalendarEvent[]> {
    const calendars = await getOrSetCache(
        buildEconomicCalendarRangeCacheKey(from, to),
        ECONOMIC_CALENDAR_RANGE_TTL_SECONDS,
        () =>
            getEconomyProvider().getCalendarsByCountry(
                from,
                to,
                RANGE_COUNTRIES
            ),
        result => result.sourceRows > 0
    );
    return calendars.byCountry[country] ?? [];
}
