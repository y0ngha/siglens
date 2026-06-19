'use client';

import { useEffect, useRef } from 'react';
import { ensureEconomicCalendarAction } from '@/entities/economy/actions';

/**
 * Fire-and-forget: `ensureEconomicCalendarAction()`를 마운트 시 1회 호출한다(봇 포함).
 * 에러는 로깅만 — 실패해도 소비자는 반응할 필요가 없다(다음 접속 또는 다음 refresh-flag
 * 만료 시 재시도). market-news `useMarketNewsAnalysisTrigger` 패턴 미러.
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
    }, []);
}
