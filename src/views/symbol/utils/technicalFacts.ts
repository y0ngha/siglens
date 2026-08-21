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

/**
 * 등락률/MACD 히스토그램의 부호 — 값 자체는 더 이상 한글이 아니다.
 *
 * 예전에는 이 반환값이 `'상승'|'하락'|'보합'` 한글 리터럴이었다 — 타입이자
 * 표시 문자열을 겸해서, `/en/AAPL`의 기술적 지표 요약 패널이 영문 제목·각주
 * 사이에서 `MACD 모멘텀 하락`을 그대로 찍었다. `momentumLabel`이 번역자로
 * 조회한다. narrative 문장(아래 `macdNarrativePart`/`changeNarrativePart`)은
 * 이번 마이그레이션 범위 밖(`FearGreedFactsSummary`의 결정적 서사와 동일하게
 * ko 전용 유지)이라 그쪽은 이 키가 아니라 로컬 한글로 직접 분기한다.
 */
export type Direction = 'up' | 'down' | 'flat';

/** RSI 과매수/과매도/중립 구간 — 값 자체는 더 이상 한글이 아니다(Direction과 동일 사유). */
export type RsiZone = 'overbought' | 'oversold' | 'neutral';

function changeDirection(changePercent: number): Direction {
    if (changePercent > 0) return 'up';
    if (changePercent < 0) return 'down';
    return 'flat';
}

export function technicalFactsRsiZone(rsi: number): RsiZone {
    if (rsi >= RSI_OVERBOUGHT_LEVEL) return 'overbought';
    if (rsi <= RSI_OVERSOLD_LEVEL) return 'oversold';
    return 'neutral';
}

export function technicalFactsMacdMomentumLabel(histogram: number): Direction {
    if (histogram > 0) return 'up';
    if (histogram < 0) return 'down';
    return 'flat';
}

/**
 * Direction → 기존 `shared.enumLabel.trend` 카탈로그 재사용(신규 그룹 추가 안 함).
 * `flat`이 `trend.neutral`("Flat"/"보합")과 정확히 겹쳐 재사용 근거가 된다.
 *
 * 소비자(`TechnicalFactsSummary`)가 `tLabel(DIRECTION_LABEL_KEY[...])`처럼 **그
 * 파일 안에서 직접 호출**해야 한다 — `sentimentDisplay.ts`의 `SENTIMENT_LABEL_KEY`와
 * 동일 이유로, extract.mjs의 동적 키 탐지는 그 호출 패턴만 보고 라우트의 클라이언트
 * 번들에 `shared.enumLabel`을 싣는다. 이 값을 감싸는 래퍼 함수로 한 단계 더
 * 들여쓰면(`momentumLabel(direction, t)`) 소비 파일에는 `t(...)` 직접 호출이
 * 안 남아 그 탐지가 못 본다.
 */
export const DIRECTION_LABEL_KEY: Record<Direction, string> = {
    up: 'trend.bullish',
    down: 'trend.bearish',
    flat: 'trend.neutral',
};

/** RsiZone → `shared.enumLabel.rsiZone` 카탈로그 키(신규 그룹 — 과매수/과매도는 trend·sentiment 어디에도 없다). 직접 호출 이유는 위 DIRECTION_LABEL_KEY와 동일. */
export const RSI_ZONE_LABEL_KEY: Record<RsiZone, string> = {
    overbought: 'rsiZone.overbought',
    oversold: 'rsiZone.oversold',
    neutral: 'rsiZone.neutral',
};

// narrative 문장 전용 한글 매핑 — buildTechnicalFactsNarrative는 이번
// 마이그레이션 범위 밖(로케일 무관 ko 고정, FearGreedFactsSummary와 동일 패턴)
// 이라 카탈로그를 거치지 않고 여기서 직접 한글로 되돌린다.
/**
 * `views.symbol.technicalFacts` 번역자.
 *
 * 이 모듈은 SSR 크롤 문장을 만드는 순수 함수 모음이라 훅을 부를 수 없다 —
 * 호출부가 넘긴다. 남아 있던 한국어는 JS 없이 읽히는 본문이라 비-ko
 * 페이지에서 그대로 색인됐다.
 */
type TechnicalFactsTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

const RSI_ZONE_KO_TEXT: Record<RsiZone, string> = {
    overbought: 'rsiOverbought',
    oversold: 'rsiOversold',
    neutral: 'rsiNeutral',
};

function macdNarrativePart(
    histogram: number,
    t: TechnicalFactsTranslator
): string {
    const direction = technicalFactsMacdMomentumLabel(histogram);
    if (direction === 'up') {
        return t('macdUp');
    }
    if (direction === 'down') {
        return t('macdDown');
    }
    return t('macdFlat');
}

function rsiNarrativePart(rsi: number, t: TechnicalFactsTranslator): string {
    return t('rsiZone', {
        v0: rsi.toFixed(1),
        v1: t(RSI_ZONE_KO_TEXT[technicalFactsRsiZone(rsi)]),
    });
}

function changeNarrativePart(
    symbol: string,
    price: string,
    changePercent: number,
    t: TechnicalFactsTranslator
): string {
    const direction = changeDirection(changePercent);
    const directionKo =
        direction === 'up'
            ? t('directionUp')
            : direction === 'down'
              ? t('directionDown')
              : t('directionFlat');
    return t('closeSummary', {
        v0: symbol,
        v1: price,
        v2: Math.abs(changePercent).toFixed(2),
        v3: directionKo,
    });
}

function recentRangeNarrativePart(
    facts: TechnicalFacts,
    t: TechnicalFactsTranslator
): string {
    return t('rangePosition', {
        v0: RECENT_BARS_WINDOW,
        v1: facts.pctFrom52wHigh.toFixed(1),
        v2: facts.pctAbove52wLow.toFixed(1),
    });
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
    marketProfile: MarketProfileId,
    t: TechnicalFactsTranslator
): string[] {
    const price = formatPrice(
        facts.lastClose,
        getDescriptor(marketProfile).priceFormat
    );
    const lines = [changeNarrativePart(symbol, price, facts.changePercent, t)];

    const momentumParts: string[] = [];
    if (facts.rsi !== null) {
        momentumParts.push(rsiNarrativePart(facts.rsi, t));
    }
    if (facts.macdHistogram !== null) {
        momentumParts.push(macdNarrativePart(facts.macdHistogram, t));
    }
    if (momentumParts.length > 0) {
        lines.push(
            t('momentumTail', {
                v0: momentumParts.join(t('momentumJoin')),
            })
        );
    }

    lines.push(recentRangeNarrativePart(facts, t));

    return lines;
}
