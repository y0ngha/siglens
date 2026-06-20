'use client';

import { useEffect, useRef } from 'react';
import {
    ensureEconomicCalendarAction,
    ensureEconomicEventsAnalyzedAction,
} from '@/entities/economy/actions';

/**
 * Fire-and-forget on mount (봇 포함, 1회):
 * 1. `ensureEconomicCalendarAction` — ±1mo FMP 인제스션(SP-A).
 * 2. `ensureEconomicEventsAnalyzedAction` — 발표된 Medium+ 미분석 이벤트 AI 분석(SP-D).
 *
 * 두 액션은 동시에(fire-and-forget) 실행된다. 이번 방문의 인제스션으로 채워진 actual은
 * 레이스에 따라 다음 방문(또는 refresh-flag 만료 후)에 분석될 수 있다 — eventual consistency.
 * 둘 다 자체 refresh-flag로 쓰로틀되고 에러는 로깅만 한다(응답 비차단).
 */
export function useEconomicCalendarTrigger(): void {
    const triggeredRef = useRef(false);

    useEffect(() => {
        if (triggeredRef.current) return;
        triggeredRef.current = true;
        void ensureEconomicCalendarAction().catch((e: unknown) => {
            console.error(
                '[useEconomicCalendarTrigger] ensureEconomicCalendarAction failed:',
                e
            );
        });
        void ensureEconomicEventsAnalyzedAction().catch((e: unknown) => {
            console.error(
                '[useEconomicCalendarTrigger] ensureEconomicEventsAnalyzedAction failed:',
                e
            );
        });
    }, []);
}
