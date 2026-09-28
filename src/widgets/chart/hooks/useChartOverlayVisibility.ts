'use client';

import { useCallback, useMemo } from 'react';
import type { OverlayKind } from '@y0ngha/siglens-core';
import { usePersistentState } from '@/shared/hooks/usePersistentState';
import { STORAGE_KEYS } from '../constants';
import { DEFAULT_CHART_OVERLAY_VISIBILITY } from '../model/chartOverlayCategories';

interface UseChartOverlayVisibilityReturn {
    visible: Record<OverlayKind, boolean>;
    toggle: (kind: OverlayKind) => void;
}

export function useChartOverlayVisibility(): UseChartOverlayVisibilityReturn {
    const [persisted, setPersisted] = usePersistentState<
        Partial<Record<OverlayKind, boolean>>
    >(STORAGE_KEYS.chartOverlays, DEFAULT_CHART_OVERLAY_VISIBILITY);

    // 저장본에 없는 kind(새 카테고리)는 기본값으로 채운다.
    const visible = useMemo<Record<OverlayKind, boolean>>(
        () => ({ ...DEFAULT_CHART_OVERLAY_VISIBILITY, ...persisted }),
        [persisted]
    );

    const toggle = useCallback(
        (kind: OverlayKind) => {
            setPersisted(prev => {
                const full = { ...DEFAULT_CHART_OVERLAY_VISIBILITY, ...prev };
                return { ...full, [kind]: !full[kind] };
            });
        },
        [setPersisted]
    );

    return { visible, toggle };
}
