import {
    CCI_OVERBOUGHT_LEVEL,
    CCI_OVERSOLD_LEVEL,
    CCI_ZERO_LEVEL,
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import type { CHART_COLORS } from '@/shared/lib/chartColors';
import {
    BOLLINGER_PERCENT_B_LOWER_LEVEL,
    BOLLINGER_PERCENT_B_UPPER_LEVEL,
    CMF_ZERO_LEVEL,
    CONNORS_RSI_OVERBOUGHT_LEVEL,
    CONNORS_RSI_OVERSOLD_LEVEL,
    FORCE_INDEX_ZERO_LEVEL,
    HURST_RANDOM_WALK_LEVEL,
    MACD_V_ZERO_LEVEL,
    MFI_OVERBOUGHT_LEVEL,
    MFI_OVERSOLD_LEVEL,
    VARIANCE_RATIO_RANDOM_WALK_LEVEL,
    WILLIAMS_R_OVERBOUGHT_LEVEL,
    WILLIAMS_R_OVERSOLD_LEVEL,
} from '../constants/indicatorLevels';
import type { IndicatorKey } from './indicatorRegistry';

/**
 * `CHART_COLORS`의 **키**. 색 값이 아니라 키를 담는 이유: `CHART_COLORS`는
 * 접근 시점에 테마를 보는 게터라, 모듈 로드 때 값을 읽어 두면 그 테마 색에
 * 고정된다. 시리즈를 만들 때(`useLinePaneChart`) 읽어야 테마 remount가 먹는다.
 */
type ChartColorKey = keyof typeof CHART_COLORS;

interface ReferenceLine {
    price: number;
    color: ChartColorKey;
}

/** 선 하나 + 점선 기준선 N개로 그리는 보조지표 패인. */
export interface LinePaneSpec {
    lineColor: ChartColorKey;
    /** 생성 순서대로 그려진다(겹치면 뒤가 위). */
    referenceLines: readonly ReferenceLine[];
    values: (indicators: IndicatorResult) => (number | null)[];
}

type LinePaneKey = Extract<
    IndicatorKey,
    | 'rsi'
    | 'cci'
    | 'mfi'
    | 'williamsR'
    | 'connorsRsi'
    | 'cmf'
    | 'bollingerPercentB'
    | 'hurst'
    | 'varianceRatio'
    | 'macdV'
    | 'forceIndex'
    | 'obv'
    | 'atr'
    | 'yangZhang'
    | 'ewmaVolatility'
>;

/**
 * 단일 선 패인 지표들의 색·기준선·값 선택. 예전에는 지표마다 100줄 남짓한 훅이
 * 있었고 서로 이 세 가지만 달랐다. 여러 시리즈(MACD·DMI·스토캐스틱 등)나
 * 히스토그램 패인은 여기 해당하지 않고 각자의 훅을 쓴다.
 */
export const LINE_PANE_SPECS: Record<LinePaneKey, LinePaneSpec> = {
    rsi: {
        lineColor: 'rsiLine',
        referenceLines: [
            { price: RSI_OVERBOUGHT_LEVEL, color: 'rsiOverbought' },
            { price: RSI_OVERSOLD_LEVEL, color: 'rsiOversold' },
        ],
        values: i => i.rsi,
    },
    cci: {
        lineColor: 'cciLine',
        referenceLines: [
            { price: CCI_OVERBOUGHT_LEVEL, color: 'cciOverbought' },
            { price: CCI_OVERSOLD_LEVEL, color: 'cciOversold' },
            { price: CCI_ZERO_LEVEL, color: 'cciZero' },
        ],
        values: i => i.cci,
    },
    mfi: {
        lineColor: 'mfiLine',
        referenceLines: [
            { price: MFI_OVERBOUGHT_LEVEL, color: 'mfiOverbought' },
            { price: MFI_OVERSOLD_LEVEL, color: 'mfiOversold' },
        ],
        values: i => i.mfi,
    },
    williamsR: {
        lineColor: 'williamsRLine',
        referenceLines: [
            {
                price: WILLIAMS_R_OVERBOUGHT_LEVEL,
                color: 'williamsROverbought',
            },
            { price: WILLIAMS_R_OVERSOLD_LEVEL, color: 'williamsROversold' },
        ],
        values: i => i.williamsR,
    },
    connorsRsi: {
        lineColor: 'connorsRsiLine',
        referenceLines: [
            {
                price: CONNORS_RSI_OVERBOUGHT_LEVEL,
                color: 'connorsRsiOverbought',
            },
            { price: CONNORS_RSI_OVERSOLD_LEVEL, color: 'connorsRsiOversold' },
        ],
        values: i => i.connorsRsi,
    },
    cmf: {
        lineColor: 'cmfLine',
        referenceLines: [{ price: CMF_ZERO_LEVEL, color: 'cmfZero' }],
        values: i => i.cmf,
    },
    bollingerPercentB: {
        lineColor: 'bollingerPercentBLine',
        referenceLines: [
            {
                price: BOLLINGER_PERCENT_B_UPPER_LEVEL,
                color: 'bollingerPercentBUpper',
            },
            {
                price: BOLLINGER_PERCENT_B_LOWER_LEVEL,
                color: 'bollingerPercentBLower',
            },
        ],
        // bollingerDerived는 객체 배열이므로 pctB 값만 뽑는다.
        values: i => i.bollingerDerived.map(d => d.pctB),
    },
    hurst: {
        lineColor: 'hurstLine',
        referenceLines: [
            { price: HURST_RANDOM_WALK_LEVEL, color: 'hurstReference' },
        ],
        values: i => i.hurst,
    },
    varianceRatio: {
        lineColor: 'varianceRatioLine',
        referenceLines: [
            {
                price: VARIANCE_RATIO_RANDOM_WALK_LEVEL,
                color: 'varianceRatioReference',
            },
        ],
        values: i => i.varianceRatio,
    },
    macdV: {
        lineColor: 'macdVLine',
        referenceLines: [{ price: MACD_V_ZERO_LEVEL, color: 'macdVZero' }],
        values: i => i.macdV,
    },
    forceIndex: {
        lineColor: 'forceIndexLine',
        referenceLines: [
            { price: FORCE_INDEX_ZERO_LEVEL, color: 'forceIndexZero' },
        ],
        values: i => i.forceIndex,
    },
    obv: { lineColor: 'obvLine', referenceLines: [], values: i => i.obv },
    atr: { lineColor: 'atrLine', referenceLines: [], values: i => i.atr },
    yangZhang: {
        lineColor: 'yangZhangLine',
        referenceLines: [],
        values: i => i.yangZhang,
    },
    ewmaVolatility: {
        lineColor: 'ewmaVolatilityLine',
        referenceLines: [],
        values: i => i.ewmaVolatility,
    },
};
