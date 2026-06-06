'use client';

import { useCallback, useMemo, useState } from 'react';
import { FIRST_INDICATOR_PANE_INDEX, INACTIVE_PANE_INDEX } from '../constants';
import {
    INDICATOR_REGISTRY,
    type IndicatorKey,
} from '../model/indicatorRegistry';
import type { PaneIndices } from '../types';

type VisibilityState = Record<IndicatorKey, boolean>;

interface UseIndicatorVisibilityReturn {
    visible: VisibilityState;
    toggle: (key: IndicatorKey) => void;
    paneIndices: PaneIndices;
}

function initialVisibility(): VisibilityState {
    // INDICATOR_REGISTRY 전체 키(18개)를 채우므로 Record<IndicatorKey, boolean>가
    // 런타임에 완전히 충족된다 — 안전한 캐스트.
    return Object.fromEntries(
        INDICATOR_REGISTRY.map(m => [m.key, false])
    ) as VisibilityState;
}

export function useIndicatorVisibility(): UseIndicatorVisibilityReturn {
    const [visible, setVisible] = useState<VisibilityState>(initialVisibility);

    const toggle = useCallback((key: IndicatorKey) => {
        setVisible(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // 활성 pane에 등록 순서대로 1,2,3… 배정, 비활성 pane과 모든 overlay 키는
    // INACTIVE_PANE_INDEX. INDICATOR_REGISTRY 전체 키(18개)를 채우므로
    // Record<IndicatorKey, number>가 런타임에 완전히 충족된다 — 안전한 캐스트.
    const paneIndices: PaneIndices = useMemo(() => {
        let next = FIRST_INDICATOR_PANE_INDEX;
        return Object.fromEntries(
            INDICATOR_REGISTRY.map(m => [
                m.key,
                m.kind === 'pane' && visible[m.key]
                    ? next++
                    : INACTIVE_PANE_INDEX,
            ])
        ) as PaneIndices;
    }, [visible]);

    return { visible, toggle, paneIndices };
}
