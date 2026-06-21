'use client';

import type { CSSProperties } from 'react';
import type { OverlayLegendItem } from './types';
import { useOverlayGroups } from './hooks/useOverlayGroups';
import { formatOverlayValue } from './utils/overlayLegendFormat';

interface OverlayLegendProps {
    items: OverlayLegendItem[];
    /**
     * Decimal places for overlay values — matches the candlestick series
     * precision so crypto sub-cent overlays aren't flattened to 2dp.
     * Defaults to 2 for backward compatibility (us-equity).
     */
    decimals?: number;
}

export function OverlayLegend({ items, decimals = 2 }: OverlayLegendProps) {
    const groups = useOverlayGroups(items);

    if (items.length === 0) return null;

    return (
        <div className="pointer-events-none flex flex-col gap-1.5">
            {groups.map(group => (
                <div
                    key={group.key}
                    className="flex flex-wrap gap-x-3 gap-y-1.5"
                >
                    {group.items.map(item => (
                        <span
                            key={item.name}
                            className="font-mono text-[11px] leading-none text-(--legend-color)"
                            style={
                                {
                                    '--legend-color': item.color,
                                } as CSSProperties
                            }
                        >
                            {'\u25CF'} {item.name}{' '}
                            {formatOverlayValue(item.value, decimals)}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}
