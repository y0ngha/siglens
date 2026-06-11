'use client';

import { useCallback, useMemo } from 'react';
import { usePersistentState } from '@/shared/hooks/usePersistentState';
import {
    FIRST_INDICATOR_PANE_INDEX,
    INACTIVE_PANE_INDEX,
    STORAGE_KEYS,
} from '../constants';
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
    // INDICATOR_REGISTRY 전체 키를 채우므로 Record<IndicatorKey, boolean>가
    // 런타임에 완전히 충족된다 — 안전한 캐스트.
    return Object.fromEntries(
        INDICATOR_REGISTRY.map(m => [m.key, false])
    ) as VisibilityState;
}

// INDICATOR_REGISTRY(정적)에서만 파생되는 순수 값 — 매 렌더 재호출 대신 모듈 레벨 상수로 1회 고정.
const INITIAL_VISIBILITY: VisibilityState = initialVisibility();

export function useIndicatorVisibility(): UseIndicatorVisibilityReturn {
    // 복원값은 구 버전 저장 데이터처럼 일부 키만 있을 수 있으므로 Partial로 받는다(타입-런타임 일치).
    // INITIAL_VISIBILITY(완전한 Record)는 Partial의 상위 타입이므로 초기값으로 그대로 허용된다.
    const [persistedPartial, setVisible] = usePersistentState<
        Partial<Record<IndicatorKey, boolean>>
    >(STORAGE_KEYS.visible, INITIAL_VISIBILITY);

    // 레지스트리 성장 대비: 저장된 값에 없는 새 키는 기본값(false)으로 채운다.
    // paneIndices 계산이 모든 등록 키를 필요로 하므로 완전한 Record를 항상 보장한다.
    const visible = useMemo<VisibilityState>(
        () => ({ ...INITIAL_VISIBILITY, ...persistedPartial }),
        [persistedPartial]
    );

    const toggle = useCallback(
        (key: IndicatorKey) => {
            setVisible(prev => ({ ...prev, [key]: !prev[key] }));
        },
        [setVisible]
    );

    const paneIndices: PaneIndices = useMemo(() => {
        // 가변 카운터 없이 순수하게 계산 — 활성 pane을 등록 순서로 추려 Map으로 위치를 부여.
        const activePaneKeys = INDICATOR_REGISTRY.filter(
            m => m.kind === 'pane' && visible[m.key]
        ).map(m => m.key);
        const activePaneIndexMap = new Map(
            activePaneKeys.map((key, i) => [
                key,
                FIRST_INDICATOR_PANE_INDEX + i,
            ])
        );
        // INDICATOR_REGISTRY 전체 키(18개)를 채우므로 Record<IndicatorKey,number>가 런타임에 완전히 충족 — 안전한 캐스트.
        return Object.fromEntries(
            INDICATOR_REGISTRY.map(m => [
                m.key,
                activePaneIndexMap.get(m.key) ?? INACTIVE_PANE_INDEX,
            ])
        ) as PaneIndices;
    }, [visible]);

    return { visible, toggle, paneIndices };
}
