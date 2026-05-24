'use client';

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
