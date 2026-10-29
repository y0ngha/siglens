/**
 * 차트 탭 기술적 사실 요약(`TechnicalFactsSummary`)의 판정·서술 문장·표시 값.
 */
import {
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
    type Bar,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import {
    buildTechnicalFacts,
    RECENT_BARS_WINDOW,
    type TechnicalFacts,
} from '@/entities/bars/lib/technicalFacts';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import { formatPrice, formatPriceChange } from '@/shared/lib/priceFormat';
import type { SeoTranslator } from '@/shared/lib/seo';

/** 등락률·MACD 히스토그램의 부호. 표시 문자열이 아니라 카탈로그 키를 고르는 판정값이다. */
export type Direction = 'up' | 'down' | 'flat';

/** RSI 과매수/과매도/중립 구간. */
export type RsiZone = 'overbought' | 'oversold' | 'neutral';

function signDirection(value: number): Direction {
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'flat';
}

/** RSI 값 → 구간(core의 과매수·과매도 기준선). */
export function technicalFactsRsiZone(rsi: number): RsiZone {
    if (rsi >= RSI_OVERBOUGHT_LEVEL) return 'overbought';
    if (rsi <= RSI_OVERSOLD_LEVEL) return 'oversold';
    return 'neutral';
}

/** MACD 히스토그램 → 모멘텀 방향. */
export function technicalFactsMacdMomentumLabel(histogram: number): Direction {
    return signDirection(histogram);
}

/**
 * Direction → 기존 `shared.enumLabel.trend` 카탈로그 재사용(신규 그룹 추가 안 함).
 * `flat`이 `trend.neutral`("Flat"/"보합")과 정확히 겹쳐 재사용 근거가 된다.
 *
 * 소비자(`TechnicalFactsSummary`)가 `tLabel(DIRECTION_LABEL_KEY[...])`처럼 **그
 * 파일 안에서 직접 호출**해야 한다 — extract.mjs의 동적 키 탐지는 그 호출 패턴만 보고
 * 라우트의 클라이언트 번들에 `shared.enumLabel`을 싣는다. 이 값을 감싸는 래퍼 함수로 한
 * 단계 더 들여쓰면 소비 파일에는 `t(...)` 직접 호출이 안 남아 그 탐지가 못 본다.
 */
export const DIRECTION_LABEL_KEY: Record<Direction, string> = {
    up: 'trend.bullish',
    down: 'trend.bearish',
    flat: 'trend.neutral',
};

/** RsiZone → `shared.enumLabel.rsiZone` 카탈로그 키. 직접 호출 이유는 위 DIRECTION_LABEL_KEY와 동일. */
export const RSI_ZONE_LABEL_KEY: Record<RsiZone, string> = {
    overbought: 'rsiZone.overbought',
    oversold: 'rsiZone.oversold',
    neutral: 'rsiZone.neutral',
};

// 아래 서술 문장 헬퍼의 `t`는 `views.symbol.technicalFacts` 번역자(`SeoTranslator` 모양)다.
// SSR 크롤 문장을 만드는 순수 함수라 훅을 부를 수 없어 호출부가 넘긴다.

/** 서술 문장 안의 RSI 구간 표현 키(`views.symbol.technicalFacts`). */
const RSI_ZONE_NARRATIVE_KEY: Record<RsiZone, string> = {
    overbought: 'rsiOverbought',
    oversold: 'rsiOversold',
    neutral: 'rsiNeutral',
};

/** 서술 문장 안의 MACD 방향 표현 키(`views.symbol.technicalFacts`). */
const MACD_NARRATIVE_KEY: Record<Direction, string> = {
    up: 'macdUp',
    down: 'macdDown',
    flat: 'macdFlat',
};

function macdNarrativePart(histogram: number, t: SeoTranslator): string {
    return t(MACD_NARRATIVE_KEY[technicalFactsMacdMomentumLabel(histogram)]);
}

function rsiNarrativePart(rsi: number, t: SeoTranslator): string {
    return t('rsiZone', {
        v0: rsi.toFixed(1),
        v1: t(RSI_ZONE_NARRATIVE_KEY[technicalFactsRsiZone(rsi)]),
    });
}

function changeNarrativePart(
    subject: string,
    price: string,
    changePercent: number,
    t: SeoTranslator
): string {
    const direction = signDirection(changePercent);
    // 보합은 `0.00% 보합했습니다` 대신 "같은 가격입니다"로 끝나는 별도 문장이다 —
    // 방향 동사를 억지로 붙이면 비문이 된다.
    if (direction === 'flat') {
        return t('closeSummaryFlat', { v0: subject, v1: price });
    }
    return t('closeSummary', {
        v0: subject,
        v1: price,
        v2: Math.abs(changePercent).toFixed(2),
        v3: direction === 'up' ? t('directionUp') : t('directionDown'),
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

/**
 * 차트 탭 서술 문장. 첫 문장이 네이버 스니펫으로 쓰인다 — 그래서 티커 대신
 * 검색어와 같은 주어(`애플(AAPL)`, `buildTitleSubject`)로 시작하고, 조사가 주어에 의존하지
 * 않게 `{주어}의 …` 꼴로 쓴다(받침에 따라 `은/는`이 갈리는 문장은 한국어 이름에서 깨진다).
 */
export function buildTechnicalFactsNarrative(
    subject: string,
    facts: TechnicalFacts,
    marketProfile: MarketProfileId,
    t: SeoTranslator
): readonly string[] {
    const price = formatPrice(
        facts.lastClose,
        getDescriptor(marketProfile).priceFormat
    );
    const momentumParts = [
        facts.rsi === null ? null : rsiNarrativePart(facts.rsi, t),
        facts.macdHistogram === null
            ? null
            : macdNarrativePart(facts.macdHistogram, t),
    ].filter((part): part is string => part !== null);

    return [
        changeNarrativePart(subject, price, facts.changePercent, t),
        ...(momentumParts.length > 0
            ? [t('momentumTail', { v0: momentumParts.join(t('momentumJoin')) })]
            : []),
        recentRangeNarrativePart(facts, t),
    ];
}

/** 현재가 옆 등락 표시. `text`가 null이면 보합 — 렌더 쪽이 `shared.ui.misc.flatChange`를 넣는다. */
export interface ChangeDisplay {
    readonly colorClass: string;
    readonly text: string | null;
}

/**
 * 보합(0%)은 화살표가 없어 문구가 필요하다. 문구를 여기서 만들지 않는 이유는 이 모듈의 다른
 * 헬퍼와 같다 — 번역자를 인자로 받는 모듈에서 `t('리터럴')`을 부르면 추출기가 파일을 건너뛴다
 * (`noTranslatorParamCall` 가드). 대신 `text: null`로 알리고 렌더 쪽이 문구를 넣는다.
 */
export function formatVisibleChange(changePercent: number): ChangeDisplay {
    if (changePercent === 0) {
        return { colorClass: 'text-secondary-300', text: null };
    }
    const change = formatPriceChange(changePercent);
    return {
        colorClass: change.colorClass,
        text: `${change.arrow} ${change.sign}${Math.abs(changePercent).toFixed(2)}%`,
    };
}

/** `TechnicalFactsSummary`가 그릴 값 한 벌. */
export interface TechnicalFactsSummaryModel {
    readonly facts: TechnicalFacts;
    readonly narrative: readonly string[];
    readonly change: ChangeDisplay;
    /** 시장 형식으로 포맷한 마지막 종가. */
    readonly priceText: string;
    /** 시세 지연(분). 0이면 실시간이라 라벨에 지연 표기를 붙이지 않는다. */
    readonly quoteDelayMinutes: number;
    /** 최근 고저 위치를 재는 봉 수. */
    readonly recentBarsWindow: number;
}

/** 봉·지표에서 요약 값을 만든다. 사실을 계산할 수 없으면(봉·지표 부족) null. */
export function buildTechnicalFactsSummaryModel(
    bars: readonly Bar[],
    indicators: IndicatorResult,
    subject: string,
    marketProfile: MarketProfileId,
    t: SeoTranslator
): TechnicalFactsSummaryModel | null {
    const facts = buildTechnicalFacts(bars, indicators);
    if (!facts) return null;
    const { quoteDelayMinutes, priceFormat } = getDescriptor(marketProfile);
    return {
        facts,
        narrative: buildTechnicalFactsNarrative(
            subject,
            facts,
            marketProfile,
            t
        ),
        change: formatVisibleChange(facts.changePercent),
        priceText: formatPrice(facts.lastClose, priceFormat),
        quoteDelayMinutes,
        recentBarsWindow: RECENT_BARS_WINDOW,
    };
}
