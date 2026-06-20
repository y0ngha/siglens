'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { ensureIndicatorTranslatedAction } from '@/entities/economy/actions';
import { INDICATOR_NAME_KO, normalizeIndicatorName } from '@/entities/economy';

/**
 * 마운트 시 1회: 서버 render(`resolveIndicatorLabels`)에서 dict·DB 캐시 양쪽 모두 miss한
 * 지표명에 대해 AI 번역을 fire-and-forget으로 트리거한다.
 *
 * 동작 원리:
 * - `labels[event.event]`가 undefined인 raw 이름만 대상(dict or DB hit이면 이미 레이블 존재).
 * - `normalizeIndicatorName`으로 base를 추출해 중복 제거(동월/분기 변형 대응).
 * - 코드 사전(`INDICATOR_NAME_KO`)에 있는 base는 제외(영어 fallback이 렌더된 경우에도 dict
 *   번역은 다음 렌더에서 자동 반영되므로 AI 호출 불필요).
 * - `useEffectEvent`로 최신 props를 읽으면서 `useEffect` dep-array를 비움
 *   (SP-A `useEconomicCalendarTrigger` 패턴 미러 — 훅은 마운트 1회만 실행).
 *
 * SP-A 패턴(`useEconomicCalendarTrigger`) 미러 — 렌더/prerender 스코프에서 고아 프로미스·
 * `revalidateTag`를 실행하는 ISR 부작용을 클라이언트 훅으로 격리한다.
 */
export function useIndicatorTranslationTrigger(
    events: readonly EconomicCalendarEvent[],
    labels: Record<string, string>
): void {
    const triggeredRef = useRef(false);

    const triggerOnce = useEffectEvent((): void => {
        const unresolvedBases = new Set<string>();
        for (const ev of events) {
            if (labels[ev.event] === undefined) {
                const { base } = normalizeIndicatorName(ev.event);
                if (!Object.hasOwn(INDICATOR_NAME_KO, base)) {
                    unresolvedBases.add(base);
                }
            }
        }

        for (const base of unresolvedBases) {
            void ensureIndicatorTranslatedAction(base).catch((e: unknown) => {
                console.error(
                    '[useIndicatorTranslationTrigger] ensureIndicatorTranslatedAction failed:',
                    e
                );
            });
        }
    });

    useEffect(() => {
        if (triggeredRef.current) return;
        triggeredRef.current = true;
        triggerOnce();
    }, []);
}
