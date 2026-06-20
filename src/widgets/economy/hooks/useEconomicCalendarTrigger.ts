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
 * 인제스션 직후 분석을 트리거해 같은 방문에서 새로 채워진 actual을 분석한다. 둘 다 자체
 * refresh-flag로 쓰로틀되고 에러는 로깅만 — 실패해도 다음 접속/플래그 만료 시 재시도된다.
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
