import {
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
    type Bar,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import { formatPrice } from '@/shared/lib/priceFormat';

/** chart 사실 층에 표시하는 결정적 기술 지표 묶음. */
export interface TechnicalFacts {
    lastClose: number;
    /** 직전 봉 종가 대비 % 변화. */
    changePercent: number;
    /** 마지막 non-null RSI. 없으면 null. */
    rsi: number | null;
    /** 마지막 non-null MACD histogram. 부호로 모멘텀 방향 판정. 없으면 null. */
    macdHistogram: number | null;
    high52w: number;
    low52w: number;
    /** 최근 윈도우 고점 대비 % (<= 0). */
    pctFrom52wHigh: number;
    /** 최근 윈도우 저점 대비 % (>= 0). */
    pctAbove52wLow: number;
}

// timeframe prop 없이도 결정적으로 계산하기 위해 마지막 RECENT_BARS_WINDOW 봉만 사용한다.
export const RECENT_BARS_WINDOW = 252;

// 등락률 계산에 직전 봉(prev)과 마지막 봉(last)이 필요하므로 최소 2개 봉이 있어야 한다.
const MIN_BARS_FOR_FACTS = 2;

function lastNonNull(arr: readonly (number | null)[]): number | null {
    return arr.findLast((v): v is number => v !== null) ?? null;
}

function changeDirection(changePercent: number): '상승' | '하락' | '보합' {
    if (changePercent > 0) return '상승';
    if (changePercent < 0) return '하락';
    return '보합';
}

export function technicalFactsRsiZone(
    rsi: number
): '과매수' | '과매도' | '중립' {
    if (rsi >= RSI_OVERBOUGHT_LEVEL) return '과매수';
    if (rsi <= RSI_OVERSOLD_LEVEL) return '과매도';
    return '중립';
}

export function technicalFactsMacdMomentumLabel(
    histogram: number
): '상승' | '하락' | '중립' {
    if (histogram > 0) return '상승';
    if (histogram < 0) return '하락';
    return '중립';
}

function macdNarrativePart(histogram: number): string {
    const label = technicalFactsMacdMomentumLabel(histogram);
    if (label === '상승') {
        return 'MACD 히스토그램은 양수라 단기 모멘텀은 상승 쪽';
    }
    if (label === '하락') {
        return 'MACD 히스토그램은 음수라 단기 모멘텀은 하락 쪽';
    }
    return 'MACD 히스토그램은 0이라 단기 모멘텀은 중립에 가까운 상태';
}

function rsiNarrativePart(rsi: number): string {
    return `RSI ${rsi.toFixed(1)}로 ${technicalFactsRsiZone(rsi)} 구간`;
}

function changeNarrativePart(
    symbol: string,
    price: string,
    changePercent: number
): string {
    return `${symbol}은 최근 종가 ${price} 기준으로 직전 봉 대비 ${Math.abs(changePercent).toFixed(2)}% ${changeDirection(changePercent)}했습니다.`;
}

function recentRangeNarrativePart(facts: TechnicalFacts): string {
    return `최근 ${RECENT_BARS_WINDOW}개 봉 고점 대비 ${facts.pctFrom52wHigh.toFixed(1)}%, 저점 대비 +${facts.pctAbove52wLow.toFixed(1)}% 위치에 있습니다.`;
}

/**
 * bars/indicators에서 결정적 사실을 추출한다. bars가 2개 미만이거나 직전
 * 종가가 0이면(등락률 분모 0) null을 반환해 호출부가 섹션을 graceful 생략한다.
 * 순수 함수 — 시간/난수 의존 없음.
 */
export function buildTechnicalFacts(
    bars: readonly Bar[],
    indicators: IndicatorResult
): TechnicalFacts | null {
    if (bars.length < MIN_BARS_FOR_FACTS) return null;
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    if (prev.close === 0) return null;

    const changePercent = ((last.close - prev.close) / prev.close) * 100;
    const recentBars = bars.slice(-RECENT_BARS_WINDOW);
    const high52w = Math.max(...recentBars.map(b => b.high));
    const low52w = Math.min(...recentBars.map(b => b.low));

    return {
        lastClose: last.close,
        changePercent,
        rsi: lastNonNull(indicators.rsi),
        macdHistogram: lastNonNull(indicators.macd.map(m => m.histogram)),
        high52w,
        low52w,
        // high52w === 0 분기는 도달 불가능한 방어 가드다: prev 봉은 recentBars에
        // 포함되고 prev.high >= prev.close이며, 위에서 prev.close === 0을 이미 걸러
        // prev.close > 0이므로 high52w >= prev.high >= prev.close > 0. (방어 유지)
        pctFrom52wHigh:
            high52w === 0 ? 0 : ((last.close - high52w) / high52w) * 100,
        pctAbove52wLow:
            low52w === 0 ? 0 : ((last.close - low52w) / low52w) * 100,
    };
}

export function buildTechnicalFactsNarrative(
    symbol: string,
    facts: TechnicalFacts,
    marketProfile: MarketProfileId
): string[] {
    const price = formatPrice(
        facts.lastClose,
        getDescriptor(marketProfile).priceFormat
    );
    const lines = [changeNarrativePart(symbol, price, facts.changePercent)];

    const momentumParts: string[] = [];
    if (facts.rsi !== null) {
        momentumParts.push(rsiNarrativePart(facts.rsi));
    }
    if (facts.macdHistogram !== null) {
        momentumParts.push(macdNarrativePart(facts.macdHistogram));
    }
    if (momentumParts.length > 0) {
        lines.push(`${momentumParts.join('이며, ')}입니다.`);
    }

    lines.push(recentRangeNarrativePart(facts));

    return lines;
}
