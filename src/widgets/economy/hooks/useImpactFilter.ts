'use client';

/**
 * 경제 캘린더 중요도 필터 상태 훅 — 활성 중요도 집합과 칩 토글.
 */
import { useState } from 'react';
import type { CalendarImpact } from '@y0ngha/siglens-core';

/**
 * 기본으로 켜 두는 영향도. 연간 Low 이벤트가 2,919건으로 대다수라 기본 노출 시 노이즈가
 * 크다(스펙 SP-C). 결정론적 초기값 — 렌더 중 시각/난수 의존 없음(ISR 안전).
 */
const DEFAULT_ACTIVE_IMPACTS: readonly CalendarImpact[] = ['High', 'Medium'];

interface UseImpactFilterReturn {
    activeImpacts: ReadonlySet<CalendarImpact>;
    toggleImpact: (impact: CalendarImpact) => void;
}

/** 활성 중요도 집합(기본 High·Medium)과 칩 하나를 켜고 끄는 토글을 돌려준다. */
export function useImpactFilter(): UseImpactFilterReturn {
    const [activeImpacts, setActiveImpacts] = useState<
        ReadonlySet<CalendarImpact>
    >(() => new Set(DEFAULT_ACTIVE_IMPACTS));

    const toggleImpact = (impact: CalendarImpact): void => {
        setActiveImpacts(prev =>
            prev.has(impact)
                ? new Set([...prev].filter(i => i !== impact))
                : new Set([...prev, impact])
        );
    };

    return { activeImpacts, toggleImpact };
}
