/**
 * 오버레이 범례 항목을 그룹으로 묶고 값을 표시 문자열로 포맷하는 유틸.
 */

import { cachedNumberFormat } from '@/shared/lib/intlFormatCache';
import type { OverlayLegendItem } from '../types';

export interface OverlayGroup {
    key: string;
    items: OverlayLegendItem[];
}

const MA_NAME_PREFIX = 'MA(';
const EMA_NAME_PREFIX = 'EMA(';
const BB_NAME_PREFIX = 'BB ';

const ICHIMOKU_NAMES = new Set([
    'Tenkan',
    'Kijun',
    'Chikou',
    'Senkou A',
    'Senkou B',
]);
const VP_NAMES = new Set(['POC', 'VAH', 'VAL']);

function getGroupKey(name: string): string {
    if (name.startsWith(MA_NAME_PREFIX)) return 'MA';
    if (name.startsWith(EMA_NAME_PREFIX)) return 'EMA';
    if (name.startsWith(BB_NAME_PREFIX)) return 'BB';
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

            const nextSeen = new Map(seen).set(key, groups.length);
            return {
                groups: [...groups, { key, items: [item] }],
                seen: nextSeen,
            };
        },
        { groups: [], seen: new Map() }
    ).groups;
}

/**
 * 범례 값(MA·EMA·볼린저 등) — 가격과 같은 자릿수에 천 단위 구분자(`228,000`, `1,234.56`).
 * 예전엔 `toFixed`라 구분자가 없었다. 로케일을 넘기지 않고 `en-US`로 고정하는 이유: 지원
 * 로케일 넷(ko·en·ja·zh)의 구분자가 모두 `,`·`.`라 출력이 같고, 범례 폭 계산
 * (`overlayLegendLayout`)이 같은 문자열을 잰다 — 로케일을 받게 하면 순수 레이아웃 함수까지
 * 로케일이 번진다.
 */
export function formatOverlayValue(value: number | null, decimals = 2): string {
    if (value === null) return '-';
    return cachedNumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}
