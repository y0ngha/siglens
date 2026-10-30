import 'server-only';

import type { SiglensDatabase } from '@/shared/db/types';
import { addUtcIsoDays } from '@/shared/lib/isoDate';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import { futureWindowEnd, pastWindowStart } from '../lib/calendarWindow';
import type { CalendarCountry } from '../model';
import { normalizeIndicatorName } from '../lib/indicatorNameKo';

/**
 * 화면 캘린더 창(`pastWindowStart`~`futureWindowEnd`, ET 앵커)에 걸린 이벤트의 지표명
 * base 집합. 번역 크론의 대상 수집과 방문자 번역 요청의 화이트리스트가 같은 창을 쓴다.
 *
 * `pastPaddingDays`는 화이트리스트 전용 여유다 — 방문자 화면은 묵은 렌더일 수 있어
 * 그 창이 서버의 "오늘" 창보다 이를 수 있다(값의 근거는 `isTranslatableCalendarIndicator`의 `WHITELIST_PAST_PADDING_DAYS`).
 */
export async function listCalendarIndicatorBases(
    db: SiglensDatabase,
    country: CalendarCountry,
    anchorEt: string,
    pastPaddingDays = 0
): Promise<ReadonlySet<string>> {
    const events = await new DrizzleEconomicCalendarRepository(db).listInRange(
        addUtcIsoDays(pastWindowStart(anchorEt), -pastPaddingDays),
        futureWindowEnd(anchorEt),
        country
    );
    return new Set(events.map(e => normalizeIndicatorName(e.event).base));
}
