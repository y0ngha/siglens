'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import {
    ensureEconomicCalendarAction,
    ensureEconomicEventsAnalyzedAction,
} from '@/entities/economy/actions';
import type { CalendarCountry } from '@/entities/economy';

/**
 * Fire-and-forget on mount (봇 포함, 1회):
 * 1. `ensureEconomicCalendarAction` — ±1mo FMP 인제스션(SP-A).
 * 2. `ensureEconomicEventsAnalyzedAction` — 발표된 Medium+ 미분석 이벤트 AI 분석(SP-D).
 *
 * 두 액션은 동시에(fire-and-forget) 실행된다. 이번 방문의 인제스션으로 채워진 actual은
 * 레이스에 따라 다음 방문(또는 refresh-flag 만료 후)에 분석될 수 있다 — eventual consistency.
 * 둘 다 자체 refresh-flag로 쓰로틀되고 에러는 로깅만 한다(응답 비차단).
 */
export function useEconomicCalendarTrigger(country: CalendarCountry): void {
    const triggeredRef = useRef(false);

    /*
     * `country`를 effect deps에 넣지 않기 위해 `useEffectEvent`로 감싼다.
     *
     * deps에 넣으면 "마운트 1회"라는 계약이 "country가 바뀔 때마다"로 조용히
     * 바뀐다 — 지금은 라우트당 상수라 결과가 같지만, 나중에 지역 전환을 클라
     * 상태로 만들면 전환할 때마다 FMP 인제스션이 돈다. `useEffectEvent`는 항상
     * 최신 값을 읽으면서 effect를 재실행시키지 않는 정확한 도구다(MISTAKES §10).
     */
    const trigger = useEffectEvent(() => {
        void ensureEconomicCalendarAction(country).catch((e: unknown) => {
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
    });

    useEffect(() => {
        if (triggeredRef.current) return;
        triggeredRef.current = true;
        trigger();
    }, []);
}
