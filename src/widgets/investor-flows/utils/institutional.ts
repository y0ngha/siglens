/**
 * 기관(13F) 구간의 화면용 데이터 — 분기 막대, 보유 기관 수 추이, 4분할 비교, 진행 중 분기, 상위 보유 기관 필터.
 */
import type {
    InstitutionalHolderChange,
    InstitutionalQuarter,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';

/** 막대 그래프에 그리는 분기 수(최신 분기부터 거꾸로). */
export const MAX_QUARTER_BARS = 6;

/** 순매수 방향 — IN(순매수)·OUT(순매도)·FLAT(변화 없음). */
export type FlowDirection = 'in' | 'out' | 'flat';

/** 순변화의 부호를 방향으로 바꾼다. 정확히 0이면 flat이다. */
export function flowDirection(netShareChange: number): FlowDirection {
    if (netShareChange > 0) return 'in';
    if (netShareChange < 0) return 'out';
    return 'flat';
}

/** 분기 막대 하나. */
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
    return quarters.toSorted((a, b) => compareIsoDate(a.period, b.period));
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

/** 보유 기관 수 추이 그래프의 값과 눈금·양끝(완결 분기만). */
export interface HoldersTrend {
    values: number[];
    max: number;
    min: number;
    /** 첫·마지막 분기의 보유 기관 수 — 스크린리더 요약에 쓴다. */
    first: number;
    last: number;
    startPeriod: string;
    endPeriod: string;
}

/**
 * 보유 기관 수 추이. 진행 중 분기는 제출이 덜 모여 기관 수가 작다 — 추이 선에 넣으면 "급감"처럼 읽히므로 뺀다. 완결 분기가 둘
 * 미만이면 선을 그을 수 없어 `null`이다.
 */
export function buildHoldersTrend(
    bars: readonly QuarterBar[]
): HoldersTrend | null {
    const complete = bars.filter(bar => bar.complete);
    if (complete.length < 2) return null;
    const values = complete.map(bar => bar.holders);
    return {
        values,
        max: Math.max(...values),
        min: Math.min(...values),
        first: values[0],
        last: values[values.length - 1],
        startPeriod: complete[0].period,
        endPeriod: complete[complete.length - 1].period,
    };
}

/** 4분할 카드 증감 표시 종류. */
export type SplitDeltaKind = 'none' | 'flat' | 'up' | 'down';

/** 4분할 카드 증감 표시 종류: 비교할 직전 분기가 없으면 `none`, 같으면 `flat`, 늘면 `up`, 줄면 `down`. */
export function splitDeltaKind(delta: number | null): SplitDeltaKind {
    if (delta === null) return 'none';
    if (delta === 0) return 'flat';
    return delta > 0 ? 'up' : 'down';
}

/** 4분할 카드의 항목. */
export type SplitKey = 'newHolders' | 'increased' | 'decreased' | 'exited';

/** 4분할 카드 항목의 표시 순서. */
export const SPLIT_KEYS: readonly SplitKey[] = [
    'newHolders',
    'increased',
    'decreased',
    'exited',
];

/** 4분할 카드 항목 하나의 값과 직전 분기 대비. */
export interface SplitMetric {
    key: SplitKey;
    value: number;
    /** 직전 분기의 같은 수. 비교할 분기가 없으면 `null`. */
    previous: number | null;
    /** `value - previous`. 비교할 분기가 없으면 `null`. */
    delta: number | null;
}

/** 4분할 카드의 기준 분기와 항목들. */
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

/** 상위 보유 기관 필터. */
export type HolderFilter = 'all' | 'new' | 'exited';

/** 필터에 맞는 보유 기관만 남긴다. */
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
