'use client';

import type React from 'react';
import type { OverlayLegendItem } from '@/components/chart/types';
import { useOverlayGroups } from '@/components/chart/hooks/useOverlayGroups';
import { formatOverlayValue } from '@/components/chart/utils/overlayLegendFormat';

interface OverlayLegendProps {
    items: OverlayLegendItem[];
}

export function OverlayLegend({ items }: OverlayLegendProps) {
    const groups = useOverlayGroups(items);

    if (items.length === 0) return null;

    return (
        <div className="pointer-events-none flex flex-col gap-[6px]">
            {groups.map(group => (
                <div
                    key={group.key}
                    className="flex flex-wrap gap-x-3 gap-y-[6px]"
                >
                    {group.items.map(item => (
                        <span
                            key={item.name}
                            className="font-mono text-[11px] leading-none text-[color:var(--legend-color)]"
                            style={
                                {
                                    '--legend-color': item.color,
                                } as React.CSSProperties
                            }
                        >
                            {'\u25CF'} {item.name}{' '}
                            {formatOverlayValue(item.value)}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}
