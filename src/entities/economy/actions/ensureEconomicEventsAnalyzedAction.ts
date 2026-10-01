'use server';

import { isE2E } from '@/shared/api/e2eEnv';

import { analyzeEconomicEvents } from '../api/analyzeEconomicEvents';
import {
    CALENDAR_COUNTRY,
    type CalendarCountry,
    isCalendarCountry,
} from '../lib/economyCalendarConstants';

/**
 * Server Action: 발표된 Medium+ 미분석 이벤트를 AI 분석으로 채운다. 본문은
 * `analyzeEconomicEvents` — 허브 프리웜 크론과 백필 스크립트가 같은 분석을 쓴다.
 * 방문자 경로는 상한을 두지 않는다(예전과 같음). E2E/prerender에서는 즉시 반환(LLM
 * 비용 0). Never throws.
 *
 * @param country - 분석할 국가. 기본값이 미국이라 기존 호출부(`/economy`)는 그대로
 *   동작한다. 국가를 나누는 이유는 `analyzeEconomicEvents` JSDoc 참고.
 */
export async function ensureEconomicEventsAnalyzedAction(
    country: CalendarCountry = CALENDAR_COUNTRY
): Promise<void> {
    try {
        if (isE2E()) return;
        // 직렬화를 건너온 공개 인자라 런타임에서 좁힌다.
        if (!isCalendarCountry(country)) {
            console.error(
                '[ensureEconomicEventsAnalyzedAction] unknown country:',
                country
            );
            return;
        }
        await analyzeEconomicEvents(country, {
            logLabel: 'ensureEconomicEventsAnalyzedAction',
        });
    } catch (error) {
        console.error('[ensureEconomicEventsAnalyzedAction]', error);
    }
}
