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
                            className="font-mono text-[11px] leading-none text-secondary-300"
                        >
                            {/*
                                지표 색은 **점에만** 칠한다. 이름·값까지 지표 색으로
                                칠하면 라이트 테마에서 밝은 지표(BB Middle 2.41:1,
                                Buy 2.82:1 등)가 읽히지 않는다. 점은 그래픽이라
                                3:1이면 되고, 텍스트는 전경 토큰으로 대비를 확보한다.
                            */}
                            <span
                                aria-hidden="true"
                                className="text-(--legend-color)"
                                style={
                                    {
                                        '--legend-color': item.color,
                                    } as CSSProperties
                                }
                            >
                                {'\u25CF'}
                            </span>{' '}
                            {item.name}{' '}
                            {formatOverlayValue(item.value, decimals)}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}
