import type { FearGreedLabel } from '@y0ngha/siglens-core';
import type { HomeTodayMarketData, TodayMarketId } from './loadHomeTodayMarket';
import type { TodaySignalRow } from '@/entities/sector-signal/lib/selectTodaySignals';

export type FearGreedMarketLabelKey = 'marketUs' | 'marketKr' | 'marketCrypto';
export type SignalMarketLabelKey = 'signalsUs' | 'signalsKr';

/** 화면에 그릴 공포탐욕 칸 하나. 점수는 반올림한 정수다(허브 제목과 같은 규칙). */
export interface TodayFearGreedTile {
    readonly id: TodayMarketId;
    readonly href: string;
    readonly labelKey: FearGreedMarketLabelKey;
    readonly date: string;
    readonly score: number;
    readonly sentiment: FearGreedLabel;
}

/** 화면에 그릴 시장별 신호 종목 묶음. */
export interface TodaySignalGroup {
    readonly id: 'us' | 'kr';
    readonly href: string;
    readonly labelKey: SignalMarketLabelKey;
    readonly rows: readonly TodaySignalRow[];
    /** 스캔 시각(ISO). 없으면 `null` — 화면은 기준 시각 줄을 뺀다. */
    readonly computedAt: string | null;
}

export interface TodayMarketView {
    readonly tiles: readonly TodayFearGreedTile[];
    readonly signalGroups: readonly TodaySignalGroup[];
}

const FEAR_GREED_MARKETS: readonly {
    readonly id: TodayMarketId;
    readonly href: string;
    readonly labelKey: FearGreedMarketLabelKey;
}[] = [
    { id: 'us', href: '/fear-greed', labelKey: 'marketUs' },
    { id: 'kr', href: '/fear-greed/kr', labelKey: 'marketKr' },
    { id: 'crypto', href: '/fear-greed/crypto', labelKey: 'marketCrypto' },
];

const SIGNAL_MARKETS: readonly {
    readonly id: 'us' | 'kr';
    readonly href: string;
    readonly labelKey: SignalMarketLabelKey;
}[] = [
    { id: 'us', href: '/market', labelKey: 'signalsUs' },
    { id: 'kr', href: '/market/kr', labelKey: 'signalsKr' },
];

/**
 * 로더 결과 → 화면에 그릴 칸. 그릴 것이 하나도 없으면 `null`이다 — 페이지는 그때 섹션과 그 자리의
 * 여백을 모두 빼서, 홈 첫 화면에 빈 카드나 빈 간격이 남지 않게 한다.
 *
 * 표본이 모자란 구간(웜업)은 점수·단계가 null이라 그 시장 칸을 뺀다. 신호가 없는 시장도 뺀다.
 */
export function toTodayMarketView(
    data: HomeTodayMarketData
): TodayMarketView | null {
    const tiles = FEAR_GREED_MARKETS.flatMap(market => {
        const reading = data.fearGreed[market.id];
        if (reading?.score == null || reading.label === null) return [];
        return [
            {
                ...market,
                date: reading.date,
                score: Math.round(reading.score),
                sentiment: reading.label,
            },
        ];
    });
    const signalGroups = SIGNAL_MARKETS.flatMap(market => {
        const { rows, computedAt } = data.signals[market.id];
        return rows.length === 0 ? [] : [{ ...market, rows, computedAt }];
    });
    return tiles.length === 0 && signalGroups.length === 0
        ? null
        : { tiles, signalGroups };
}
