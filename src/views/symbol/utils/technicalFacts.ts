import { RSI_OVERBOUGHT_LEVEL, RSI_OVERSOLD_LEVEL } from '@y0ngha/siglens-core';
import {
    RECENT_BARS_WINDOW,
    type TechnicalFacts,
} from '@/entities/bars/lib/technicalFacts';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import { formatPrice } from '@/shared/lib/priceFormat';
import type { SeoTranslator } from '@/shared/lib/seo';

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

// `t`는 `views.symbol.technicalFacts` 번역자(`SeoTranslator` 모양).
//
// 이 모듈은 SSR 크롤 문장을 만드는 순수 함수 모음이라 훅을 부를 수 없다 —
// 호출부가 넘긴다. 남아 있던 한국어는 JS 없이 읽히는 본문이라 비-ko
// 페이지에서 그대로 색인됐다.

const RSI_ZONE_KO_TEXT: Record<RsiZone, string> = {
    overbought: 'rsiOverbought',
    oversold: 'rsiOversold',
    neutral: 'rsiNeutral',
};

function macdNarrativePart(histogram: number, t: SeoTranslator): string {
    const direction = technicalFactsMacdMomentumLabel(histogram);
    if (direction === 'up') {
        return t('macdUp');
    }
    if (direction === 'down') {
        return t('macdDown');
    }
    return t('macdFlat');
}

function rsiNarrativePart(rsi: number, t: SeoTranslator): string {
    return t('rsiZone', {
        v0: rsi.toFixed(1),
        v1: t(RSI_ZONE_KO_TEXT[technicalFactsRsiZone(rsi)]),
    });
}

function changeNarrativePart(
    symbol: string,
    price: string,
    changePercent: number,
    t: SeoTranslator
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
    t: SeoTranslator
): string {
    return t('rangePosition', {
        v0: RECENT_BARS_WINDOW,
        v1: facts.pctFrom52wHigh.toFixed(1),
        v2: facts.pctAbove52wLow.toFixed(1),
    });
}

export function buildTechnicalFactsNarrative(
    symbol: string,
    facts: TechnicalFacts,
    marketProfile: MarketProfileId,
    t: SeoTranslator
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
