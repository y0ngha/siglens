'use client';

/**
 * 범례 항목을 그룹별로 묶어 메모이즈하는 훅.
 */

import { useMemo } from 'react';
import type { OverlayLegendItem } from '../types';
import {
    groupOverlayItems,
    type OverlayGroup,
} from '../utils/overlayLegendFormat';

export function useOverlayGroups(
    items: readonly OverlayLegendItem[]
): OverlayGroup[] {
    return useMemo(() => groupOverlayItems(items), [items]);
}
