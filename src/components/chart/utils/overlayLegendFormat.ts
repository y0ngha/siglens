import type { OverlayLegendItem } from '@/components/chart/types';

export interface OverlayGroup {
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

export function groupOverlayItems(
    items: readonly OverlayLegendItem[]
): OverlayGroup[] {
    return items.reduce<{
        groups: OverlayGroup[];
        seen: Map<string, number>;
    }>(
        ({ groups, seen }, item) => {
            const key = getGroupKey(item.name);
            const existingIdx = seen.get(key);

            if (existingIdx !== undefined) {
                const updatedGroups = groups.map((g, i) =>
                    i === existingIdx ? { ...g, items: [...g.items, item] } : g
                );
                return { groups: updatedGroups, seen };
            }

            seen.set(key, groups.length);
            return {
                groups: [...groups, { key, items: [item] }],
                seen,
            };
        },
        { groups: [], seen: new Map() }
    ).groups;
}

export function formatOverlayValue(value: number | null): string {
    if (value === null) return '-';
    return value.toFixed(2);
}
