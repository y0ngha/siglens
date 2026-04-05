import type React from 'react';
import type { OverlayLegendItem } from '@/components/chart/types';

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
    return items.reduce<{ groups: OverlayGroup[]; seen: Map<string, number> }>(
        ({ groups, seen }, item) => {
            const key = getGroupKey(item.name);
            const existingIdx = seen.get(key);

            if (existingIdx !== undefined) {
                const updatedGroups = groups.map((g, i) =>
                    i === existingIdx ? { ...g, items: [...g.items, item] } : g
                );
                return { groups: updatedGroups, seen };
            }

            const nextSeen = new Map(seen).set(key, groups.length);
            return {
                groups: [...groups, { key, items: [item] }],
                seen: nextSeen,
            };
        },
        { groups: [], seen: new Map() }
    ).groups;
}

function formatValue(value: number | null): string {
    if (value === null) return '-';
    return value.toFixed(2);
}

interface OverlayLegendProps {
    items: OverlayLegendItem[];
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
