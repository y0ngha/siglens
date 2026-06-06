'use client';

import { useCallback, useMemo, useState } from 'react';
import { FIRST_INDICATOR_PANE_INDEX, INACTIVE_PANE_INDEX } from '../constants';
import {
    INDICATOR_REGISTRY,
    type IndicatorKey,
} from '../model/indicatorRegistry';
import type { PaneIndices } from '../types';

// visible은 INDICATOR_REGISTRY 전체(18키)를 담는다 — Record<IndicatorKey,boolean> 캐스트를
// 런타임에 완전히 충족시키기 위함이다. overlay 키(ma·bollinger 등)는 별도 훅
// (useMAOverlay·useBollingerOverlay 등)이 관리하므로 여기선 항상 false이며 pane 토글에만 쓰인다.
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
    // INACTIVE_PANE_INDEX.
    const paneIndices: PaneIndices = useMemo(() => {
        // 활성 pane만 등록 순서로 추려 1,2,3… 위치를 부여한다(순수 — 가변 카운터 없음).
        const activePaneKeys = INDICATOR_REGISTRY.filter(
            m => m.kind === 'pane' && visible[m.key]
        ).map(m => m.key);
        // INDICATOR_REGISTRY 전체 키(18개)를 채우므로 Record<IndicatorKey, number>가
        // 런타임에 완전히 충족된다 — 안전한 캐스트.
        return Object.fromEntries(
            INDICATOR_REGISTRY.map(m => {
                const pos = activePaneKeys.indexOf(m.key);
                return [
                    m.key,
                    pos === -1
                        ? INACTIVE_PANE_INDEX
                        : FIRST_INDICATOR_PANE_INDEX + pos,
                ];
            })
        ) as PaneIndices;
    }, [visible]);

    return { visible, toggle, paneIndices };
}
