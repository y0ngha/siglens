'use client';

import { useCallback, useMemo, useState } from 'react';
import { FIRST_INDICATOR_PANE_INDEX, INACTIVE_PANE_INDEX } from '../constants';
import {
    INDICATOR_REGISTRY,
    type IndicatorKey,
} from '../model/indicatorRegistry';
import type { PaneIndices } from '../types';

// 레지스트리에서 pane 지표 키를 등록 순서대로 도출 (paneIndex 배정 순서의 기준).
const PANE_KEYS: readonly IndicatorKey[] = INDICATOR_REGISTRY.filter(
    m => m.kind === 'pane'
).map(m => m.key);

type VisibilityState = Record<IndicatorKey, boolean>;

interface UseIndicatorVisibilityReturn {
    visible: VisibilityState;
    toggle: (key: IndicatorKey) => void;
    paneIndices: PaneIndices;
}

function initialVisibility(): VisibilityState {
    // VisibilityState는 IndicatorKey 전체(18키) Record지만 여기선 pane 키(PANE_KEYS)만
    // 채운다. overlay 키(ma 등)는 runtime undefined·타입상 boolean이나, visible은 pane
    // 지표 토글에만 쓰이고 overlay 키는 어디서도 읽지 않으므로 안전한 캐스트다.
    return Object.fromEntries(
        PANE_KEYS.map(key => [key, false])
    ) as VisibilityState;
}

export function useIndicatorVisibility(): UseIndicatorVisibilityReturn {
    const [visible, setVisible] = useState<VisibilityState>(initialVisibility);

    const toggle = useCallback((key: IndicatorKey) => {
        setVisible(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // 활성 pane에 등록 순서대로 1,2,3… 배정, 비활성은 INACTIVE_PANE_INDEX.
    // PaneIndices는 IndicatorKey 전체 Record지만 pane 키만 채운다(Object.fromEntries는
    // Record<string, number>로 넓어진다). overlay 키는 runtime undefined이나 paneIndices
    // 소비자(pane 훅·buildPaneLabels)는 pane 키만 읽으므로 안전한 캐스트다.
    const paneIndices: PaneIndices = useMemo(() => {
        let next = FIRST_INDICATOR_PANE_INDEX;
        return Object.fromEntries(
            PANE_KEYS.map(key => [
                key,
                visible[key] ? next++ : INACTIVE_PANE_INDEX,
            ])
        ) as PaneIndices;
    }, [visible]);

    return { visible, toggle, paneIndices };
}
