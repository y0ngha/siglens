import type {
    InstitutionalHolderChange,
    InstitutionalHolderChangeKind,
    InstitutionalQuarter,
} from '@y0ngha/siglens-core';

/** 막대 그래프에 그리는 분기 수(최신 분기부터 거꾸로). */
export const MAX_QUARTER_BARS = 6;

export type FlowDirection = 'in' | 'out' | 'flat';

export function flowDirection(netShareChange: number): FlowDirection {
    if (netShareChange > 0) return 'in';
    if (netShareChange < 0) return 'out';
    return 'flat';
}

export interface QuarterBar {
    period: string;
    complete: boolean;
    holders: number;
    netShareChange: number;
    direction: FlowDirection;
}

function sortedAscending(
    quarters: readonly InstitutionalQuarter[]
): InstitutionalQuarter[] {
    return [...quarters].sort((a, b) =>
        a.period < b.period ? -1 : a.period > b.period ? 1 : 0
    );
}

/** 분기별 순매수(IN)·순매도(OUT) 막대 — 오래된 분기부터 최신 분기까지, 최대 `MAX_QUARTER_BARS`개. */
export function buildQuarterBars(
    quarters: readonly InstitutionalQuarter[]
): QuarterBar[] {
    return sortedAscending(quarters)
        .slice(-MAX_QUARTER_BARS)
        .map(quarter => ({
            period: quarter.period,
            complete: quarter.complete,
            holders: quarter.holders,
            netShareChange: quarter.netShareChange,
            direction: flowDirection(quarter.netShareChange),
        }));
}

export type SplitKey = 'newHolders' | 'increased' | 'decreased' | 'exited';

export const SPLIT_KEYS: readonly SplitKey[] = [
    'newHolders',
    'increased',
    'decreased',
    'exited',
];

export interface SplitMetric {
    key: SplitKey;
    value: number;
    /** 직전 분기의 같은 수. 비교할 분기가 없으면 `null`. */
    previous: number | null;
    /** `value - previous`. 비교할 분기가 없으면 `null`. */
    delta: number | null;
}

export interface SplitComparison {
    period: string;
    complete: boolean;
    previousPeriod: string | null;
    metrics: SplitMetric[];
}

/**
 * 4분할 카드(신규 진입·지분 증가·지분 감소·완전 청산)의 기준 분기와 직전 분기 대비.
 *
 * 기준은 **가장 최근 완결 분기**다 — 진행 중 분기는 아직 제출하지 않은 기관이 많아 모든 수가 작아 보이고,
 * 직전 분기와 비교하면 "급감"처럼 읽힌다(core가 점수에 쓰는 분기와도 같다). 완결 분기가 하나도 없을 때만
 * 가장 최근 분기를 쓰고 `complete: false`로 알린다. 직전 분기는 기준 분기 바로 앞 분기다.
 */
export function buildSplitComparison(
    quarters: readonly InstitutionalQuarter[]
): SplitComparison | null {
    const ascending = sortedAscending(quarters);
    if (ascending.length === 0) return null;
    const completeIndex = ascending.findLastIndex(q => q.complete);
    const index = completeIndex >= 0 ? completeIndex : ascending.length - 1;
    const current = ascending[index];
    const previous = index > 0 ? ascending[index - 1] : undefined;
    return {
        period: current.period,
        complete: current.complete,
        previousPeriod: previous?.period ?? null,
        metrics: SPLIT_KEYS.map(key => ({
            key,
            value: current[key],
            previous: previous === undefined ? null : previous[key],
            delta: previous === undefined ? null : current[key] - previous[key],
        })),
    };
}

/** 기준 분기보다 새로 시작된 진행 중(부분 집계) 분기. 없으면 `null`. */
export function findPartialQuarter(
    quarters: readonly InstitutionalQuarter[],
    basePeriod: string | null
): InstitutionalQuarter | null {
    const partial = sortedAscending(quarters)
        .filter(
            q => !q.complete && (basePeriod === null || q.period > basePeriod)
        )
        .at(-1);
    return partial ?? null;
}

export type HolderFilter = 'all' | 'new' | 'exited';

export function filterHolders(
    holders: readonly InstitutionalHolderChange[],
    filter: HolderFilter
): InstitutionalHolderChange[] {
    if (filter === 'all') return [...holders];
    return holders.filter(holder =>
        filter === 'new' ? holder.change === 'new' : holder.change === 'exited'
    );
}

/** 직전 분기 대비 보유 주식 수 변화(`shares - prevShares`). 직전 보유가 없으면(신규) 보유 수량 전체다. */
export function holderChangeShares(holder: InstitutionalHolderChange): number {
    return holder.shares - (holder.prevShares ?? 0);
}

/** 직전 분기 대비 변화율(%). 직전 보유가 없거나 0이면 계산할 수 없어 `null`. */
export function holderChangePercent(
    holder: InstitutionalHolderChange
): number | null {
    if (holder.prevShares === null || holder.prevShares === 0) return null;
    return ((holder.shares - holder.prevShares) / holder.prevShares) * 100;
}

/** 상태 배지에 쓰는 순서(상세 표시 순서와 무관). */
export const HOLDER_CHANGE_KINDS: readonly InstitutionalHolderChangeKind[] = [
    'new',
    'increased',
    'decreased',
    'exited',
    'unchanged',
];
