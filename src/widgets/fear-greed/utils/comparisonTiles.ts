import type {
    FearGreedHistoryPoint,
    FearGreedLabel,
} from '@y0ngha/siglens-core';
import { resolveSessionComparisons } from '@/entities/market-fear-greed/lib/buildMarketFearGreedComparisons';
import type { MarketFearGreedComparisonKey } from '@/entities/market-fear-greed/model';
import { toDisplayReading } from './displayReading';

/** 기간 → `shared.ui.period` 메시지 키. 표시 문자열이 아니다. */
const PERIOD_MESSAGE_KEY: Record<MarketFearGreedComparisonKey, string> = {
    now: 'now',
    '1w': 'week',
    '1m': 'month',
    '1y': 'year',
};

/** 비교 게이지 한 칸이 그릴 값. */
export interface ComparisonTile {
    key: MarketFearGreedComparisonKey;
    /** `shared.ui.period` 메시지 키. */
    periodMessageKey: string;
    /** 반올림한 표시 점수. */
    score: number;
    /** `score`에서 구한 라벨 — 숫자와 같은 구간을 가리킨다. */
    label: FearGreedLabel;
    /** 실제로 쓰인 세션 날짜(ISO `YYYY-MM-DD`). */
    date: string;
    /** history가 이 기간까지 닿지 않아 가장 오래된 세션으로 대신했는가. */
    clamped: boolean;
}

/**
 * history를 현재·1주·1개월·1년 전 비교 칸으로 줄인다.
 * 기간 계산은 시장 지수 페이지와 같은 엔티티 로직을 쓴다(워밍업 구간은 세지 않는다).
 * 점수가 하나도 없으면 빈 배열이다.
 */
export function buildComparisonTiles(
    history: readonly FearGreedHistoryPoint[]
): ComparisonTile[] {
    return resolveSessionComparisons(history).map(point => ({
        key: point.key,
        periodMessageKey: PERIOD_MESSAGE_KEY[point.key],
        ...toDisplayReading(point.score),
        date: point.date,
        clamped: point.clamped,
    }));
}
