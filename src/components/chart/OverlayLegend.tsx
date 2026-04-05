import type React from 'react';
import type { OverlayLegendItem } from '@/components/chart/types';

interface OverlayLegendProps {
    items: OverlayLegendItem[];
}

interface OverlayGroup {
    key: string;
    items: OverlayLegendItem[];
}

const ICHIMOKU_NAMES = new Set([
    'Tenkan',
    'Kijun',
    'Chikou',
    'Senkou A',
    'Senkou B',
]);
const VP_NAMES = new Set(['POC', 'VAH', 'VAL']);

function getGroupKey(name: string): string {
    if (name.startsWith('MA(')) return 'MA';
    if (name.startsWith('EMA(')) return 'EMA';
    if (name.startsWith('BB ')) return 'BB';
    if (ICHIMOKU_NAMES.has(name)) return 'Ichimoku';
    if (VP_NAMES.has(name)) return 'VP';
    return name;
}

function groupItems(items: OverlayLegendItem[]): OverlayGroup[] {
    const groups: OverlayGroup[] = [];
    const seen = new Map<string, number>();

    for (const item of items) {
        const key = getGroupKey(item.name);
        const existingIdx = seen.get(key);

        if (existingIdx !== undefined) {
            groups[existingIdx].items.push(item);
        } else {
            seen.set(key, groups.length);
            groups.push({ key, items: [item] });
        }
    }

    return groups;
}

function formatValue(value: number | null): string {
    if (value === null) return '-';
    return value.toFixed(2);
}

export function OverlayLegend({ items }: OverlayLegendProps) {
    if (items.length === 0) return null;

    const groups = groupItems(items);

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
                            {'\u25CF'} {item.name} {formatValue(item.value)}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}
