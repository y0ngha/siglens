'use client';

import { useMemo } from 'react';
import type { OverlayLegendItem } from '@/components/chart/types';
import {
    groupOverlayItems,
    type OverlayGroup,
} from '@/components/chart/utils/overlayLegendFormat';

export function useOverlayGroups(
    items: readonly OverlayLegendItem[]
): OverlayGroup[] {
    return useMemo(() => groupOverlayItems(items), [items]);
}
