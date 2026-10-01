'use server';

import { isE2E } from '@/shared/api/e2eEnv';

import { ingestEconomicCalendar } from '../api/ingestEconomicCalendar';
import {
    CALENDAR_COUNTRY,
    type CalendarCountry,
    isCalendarCountry,
} from '../lib/economyCalendarConstants';

/**
 * Server Action: 국가별 경제 캘린더를 FMP에서 적재한다. 본문은
 * `ingestEconomicCalendar` — 허브 프리웜 크론이 같은 적재를 방문과 무관하게 돌리므로
 * 한 곳에 둔다. `waitUntil` 안에서 돌도록 설계 — 응답 스트림 비차단. Never throws.
 *
 * @param country - 수집할 국가. 기본값은 미국이라 기존 호출부(`/economy`)가 그대로
 *   동작한다. 한국 라우트는 `'KR'`을 넘긴다 — refresh-flag도 국가별로 갈려 있어
 *   한쪽 인제스션이 다른 쪽을 건너뛰게 만들지 않는다.
 */
export async function ensureEconomicCalendarAction(
    country: CalendarCountry = CALENDAR_COUNTRY
): Promise<void> {
    try {
        if (isE2E()) return;
        // 직렬화를 건너온 공개 인자라 런타임에서 좁힌다 — `isCalendarCountry` JSDoc 참조.
        if (!isCalendarCountry(country)) {
            console.error(
                '[ensureEconomicCalendarAction] unknown country:',
                country
            );
            return;
        }
        await ingestEconomicCalendar(country, 'ensureEconomicCalendarAction');
    } catch (error) {
        console.error('[ensureEconomicCalendarAction]', error);
    }
}
