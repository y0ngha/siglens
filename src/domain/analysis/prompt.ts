// IMPORTANT: All AI-facing prompt strings in this file must be written in English.
// Korean or other languages reduce analysis quality and consistency.

import {
    EMA_DEFAULT_PERIODS,
    EMA_SUPPORT_RESISTANCE_LONG_INDEX,
    EMA_SUPPORT_RESISTANCE_SHORT_INDEX,
    HIGH_CONFIDENCE_WEIGHT,
    MA_DEFAULT_PERIODS,
    MIN_CONFIDENCE_WEIGHT,
    RSI_DEFAULT_PERIOD,
    STOCHASTIC_K_PERIOD,
    STOCHASTIC_D_PERIOD,
    STOCHASTIC_SMOOTHING,
    STOCH_RSI_RSI_PERIOD,
    STOCH_RSI_STOCH_PERIOD,
    STOCH_RSI_K_PERIOD,
    STOCH_RSI_D_PERIOD,
    CCI_DEFAULT_PERIOD,
    ICHIMOKU_CONVERSION_PERIOD,
    ICHIMOKU_BASE_PERIOD,
    ICHIMOKU_SPAN_B_PERIOD,
    ATR_DEFAULT_PERIOD,
    WILLIAMS_R_DEFAULT_PERIOD,
    SUPERTREND_ATR_PERIOD,
    SUPERTREND_MULTIPLIER,
    MFI_DEFAULT_PERIOD,
    KELTNER_EMA_PERIOD,
    KELTNER_ATR_PERIOD,
    KELTNER_MULTIPLIER,
    CMF_DEFAULT_PERIOD,
    DONCHIAN_DEFAULT_PERIOD,
    SQUEEZE_MOMENTUM_BB_LENGTH,
    SQUEEZE_MOMENTUM_KC_LENGTH,
    SQUEEZE_MOMENTUM_KC_MULT,
    SMC_SWING_PERIOD,
} from '@/domain/indicators/constants';
import { detectCandlePattern } from '@/domain/analysis/candle';
import { getCandlePatternLabel } from '@/domain/analysis/candle-labels';
import {
    detectCandlePatternEntries,
    getDetectionBars,
    selectLastCandlePatternEntries,
    type CandlePatternEntry,
} from '@/domain/analysis/candle-detection';
import type {
    AnalysisResponse,
    Bar,
    IndicatorResult,
    Skill,
    SkillType,
    SMCResult,
    SMCZone,
    SqueezeMomentumResult,
    Timeframe,
} from '@/domain/types';

type SkillGroupKey = SkillType | 'regular';

const INDICATOR_DECIMAL_PLACES = 2;
const DATETIME_DISPLAY_LENGTH = 16;
const PERCENTAGE_FACTOR = 100;

// 타임프레임별 프롬프트 파라미터.
//
// 동일한 "bar 개수" 라 하더라도 실제 시간 지평은 타임프레임마다 크게 달라지므로,
// AI 프롬프트의 설명력과 잡음 내성을 맞추기 위해 아래 세 상수는 타임프레임 인지형
// 맵으로 관리한다.
//   - trendSampleCount:     detectTrend 슬라이스 크기. 단기(분봉)에서는 샘플이
//                           많아야 잡음에 강하고, 장기(일봉)에서는 과한 smoothing
//                           이 최근 반전을 놓치므로 작은 값을 쓴다.
//   - recentBarsCount:      프롬프트에 포함할 "최근 봉" 수 + buy/sell volume 요약
//                           구간. 단기에서는 충분한 컨텍스트를 위해 많이 보고,
//                           장기에서는 시각적/토큰 부담을 줄인다.
//   - squeezeZeroCrossLookback: Squeeze Momentum 영점 교차 탐지 lookback. 신호가
//                           의미 있는 최근 기간이 타임프레임마다 다르다.
interface PromptConfig {
    trendSampleCount: number;
    recentBarsCount: number;
    squeezeZeroCrossLookback: number;
}

const TREND_SAMPLE_COUNT_BY_TIMEFRAME: Record<Timeframe, number> = {
    '5Min': 12,
    '15Min': 10,
    '30Min': 9,
    '1Hour': 8,
    '4Hour': 7,
    '1Day': 7,
};

const RECENT_BARS_COUNT_BY_TIMEFRAME: Record<Timeframe, number> = {
    '5Min': 48,
    '15Min': 40,
    '30Min': 36,
    '1Hour': 32,
    '4Hour': 30,
    '1Day': 30,
};

const SQUEEZE_ZERO_CROSS_LOOKBACK_BY_TIMEFRAME: Record<Timeframe, number> = {
    '5Min': 24,
    '15Min': 18,
    '30Min': 14,
    '1Hour': 12,
    '4Hour': 10,
    '1Day': 10,
};

const resolvePromptConfig = (timeframe: Timeframe): PromptConfig => ({
    trendSampleCount: TREND_SAMPLE_COUNT_BY_TIMEFRAME[timeframe],
    recentBarsCount: RECENT_BARS_COUNT_BY_TIMEFRAME[timeframe],
    squeezeZeroCrossLookback:
        SQUEEZE_ZERO_CROSS_LOOKBACK_BY_TIMEFRAME[timeframe],
});

// detectTrend 의 상대 임계값 비율 (윈도 내 최대 절대값의 몇 % 를 'flat' 으로 간주할지).
const INDICATOR_TREND_THRESHOLD_RATIO = 0.01;
// detectTrend 의 절대 최소 임계값. 윈도 값이 모두 0 근처라서 ratio × maxAbs 가
// 0 에 수렴하는 경우(예: MACD histogram, CCI, CMF 의 영점 교차 구간) 잡음이
// 'rising'/'falling' 으로 오분류되는 것을 방지한다.
const INDICATOR_TREND_MIN_THRESHOLD = 1e-8;

const SMC_MAX_ORDER_BLOCKS = 5;
const SMC_MAX_FAIR_VALUE_GAPS = 5;
const SMC_MAX_STRUCTURE_BREAKS = 3;
const SMC_MAX_EQUAL_LEVELS = 3;
const SMC_MAX_SWING_POINTS = 5;

const TIMEFRAME_LABEL: Record<Timeframe, string> = {
    '5Min': '5-Minute',
    '15Min': '15-Minute',
    '30Min': '30-Minute',
    '1Hour': '1-Hour',
    '4Hour': '4-Hour',
    '1Day': 'Daily',
};

const TIMEFRAME_CONTEXT: Record<Timeframe, string> = {
    '5Min': 'Short-term chart. Combine indicator signals with volume confirmation before acting.',
    '15Min': 'Intraday chart. Indicator signals have moderate reliability.',
    '30Min':
        'Intraday chart. Good for identifying intraday trends and momentum shifts. Signals carry more weight than 5/15-minute charts.',
    '1Hour':
        'Medium-term chart. Divergences and pattern completions carry meaningful weight.',
    '4Hour':
        'Swing trading chart. Signals are reliable for multi-day trends. Divergences and breakouts are actionable.',
    '1Day': 'Daily chart. Indicator signals have high reliability. Overbought/oversold, divergences, and pattern completions are significant.',
};

type IndicatorTrend = 'rising' | 'falling' | 'flat';

const detectTrend = (
    values: (number | null)[],
    sampleCount: number
): IndicatorTrend | null => {
    const nonNull = values
        .slice(-sampleCount)
        .filter((v): v is number => v !== null);
    if (nonNull.length < 2) return null;

    // 선형 회귀 slope 로 추세 방향을 판정한다. 첫/마지막 값만 비교하면 단일
    // 극단치(whipsaw) 에 추세가 좌우되지만, slope 는 윈도 내 모든 값을 반영하여
    // 잡음에 견고하다. windowSpan = slope × (n - 1) 은 fitted line 이 윈도 전체에
    // 걸쳐 움직인 총 변화량이며, 임계값과 같은 단위로 비교 가능하다.
    const n = nonNull.length;
    const xMean = (n - 1) / 2;
    const yMean = nonNull.reduce((sum, v) => sum + v, 0) / n;
    const numerator = nonNull.reduce(
        (sum, v, i) => sum + (i - xMean) * (v - yMean),
        0
    );
    const denominator = nonNull.reduce(
        (sum, _, i) => sum + (i - xMean) ** 2,
        0
    );
    if (denominator === 0) return 'flat';
    const windowSpan = (numerator / denominator) * (n - 1);

    // 임계값은 윈도 내 최대 절대값을 기준으로 설정한다. 이렇게 하면
    // MACD histogram, CCI, CMF 처럼 0 근처를 교차하는 지표에서도 잡음이
    // 무조건 'rising'/'falling' 으로 분류되지 않고, 지표의 실제 스케일에
    // 비례한 안정적인 임계값이 적용된다.
    const windowMaxAbs = nonNull.reduce(
        (max, v) => Math.max(max, Math.abs(v)),
        0
    );
    const threshold = Math.max(
        windowMaxAbs * INDICATOR_TREND_THRESHOLD_RATIO,
        INDICATOR_TREND_MIN_THRESHOLD
    );
    if (windowSpan > threshold) return 'rising';
    if (windowSpan < -threshold) return 'falling';
    return 'flat';
};

type PatternEntryType = 'single' | 'multi';

interface PromptCandlePatternEntry {
    barsAgo: number;
    patternType: PatternEntryType;
    patternName: string;
}

const fmt = (n: number | null): string =>
    n === null ? 'N/A' : n.toFixed(INDICATOR_DECIMAL_PLACES);

const formatVolume = (n: number): string =>
    Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const lastNonNull = (arr: (number | null)[]): number | null =>
    [...arr].reverse().find((v): v is number => v !== null) ?? null;

const lastOf = <T>(arr: T[]): T | null =>
    arr.length > 0 ? arr[arr.length - 1] : null;

const formatMarketSection = (bars: Bar[]): string => {
    if (bars.length === 0) {
        return [
            '## Current Market Status',
            '- Current Price: N/A',
            '- Price Change %: N/A',
            '- Volume: N/A',
        ].join('\n');
    }

    const last = bars[bars.length - 1];
    const prev = bars.length > 1 ? bars[bars.length - 2] : null;
    const changeRate =
        prev !== null
            ? `${(((last.close - prev.close) / prev.close) * 100).toFixed(INDICATOR_DECIMAL_PLACES)}%`
            : 'N/A';

    return [
        '## Current Market Status',
        `- Current Price: ${fmt(last.close)}`,
        `- Price Change %: ${changeRate}`,
        `- Volume: ${formatVolume(last.volume)}`,
    ].join('\n');
};

const formatLongTermContext = (bars: Bar[]): string => {
    if (bars.length === 0) {
        return ['## Long-term Context', '- No data available'].join('\n');
    }

    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);
    const periodHigh = Math.max(...highs);
    const periodLow = Math.min(...lows);
    const firstClose = bars[0].close;
    const lastClose = bars[bars.length - 1].close;
    const periodReturn =
        firstClose > 0
            ? ((lastClose - firstClose) / firstClose) * PERCENTAGE_FACTOR
            : 0;

    return [
        `## Long-term Context (${bars.length} bars total)`,
        `- Period High: ${fmt(periodHigh)}`,
        `- Period Low: ${fmt(periodLow)}`,
        `- Price Range: ${fmt(periodHigh)} ~ ${fmt(periodLow)}`,
        `- Period Return: ${periodReturn.toFixed(INDICATOR_DECIMAL_PLACES)}%`,
        `- Current vs High: ${((lastClose / periodHigh) * PERCENTAGE_FACTOR).toFixed(INDICATOR_DECIMAL_PLACES)}%`,
        `- Current vs Low: ${((lastClose / periodLow) * PERCENTAGE_FACTOR).toFixed(INDICATOR_DECIMAL_PLACES)}%`,
    ].join('\n');
};

const formatBarRow = (bar: Bar): string => {
    const datetime = new Date(bar.time * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, DATETIME_DISPLAY_LENGTH);
    const pattern = detectCandlePattern(bar);
    return `[ts:${bar.time}] ${datetime} | O:${fmt(bar.open)} H:${fmt(bar.high)} L:${fmt(bar.low)} C:${fmt(bar.close)} V:${formatVolume(bar.volume)} [${getCandlePatternLabel(pattern)}]`;
};

const buildCandlePatternEntries = (bars: Bar[]): PromptCandlePatternEntry[] => {
    const entries = detectCandlePatternEntries(bars);
    const detectionBars = getDetectionBars(bars);
    const totalBars = detectionBars.length;
    const lastEntries = selectLastCandlePatternEntries(entries);

    return lastEntries
        .map((entry: CandlePatternEntry) => ({
            barsAgo: totalBars - 1 - entry.barIndex,
            patternType: entry.patternType,
            patternName:
                entry.patternType === 'multi'
                    ? entry.multiPattern
                    : entry.singlePattern,
        }))
        .sort(
            (a: PromptCandlePatternEntry, b: PromptCandlePatternEntry) =>
                b.barsAgo - a.barsAgo
        );
};

const formatPatternEntry = (entry: PromptCandlePatternEntry): string =>
    `- [${entry.barsAgo} bars ago] ${entry.patternType === 'single' ? 'Single candle pattern' : 'Multi-candle pattern'}: ${entry.patternName}`;

const formatRecentBarsSection = (
    bars: Bar[],
    recentBarsCount: number
): string => {
    const recentBars = bars.slice(-recentBarsCount);

    if (recentBars.length === 0) {
        return ['## Recent Bar Data', '- No data available'].join('\n');
    }

    const patternEntries = buildCandlePatternEntries(bars);

    return [
        `## Recent Bar Data (Last ${recentBars.length} bars)`,
        'Format: Date/Time(UTC) | O:Open H:High L:Low C:Close V:Volume [CandlePattern]',
        ...recentBars.map(formatBarRow),
        ...(patternEntries.length > 0
            ? [
                  `## Detected Candle Patterns (Short-term Trend Signal)`,
                  'These patterns represent the most recent candle formation and should be interpreted as short-term trend signals.',
                  ...patternEntries.map(formatPatternEntry),
              ]
            : []),
    ].join('\n');
};

const formatBuySellVolumeSection = (
    indicators: IndicatorResult,
    recentBarsCount: number
): string => {
    const recentBuySell = indicators.buySellVolume.slice(-recentBarsCount);

    if (recentBuySell.length === 0) {
        return ['## Volume Analysis', '- No data available'].join('\n');
    }

    const { totalBuy, totalSell } = recentBuySell.reduce(
        (acc, v) => ({
            totalBuy: acc.totalBuy + v.buyVolume,
            totalSell: acc.totalSell + v.sellVolume,
        }),
        { totalBuy: 0, totalSell: 0 }
    );
    const totalVolume = totalBuy + totalSell;
    const buyRatio =
        totalVolume > 0 ? (totalBuy / totalVolume) * PERCENTAGE_FACTOR : 0;
    const sellRatio =
        totalVolume > 0 ? (totalSell / totalVolume) * PERCENTAGE_FACTOR : 0;

    const last = lastOf(recentBuySell)!;
    const lastTotal = last.buyVolume + last.sellVolume;
    const lastBuyRatio =
        lastTotal > 0 ? (last.buyVolume / lastTotal) * PERCENTAGE_FACTOR : 0;

    return [
        '## Volume Analysis (Buy/Sell)',
        `- Current bar: Buy ${formatVolume(last.buyVolume)} / Sell ${formatVolume(last.sellVolume)} (Buy ratio: ${lastBuyRatio.toFixed(INDICATOR_DECIMAL_PLACES)}%)`,
        `- Last ${recentBuySell.length}-bar cumulative: Buy ${formatVolume(totalBuy)} (${buyRatio.toFixed(INDICATOR_DECIMAL_PLACES)}%) / Sell ${formatVolume(totalSell)} (${sellRatio.toFixed(INDICATOR_DECIMAL_PLACES)}%)`,
    ].join('\n');
};

const trendLabel = (trend: IndicatorTrend | null): string =>
    trend === null ? '' : ` [${trend}]`;

const sqzStateLabel = (r: SqueezeMomentumResult): string => {
    if (r.sqzOn) return 'squeeze ON';
    if (r.sqzOff) return 'squeeze OFF';
    return 'no squeeze';
};

const sqzDirectionLabel = (r: SqueezeMomentumResult): string => {
    if (r.increasing === null) return '';
    return r.increasing ? ' [rising]' : ' [falling]';
};

const countSqueezeDuration = (data: SqueezeMomentumResult[]): number => {
    let count = 0;
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].sqzOn !== true) break;
        count++;
    }
    return count;
};

interface ZeroCross {
    direction: 'bullish_cross' | 'bearish_cross';
    barsAgo: number;
}

const detectZeroCross = (
    data: SqueezeMomentumResult[],
    lookback: number
): ZeroCross | null => {
    const len = data.length;
    const start = Math.max(0, len - lookback);
    for (let i = len - 1; i > start; i--) {
        const curr = data[i].momentum;
        const prev = data[i - 1].momentum;
        if (curr === null || prev === null) continue;
        if (prev <= 0 && curr > 0)
            return { direction: 'bullish_cross', barsAgo: len - 1 - i };
        if (prev >= 0 && curr < 0)
            return { direction: 'bearish_cross', barsAgo: len - 1 - i };
    }
    return null;
};

const formatSqueezeMomentumLine = (
    indicators: IndicatorResult,
    config: PromptConfig
): string => {
    const data = indicators.squeezeMomentum;
    const last = lastOf(data);
    if (!last || last.momentum === null) {
        return `- Squeeze Momentum(BB:${SQUEEZE_MOMENTUM_BB_LENGTH},KC:${SQUEEZE_MOMENTUM_KC_LENGTH},mult:${SQUEEZE_MOMENTUM_KC_MULT}): N/A`;
    }

    const momentumTrend = detectTrend(
        data.map(d => d.momentum),
        config.trendSampleCount
    );
    const duration = countSqueezeDuration(data);
    const durationStr = duration > 0 ? ` / duration: ${duration} bars` : '';
    const cross = detectZeroCross(data, config.squeezeZeroCrossLookback);
    const crossStr =
        cross !== null
            ? ` / ${cross.direction === 'bullish_cross' ? 'bullish' : 'bearish'} zero-cross (${cross.barsAgo} bars ago)`
            : '';

    return `- Squeeze Momentum(BB:${SQUEEZE_MOMENTUM_BB_LENGTH},KC:${SQUEEZE_MOMENTUM_KC_LENGTH},mult:${SQUEEZE_MOMENTUM_KC_MULT}): momentum ${fmt(last.momentum)}${sqzDirectionLabel(last)}${trendLabel(momentumTrend)} / ${sqzStateLabel(last)}${durationStr}${crossStr}`;
};

const barsAgo = (index: number, totalBars: number): string =>
    `(${totalBars - 1 - index} bars ago)`;

// When adding a new field to SMCResult, update this check accordingly.
const isSMCEmpty = (smc: SMCResult): boolean =>
    smc.swingHighs.length === 0 &&
    smc.swingLows.length === 0 &&
    smc.structureBreaks.length === 0 &&
    smc.orderBlocks.length === 0 &&
    smc.fairValueGaps.length === 0 &&
    smc.equalHighs.length === 0 &&
    smc.equalLows.length === 0 &&
    smc.premiumZone === null &&
    smc.discountZone === null &&
    smc.equilibriumZone === null;

const formatZoneLine = (zone: SMCZone | null, label: string): string | null =>
    zone !== null ? `- ${label}: ${fmt(zone.low)} ~ ${fmt(zone.high)}` : null;

// Priority: premium > discount > equilibrium (most actionable first).
// Note: premium/discount checks use only one bound (>= low / <= high) intentionally.
// In SMC theory, price above the premium zone is still "premium territory" (overextended),
// and price below the discount zone is still "discount territory". The zone marks a threshold,
// not a boundary — price beyond the far edge remains classified in that territory.
const classifyPriceZone = (
    price: number,
    premium: SMCZone | null,
    discount: SMCZone | null,
    equilibrium: SMCZone | null
): string => {
    if (premium !== null && price >= premium.low) return 'premium';
    if (discount !== null && price <= discount.high) return 'discount';
    if (
        equilibrium !== null &&
        price >= equilibrium.low &&
        price <= equilibrium.high
    )
        return 'equilibrium';
    return 'neutral';
};

const formatSMCSection = (indicators: IndicatorResult, bars: Bar[]): string => {
    const smc = indicators.smc;

    if (isSMCEmpty(smc)) {
        return [
            '## Smart Money Concepts (SMC)',
            '- Insufficient data for SMC analysis',
        ].join('\n');
    }

    const totalBars = bars.length;
    const currentPrice = totalBars > 0 ? bars[totalBars - 1].close : null;

    // 1. Market Structure (BOS / CHoCH)
    const recentBreaks = smc.structureBreaks.slice(-SMC_MAX_STRUCTURE_BREAKS);
    const structureSection =
        recentBreaks.length > 0
            ? [
                  '### Market Structure',
                  ...recentBreaks.map(
                      b =>
                          `- [${b.breakType.toUpperCase()}] ${b.type} at ${fmt(b.price)} ${barsAgo(b.index, totalBars)}`
                  ),
              ]
            : [];

    // 2. Active Order Blocks (unmitigated only)
    const activeOBs = smc.orderBlocks
        .filter(ob => !ob.isMitigated)
        .slice(-SMC_MAX_ORDER_BLOCKS);
    const orderBlockSection = [
        '### Order Blocks',
        ...(activeOBs.length > 0
            ? activeOBs.map(
                  ob =>
                      `- ${ob.type} OB: ${fmt(ob.low)} ~ ${fmt(ob.high)} ${barsAgo(ob.startIndex, totalBars)}`
              )
            : ['- No active order blocks']),
    ];

    // 3. Active Fair Value Gaps (unmitigated only)
    const activeFVGs = smc.fairValueGaps
        .filter(fvg => !fvg.isMitigated)
        .slice(-SMC_MAX_FAIR_VALUE_GAPS);
    const fvgSection = [
        '### Fair Value Gaps',
        ...(activeFVGs.length > 0
            ? activeFVGs.map(
                  fvg =>
                      `- ${fvg.type} FVG: ${fmt(fvg.low)} ~ ${fmt(fvg.high)} ${barsAgo(fvg.index, totalBars)}`
              )
            : ['- No active fair value gaps']),
    ];

    // 4. Equal Highs / Equal Lows (Liquidity Pools)
    const eqHighs = smc.equalHighs.slice(-SMC_MAX_EQUAL_LEVELS);
    const eqLows = smc.equalLows.slice(-SMC_MAX_EQUAL_LEVELS);
    const liquiditySection =
        eqHighs.length > 0 || eqLows.length > 0
            ? [
                  '### Liquidity Pools',
                  ...eqHighs.map(
                      eq =>
                          `- Equal Highs at ${fmt(eq.price)} (sell-side liquidity)`
                  ),
                  ...eqLows.map(
                      eq =>
                          `- Equal Lows at ${fmt(eq.price)} (buy-side liquidity)`
                  ),
              ]
            : [];

    // 5. Premium / Discount / Equilibrium Zones
    const premiumLine = formatZoneLine(smc.premiumZone, 'Premium Zone');
    const equilibriumLine = formatZoneLine(
        smc.equilibriumZone,
        'Equilibrium Zone'
    );
    const discountLine = formatZoneLine(smc.discountZone, 'Discount Zone');
    const zoneLines = [premiumLine, equilibriumLine, discountLine].filter(
        (l): l is string => l !== null
    );
    const currentPriceLine =
        currentPrice !== null
            ? [
                  `- Current price (${fmt(currentPrice)}) is in ${classifyPriceZone(currentPrice, smc.premiumZone, smc.discountZone, smc.equilibriumZone)} zone`,
              ]
            : [];
    const marketZonesSection =
        zoneLines.length > 0
            ? ['### Market Zones', ...zoneLines, ...currentPriceLine]
            : [];

    // 6. Recent Swing Points
    const recentSwingHighs = smc.swingHighs.slice(-SMC_MAX_SWING_POINTS);
    const recentSwingLows = smc.swingLows.slice(-SMC_MAX_SWING_POINTS);
    const swingSection =
        recentSwingHighs.length > 0 || recentSwingLows.length > 0
            ? [
                  `### Swing Points (period: ${SMC_SWING_PERIOD})`,
                  ...recentSwingHighs.map(
                      s =>
                          `- Swing High: ${fmt(s.price)} ${barsAgo(s.index, totalBars)}`
                  ),
                  ...recentSwingLows.map(
                      s =>
                          `- Swing Low: ${fmt(s.price)} ${barsAgo(s.index, totalBars)}`
                  ),
              ]
            : [];

    return [
        '## Smart Money Concepts (SMC)',
        ...structureSection,
        ...orderBlockSection,
        ...fvgSection,
        ...liquiditySection,
        ...marketZonesSection,
        ...swingSection,
    ].join('\n');
};

const formatIndicatorSection = (
    indicators: IndicatorResult,
    config: PromptConfig
): string => {
    const lastRSI = lastNonNull(indicators.rsi);
    const lastMACD = lastOf(indicators.macd);
    const lastBollinger = lastOf(indicators.bollinger);
    const lastDMI = lastOf(indicators.dmi);
    const lastStochastic = lastOf(indicators.stochastic);
    const lastStochRSI = lastOf(indicators.stochRsi);
    const lastCCI = lastNonNull(indicators.cci);
    const lastVWAP = lastNonNull(indicators.vwap);
    const vp = indicators.volumeProfile;
    const lastIchimoku = lastOf(indicators.ichimoku);
    const lastATR = lastNonNull(indicators.atr);
    const lastOBV = lastNonNull(indicators.obv);
    const lastPSAR = lastOf(indicators.parabolicSar);
    const lastWilliamsR = lastNonNull(indicators.williamsR);
    const lastSupertrend = lastOf(indicators.supertrend);
    const lastMFI = lastNonNull(indicators.mfi);
    const lastKeltner = lastOf(indicators.keltnerChannel);
    const lastCMF = lastNonNull(indicators.cmf);
    const lastDonchian = lastOf(indicators.donchianChannel);

    const sampleCount = config.trendSampleCount;
    const rsiTrend = detectTrend(indicators.rsi, sampleCount);
    const cciTrend = detectTrend(indicators.cci, sampleCount);
    const macdTrend = detectTrend(
        indicators.macd.map(m => m.histogram ?? null),
        sampleCount
    );
    const atrTrend = detectTrend(indicators.atr, sampleCount);
    const obvTrend = detectTrend(indicators.obv, sampleCount);
    const mfiTrend = detectTrend(indicators.mfi, sampleCount);
    const cmfTrend = detectTrend(indicators.cmf, sampleCount);

    return [
        '## Indicator Values',
        `- RSI(${RSI_DEFAULT_PERIOD}): ${fmt(lastRSI)}${trendLabel(rsiTrend)}`,
        `- MACD: ${fmt(lastMACD?.macd ?? null)} / Signal ${fmt(lastMACD?.signal ?? null)} / Histogram ${fmt(lastMACD?.histogram ?? null)}${trendLabel(macdTrend)}`,
        `- Bollinger Bands: Upper ${fmt(lastBollinger?.upper ?? null)} / Middle ${fmt(lastBollinger?.middle ?? null)} / Lower ${fmt(lastBollinger?.lower ?? null)}`,
        `- DMI: +DI ${fmt(lastDMI?.diPlus ?? null)} / -DI ${fmt(lastDMI?.diMinus ?? null)} / ADX ${fmt(lastDMI?.adx ?? null)}`,
        `- Stochastic(${STOCHASTIC_K_PERIOD},${STOCHASTIC_D_PERIOD},${STOCHASTIC_SMOOTHING}): %K ${fmt(lastStochastic?.percentK ?? null)} / %D ${fmt(lastStochastic?.percentD ?? null)}`,
        `- StochRSI(${STOCH_RSI_RSI_PERIOD},${STOCH_RSI_STOCH_PERIOD},${STOCH_RSI_K_PERIOD},${STOCH_RSI_D_PERIOD}): K ${fmt(lastStochRSI?.k ?? null)} / D ${fmt(lastStochRSI?.d ?? null)}`,
        `- CCI(${CCI_DEFAULT_PERIOD}): ${fmt(lastCCI)}${trendLabel(cciTrend)}`,
        `- VWAP: ${fmt(lastVWAP)}`,
        `- Volume Profile: POC ${fmt(vp?.poc ?? null)} / VAH ${fmt(vp?.vah ?? null)} / VAL ${fmt(vp?.val ?? null)}`,
        `- MA: ${MA_DEFAULT_PERIODS.map(p => `MA(${p}): ${fmt(lastNonNull(indicators.ma[p] ?? []))}`).join(' / ')}`,
        `- EMA: ${EMA_DEFAULT_PERIODS.map(p => `EMA(${p}): ${fmt(lastNonNull(indicators.ema[p] ?? []))}`).join(' / ')}`,
        `- Ichimoku(${ICHIMOKU_CONVERSION_PERIOD},${ICHIMOKU_BASE_PERIOD},${ICHIMOKU_SPAN_B_PERIOD}): Tenkan ${fmt(lastIchimoku?.tenkan ?? null)} / Kijun ${fmt(lastIchimoku?.kijun ?? null)} / SpanA ${fmt(lastIchimoku?.senkouA ?? null)} / SpanB ${fmt(lastIchimoku?.senkouB ?? null)} / Chikou ${fmt(lastIchimoku?.chikou ?? null)}`,
        `- ATR(${ATR_DEFAULT_PERIOD}): ${fmt(lastATR)}${trendLabel(atrTrend)}`,
        `- OBV: ${lastOBV !== null ? formatVolume(lastOBV) : 'N/A'}${trendLabel(obvTrend)}`,
        `- Parabolic SAR: ${fmt(lastPSAR?.sar ?? null)} (${lastPSAR?.trend ?? 'N/A'})`,
        `- Williams %R(${WILLIAMS_R_DEFAULT_PERIOD}): ${fmt(lastWilliamsR)}`,
        `- Supertrend(${SUPERTREND_ATR_PERIOD},${SUPERTREND_MULTIPLIER}): ${fmt(lastSupertrend?.supertrend ?? null)} (${lastSupertrend?.trend ?? 'N/A'})`,
        `- MFI(${MFI_DEFAULT_PERIOD}): ${fmt(lastMFI)}${trendLabel(mfiTrend)}`,
        `- Keltner Channel(${KELTNER_EMA_PERIOD},${KELTNER_ATR_PERIOD},${KELTNER_MULTIPLIER}): Upper ${fmt(lastKeltner?.upper ?? null)} / Middle ${fmt(lastKeltner?.middle ?? null)} / Lower ${fmt(lastKeltner?.lower ?? null)}`,
        `- CMF(${CMF_DEFAULT_PERIOD}): ${fmt(lastCMF)}${trendLabel(cmfTrend)}`,
        `- Donchian Channel(${DONCHIAN_DEFAULT_PERIOD}): Upper ${fmt(lastDonchian?.upper ?? null)} / Middle ${fmt(lastDonchian?.middle ?? null)} / Lower ${fmt(lastDonchian?.lower ?? null)}`,
        formatSqueezeMomentumLine(indicators, config),
    ].join('\n');
};

const confidenceLabel = (weight: number): string =>
    weight >= HIGH_CONFIDENCE_WEIGHT
        ? '[High Confidence]'
        : '[Medium Confidence]';

const buildSkillBlock = (skill: Skill): string =>
    `### ${skill.name} ${confidenceLabel(skill.confidenceWeight)}\n${skill.content}`;

/**
 * Defines the JSON schema example for all keys of AnalysisResponse.
 * The Record<keyof AnalysisResponse, string> type enforces compile-time synchronization
 * with AnalysisResponse — changes to the interface will produce a compile error here.
 */
const ANALYSIS_RESPONSE_SCHEMA: Record<keyof AnalysisResponse, string> = {
    summary:
        '"A comprehensive, accessible summary that synthesizes ALL findings (indicators, patterns, volume profile, skills, strategies) into plain language a non-technical user can understand. Instead of stating raw indicator values, explain their practical meaning (e.g., instead of RSI is overbought at 75, say the stock has risen quickly and may be due for a pause). Answer: What is happening with this stock and what does it mean for the investor? Use \\n to separate each topic."',
    trend: '"bullish | bearish | neutral"',
    indicatorResults:
        '[{ "indicatorName": "RSI Signal Guide", "signals": [{ "type": "skill", "description": "RSI 72.5 — 과매수 임계선에 근접, 단기 조정 가능", "strength": "strong | moderate | weak", "trend": "bullish | bearish | neutral" }] }]',
    riskLevel: '"low | medium | high"',
    keyLevels:
        '{ "support": [{ "price": 150.00, "reason": "..." }], "resistance": [{ "price": 160.00, "reason": "..." }], "poc": { "price": 155.00, "reason": "..." } }',
    priceTargets:
        '{ "bullish": { "targets": [{ "price": 165.00, "basis": "..." }], "condition": "..." }, "bearish": { "targets": [{ "price": 145.00, "basis": "..." }], "condition": "..." } }',
    patternSummaries:
        // Only chart patterns defined in skills/*.md. Candle patterns go in candlePatterns.
        '[{ "patternName": "...", "skillName": "...", "detected": true, "trend": "bullish | bearish | neutral", "summary": "...", "keyPrices": [{ "label": "넥라인", "price": 150.00 }], "patternLines": [{ "label": "상단 추세선", "start": { "time": 1700000000, "price": 155.00 }, "end": { "time": 1700100000, "price": 152.00 } }, { "label": "하단 추세선", "start": { "time": 1700000000, "price": 148.00 }, "end": { "time": 1700100000, "price": 146.00 } }], "timeRange": { "start": 1700000000, "end": 1700100000 } }]',
    strategyResults:
        '[{ "strategyName": "...", "trend": "bullish | bearish | neutral (REQUIRED — never omit)", "summary": "..." }]',
    candlePatterns:
        // Only candle patterns detected from bar data. Skills patterns go in patternSummaries.
        '[{ "patternName": "three_outside_down", "detected": true, "trend": "bearish", "summary": "..." }]',
    trendlines:
        '[{ "direction": "ascending | descending", "start": { "time": 1700000000, "price": 150.00 }, "end": { "time": 1700100000, "price": 155.00 } }]',
    actionRecommendation:
        '{ "positionAnalysis": "Current price position vs support/resistance analysis (long position perspective)", "entry": "Long (buy) entry strategy with specific price ranges", "exit": "Long position exit strategy: take-profit targets and stop-loss price ranges", "riskReward": "Risk-reward ratio for the long position (e.g., stop-loss 3% vs target 9% → risk:reward = 1:3)", "entryRecommendation": "enter | wait | avoid", "entryPrices": [165.00, 167.00], "stopLoss": 160.00, "takeProfitPrices": [180.00, 195.00] }',
};

const ANALYSIS_INTENT_BLOCK = [
    '## Analysis Intent',
    '- Analyze the symbol below using ONLY the provided data. Do not fabricate prices, indicators, or patterns.',
    '- Output a single JSON object matching the schema at the bottom.',
].join('\n');

const SCHEMA_PREFACE =
    'Schema (field types and example shapes — DO NOT copy example numbers; compute every value from the actual data above):';

const buildSchemaBody = (): string => {
    const entries = Object.entries(ANALYSIS_RESPONSE_SCHEMA)
        .map(([key, value]) => `  "${key}": ${value}`)
        .join(',\n');
    return `{\n${entries}\n}`;
};

const ANALYSIS_GUIDELINES = [
    '## Analysis Guidelines',
    '',
    '### Name Field Matching',
    '- skillName, strategyName, and indicatorName MUST exactly match a skill name from Writing Rules below. Copy verbatim — never translate, abbreviate, or use empty strings. Omit the entry if no matching skill exists.',
    '',
    '### Regular Skills Usage',
    '- Skills shown in ## Active Skills are context-only regular skills without a dedicated structured output field.',
    '- Use them only to enrich the summary with additional interpretation or market context when they are relevant.',
    '- Do not create new top-level fields for regular skills, and do not force them into indicatorResults, patternSummaries, strategyResults, candlePatterns, or keyLevels unless another explicit rule already applies.',
    '',
    '### Candle Patterns vs Chart Patterns',
    '- candlePatterns: Only include candle patterns (single/multi candle) detected from bar data. Chart patterns defined in skills/*.md go in patternSummaries.',
    '- patternSummaries: Only include chart patterns defined in skills/*.md. Candle patterns go in candlePatterns.',
    '',
    '### keyPrices Rules',
    '- keyPrices must only contain actual price levels (numbers that represent a price, e.g. 150.00). Do NOT include bar indices, counts, or any non-price numeric values.',
    '- All label values in keyPrices must be written in Korean (e.g. "상단 추세선", "하단 추세선", "넥라인", "목표가", "손절선"). Never use English or snake_case identifiers.',
    '',
    '### Support/Resistance Assessment',
    `- Check convergence points of moving averages (MA ${MA_DEFAULT_PERIODS.join(',')}, EMA ${EMA_DEFAULT_PERIODS[EMA_SUPPORT_RESISTANCE_SHORT_INDEX]}/${EMA_DEFAULT_PERIODS[EMA_SUPPORT_RESISTANCE_LONG_INDEX]}) first`,
    '- Use Volume Profile levels: POC is the strongest support/resistance, VAH/VAL mark the boundaries of the value area',
    '- Price returning to POC indicates a high-probability reaction zone; breakouts above VAH or below VAL signal potential trend continuation',
    '- Treat high/low of high-volume bars as supply/demand zones',
    '- Reference prior swing highs/lows and Bollinger Band boundaries',
    '- Each level must include a reason',
    '',
    '### Price Target Calculation',
    '- Apply the measured move rule (project pattern height) for detected patterns',
    '- First target: nearest support/resistance; second target: based on pattern measurement',
    '- State the trigger condition (breakout/breakdown reference level) for each scenario',
    '- Strengthen target viability with supporting indicators (RSI extremes, Bollinger Band touch, MACD trend)',
    '- Sort targets by proximity to current price: bullish targets in ascending price order (closest first), bearish targets in descending price order (closest first). Never return targets in arbitrary order.',
    '- Every target MUST include a non-empty basis explaining the rationale (supporting indicator, pattern measurement, swing level, etc.). If a basis cannot be provided, exclude that target entirely instead of returning it with an empty basis.',
    '',
    '### Trendline Detection',
    '- Return 0 to 3 trendlines maximum',
    '- ascending: connect higher lows (at least 2 clear swing low points)',
    '- descending: connect lower highs (at least 2 clear swing high points)',
    '- Use the Unix timestamp values from the provided bar data for the time field. Each bar row begins with [ts:<unix_timestamp>] — copy this exact integer value into the time field. Do not calculate or guess timestamps.',
    '- Only include a trendline when 2 or more clear swing points are identifiable',
    '- If no clear trendlines exist, return an empty array',
    '',
    '### trendlines vs patternLines',
    '- trendlines: Overall price trendlines visible on the full chart (ascending support / descending resistance). These are independent of any specific pattern.',
    '- patternLines (inside patternSummaries): Structural lines that define a specific pattern (e.g. wedge upper/lower boundaries, neckline). These belong to a particular pattern and are rendered as part of that pattern overlay.',
    '- Do not duplicate a trendline in patternLines or vice versa.',
    '',
    // NOTE: Individual indicator interpretation guidelines (ATR, OBV, Parabolic SAR, Supertrend,
    // MFI, Williams %R, Keltner, CMF, Donchian, SMC, Squeeze Momentum) are intentionally omitted here
    // because they are already covered in detail by the corresponding indicator_guide skills
    // (all have confidence_weight >= 0.75 and are always injected into the prompt).
    // If any indicator guide skill drops below MIN_CONFIDENCE_WEIGHT, restore its guideline here.
    '',
    '### Confluence Assessment',
    '- Confluence = 2+ independent signals pointing the same direction at the same price zone.',
    '- Count confirming signals from different categories: (a) trend indicators, (b) momentum oscillators, (c) volume indicators, (d) pattern detection, (e) SMC/structure levels, (f) support/resistance tools.',
    '- Strong confluence: 3+ categories agree. Moderate: 2 categories. Weak: single indicator.',
    '- State the confluence count in keyLevels reasoning and in the summary.',
    '',
    '### Conflicting Signals',
    '- When indicators give conflicting signals (e.g. RSI overbought but MACD bullish cross), list each signal individually and then state which side has stronger confluence.',
    '- Weight signals by the number of confirming indicators and the strength of each signal.',
    '- Mention the conflict explicitly in the summary so the user understands the mixed picture.',
    '',
    '### Summary Writing Checklist (follow every step)',
    '1. STATE the overall trend direction and strength in plain language.',
    '2. SUMMARIZE key indicator findings — explain practical meaning, not raw values (e.g., "주가가 빠르게 상승하여 단기 조정 가능성이 있습니다" not "RSI is 75").',
    '3. REPORT detected chart/candle patterns and what they typically predict.',
    '4. INCLUDE strategy conclusions — for each strategy in strategyResults, state its finding (e.g., MACD/MA cycle stage, divergence detection result, mean reversion signal, breakout setup, Fibonacci level, Elliott wave position). If a strategy contradicts the dominant trend, explicitly state the conflict.',
    '5. DESCRIBE key support/resistance levels and their significance.',
    '6. ASSESS risk — warning signs and what could go wrong.',
    '7. CONCLUDE: "What is happening with this stock and what does it mean for the investor?"',
    '- Use \\n between each topic. Never write a single long paragraph.',
    '- If signals conflict, state the mixed picture and which side has stronger confluence.',
    '',
    '### Action Recommendation Decision Tree',
    '- LONG POSITION ONLY. Never generate short (sell) strategies, entry points, stop-loss, or take-profit for short positions.',
    '- actionRecommendation must be consistent with keyLevels and priceTargets. Use those values directly.',
    '- Step 1 — Determine entryRecommendation:',
    '  - "enter": price near support + bullish confluence from 2+ categories + risk level not high',
    '  - "wait": setup forming but not confirmed (approaching key level, awaiting breakout, mixed signals)',
    '  - "avoid": price extended from support, strong resistance overhead, risk high, or bearish confluence dominates',
    '- Step 2 — Compute prices (REQUIRED for "enter" and "wait"; empty ONLY for "avoid"):',
    '  - entryPrices: [low, high] range near support. Must match the entry text field exactly.',
    '  - stopLoss: single number below nearest support. Must match the exit text field exactly.',
    '  - takeProfitPrices: ascending order (lowest first). Must match the exit text field exactly.',
    '- Step 3 — Write text fields in plain Korean:',
    '  - positionAnalysis: current price position vs keyLevels (support, resistance, POC)',
    '  - entry: specific long buy price ranges with reasoning. Always provide specific prices, not vague descriptions.',
    '  - exit: take-profit targets (referencing priceTargets.bullish / resistance) + stop-loss (referencing support below entry)',
    '  - riskReward: ratio calculation (e.g., "손절 3% vs 목표 9% → 위험:보상 = 1:3")',
    '- Consistency: entryPrices, stopLoss, takeProfitPrices must numerically match the text in entry/exit fields — they are the same prices in structured form for chart rendering.',
    '',
    '### Insufficient Data',
    '- If bar data is too short to reliably calculate an indicator or detect a pattern, state "데이터 부족" rather than guessing.',
    '- Do not fabricate support/resistance levels or patterns when the data does not clearly support them.',
].join('\n');

const CRITICAL_RESPONSE_RULES = [
    '',
    '### Critical Response Rules',
    '- For array fields that have no results, return an empty array []. Never return null or omit the field.',
    '- For optional object fields (poc in keyLevels, actionRecommendation), provide the full object or omit the field entirely. Never set to null.',
    '- Array elements must be valid objects. Never include null or undefined inside arrays.',
    '- All numeric price values must be plain numbers (e.g., 150.25), not strings.',
    '- All Unix timestamp values must be integers copied verbatim from the [ts:<number>] markers in the bar data.',
].join('\n');

const buildAnalysisRequest = (
    patternSkills: Skill[],
    strategySkills: Skill[],
    indicatorGuideSkills: Skill[],
    candlestickSkills: Skill[],
    supportResistanceSkills: Skill[],
    regularSkills: Skill[]
): string => {
    const patternListInstruction =
        patternSkills.length > 0
            ? [
                  '',
                  '### patternSummaries Writing Rules',
                  '- patternSummaries must include detection results for **every** Skills pattern listed below.',
                  '- For each Skills pattern, assess whether it is detected in the current chart data and set the detected value accordingly.',
                  '- Patterns that are not detected must still be included with detected: false.',
                  '- **Do not include any patterns not listed below in patternSummaries.**',
                  '- **Do not include candle patterns (single/multi candle) in patternSummaries.** Candle patterns belong only in candlePatterns.',
                  '- skillName: follow the Name Field Matching rule in ## Analysis Guidelines. It MUST exactly match one of the pattern skill names from the list below.',
                  '- The trend field is REQUIRED for every patternSummaries entry, including entries where detected is false. For not-detected patterns, use the pattern\'s inherent directional bias (e.g., head-and-shoulders → bearish, inverse head-and-shoulders → bullish, ascending wedge → bearish, descending wedge → bullish, double top → bearish, double bottom → bullish). Use "neutral" only when the pattern has no inherent bias. NEVER omit the trend field.',
                  '',
                  '### patternLines Writing Rules',
                  '- patternLines is an optional field. Include it only when detected: true and the pattern has diagonal trendlines (e.g., wedge upper/lower trendlines, neckline).',
                  '- Each entry must have: label (Korean, e.g. "상단 추세선", "하단 추세선", "넥라인"), start { time, price }, end { time, price }.',
                  '- For time values: each bar row begins with [ts:<unix_timestamp>] — copy this exact integer value. Do not calculate or guess.',
                  '- For wedge patterns (ascending/descending): include upper trendline and lower trendline as two separate entries.',
                  '- For head-and-shoulders / double-top / double-bottom: include the neckline as one entry.',
                  '- start and end should span the full visible range of the pattern (from the first swing point to the most recent touch).',
                  '- If no clear trendlines can be identified, omit patternLines entirely.',
                  '',
                  'Skills pattern list to analyze:',
                  ...patternSkills.map(s => `- ${s.name}`),
              ].join('\n')
            : '';

    const strategyInstruction =
        strategySkills.length > 0
            ? [
                  '',
                  '### strategyResults Writing Rules for Strategy Skills',
                  '- For each strategy skill listed below, include exactly one entry in strategyResults.',
                  "- Follow the summary format specified in each strategy skill's ## AI Analysis Instructions section.",
                  '- The summary field must use the structured markdown format with **label**: value lines.',
                  '- REQUIRED FIELDS (never omit any):',
                  '  1. strategyName: follow the Name Field Matching rule in ## Analysis Guidelines. It MUST exactly match one strategy skill name from the list below.',
                  '  2. trend: one of "bullish", "bearish", "neutral". Set based on the skill\'s own analysis instructions. NEVER omit this field — if the analysis is inconclusive, use "neutral".',
                  "  3. summary: non-empty Korean markdown text following the skill's format.",
                  '',
                  'Strategy skill list to analyze:',
                  ...strategySkills.map(s => `- ${s.name}`),
              ].join('\n')
            : '';

    const indicatorGuideInstruction =
        indicatorGuideSkills.length > 0
            ? [
                  '',
                  '### indicatorResults Writing Rules for Indicator Guides',
                  '- Use the Indicator Signal Guides above to interpret the current indicator values in ## Indicator Values.',
                  '- For each indicator guide, evaluate whether the current values meet any signal condition described in its Signal Interpretation section.',
                  '- For every detected signal, add one entry to the indicatorResults array in the following exact format:',
                  '    { "indicatorName": "<exact skill name from the list below>", "signals": [{ "type": "skill", "description": "<Korean explanation>", "strength": "strong | moderate | weak", "trend": "bullish | bearish | neutral" }] }',
                  '- CRITICAL RULES (never violate):',
                  '  1. indicatorName: follow the Name Field Matching rule in ## Analysis Guidelines. It MUST be a non-empty string — never use an empty string, a translated name, or a generic label.',
                  '  2. Each indicatorResults entry corresponds to EXACTLY ONE indicator guide. Never combine multiple indicators (e.g., "MACD and Bollinger") into one entry. Create separate entries for separate indicators.',
                  '  3. The type field of each signal entry MUST be "skill". Never use any other value.',
                  '  4. The description field MUST be written in Korean and MUST include the indicator name and specific numeric condition (e.g., "RSI 72.5 — 과매수 임계선에 근접, 단기 조정 가능").',
                  '- Signal strength calibration:',
                  '  - strong: value is in an extreme zone (e.g., RSI > 80 or < 20, Stochastic > 90 or < 10, CCI > +200 or < -200) OR multiple indicators confirm the same direction with high confluence',
                  '  - moderate: value is in a standard overbought/oversold zone (e.g., RSI 70–80, Stochastic 80–90, CCI ±100–200) with single-indicator confirmation',
                  '  - weak: value is approaching a threshold but has not yet crossed, or the signal conflicts with the prevailing trend',
                  '- Signal trend assignment:',
                  '  - bullish: the indicator signal suggests upward price movement (e.g., RSI recovering from oversold, MACD golden cross, price above key moving average)',
                  '  - bearish: the indicator signal suggests downward price movement (e.g., RSI entering overbought, MACD death cross, price below key moving average)',
                  '  - neutral: the indicator is in a range-bound or indeterminate state with no clear directional bias',
                  '- When the Key Combinations section of a guide identifies a multi-indicator confluence that is currently active, increase the strength by one level AND note the confluence in the description field.',
                  "- Respect each guide's Caveats section: do not generate a signal if the caveats indicate it would be unreliable in the current market context (e.g., Stochastic overbought in a strong uptrend with ADX > 25 should not automatically produce a bearish signal).",
                  '- If no signal conditions are met for a given indicator guide, simply omit that guide from indicatorResults. Do not create placeholder or empty entries.',
                  '',
                  'Indicator guide list (use these exact names for indicatorName):',
                  ...indicatorGuideSkills.map(s => `- ${s.name}`),
              ].join('\n')
            : '';

    const candlestickInstruction =
        candlestickSkills.length > 0
            ? [
                  '',
                  '### candlePatterns Writing Rules for Candlestick Skills',
                  '- Use the Candlestick Pattern Guides above to interpret the candle patterns detected in ## Detected Candle Patterns.',
                  '- For each detected candle pattern, evaluate the trend context, confirmation signals, and statistical reliability as described in the matching guide.',
                  '- When a pattern matches a guide, enrich the candlePatterns entry with the guide insights: trend context validity, volume confirmation, and recommended indicator cross-checks.',
                  '- The summary field of each candlePatterns entry must include the guide-informed interpretation, not just pattern name repetition.',
                  '- If a detected pattern appears in a sideways/range-bound market context and the guide warns about reduced reliability, note this explicitly in the summary.',
                  '',
                  'Candlestick pattern guide list to apply:',
                  ...candlestickSkills.map(s => `- ${s.name}`),
              ].join('\n')
            : '';

    const supportResistanceInstruction =
        supportResistanceSkills.length > 0
            ? [
                  '',
                  '### keyLevels Writing Rules for Support/Resistance Tools',
                  '- Use the Support/Resistance Tool Guides above to calculate and identify key support and resistance levels.',
                  '- For Pivot Points: prioritize Standard and Fibonacci pivot calculations using the previous bar data. Woodie, Camarilla, and DeMark are secondary — include them only when the market context favors their use (e.g., Camarilla for scalping setups, Woodie when close-weighted analysis is relevant). Assess which levels the current price is nearest to.',
                  '- For Fibonacci Retracement: identify the most recent significant swing high and swing low, apply retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%), and note which levels are acting as support or resistance.',
                  '- For Fibonacci Extension: if a retracement has completed, calculate extension targets (100%, 127.2%, 161.8%, 200%, 261.8%) for take-profit level assessment.',
                  '- Integrate calculated levels into the keyLevels field of the response — add pivot points and Fibonacci levels as additional support/resistance entries with their calculation basis as the reason.',
                  '- When a Fibonacci level or pivot point converges with an existing indicator-based support/resistance level, note the confluence in the reason field to indicate higher reliability.',
                  '- Include support/resistance tool findings in the summary field, explaining their practical meaning for the investor.',
                  '',
                  'Support/Resistance tool list to apply:',
                  ...supportResistanceSkills.map(s => `- ${s.name}`),
              ].join('\n')
            : '';

    const regularSkillInstruction =
        regularSkills.length > 0
            ? [
                  '',
                  '### Active Skills Writing Rules',
                  '- The skills listed below are regular context skills.',
                  '- Reflect relevant insights from these skills in the summary only.',
                  '- Do not create separate structured entries or new fields for them.',
                  '',
                  'Active skill list to consider for summary enrichment:',
                  ...regularSkills.map(s => `- ${s.name}`),
              ].join('\n')
            : '';

    return [
        '## Analysis Request',
        CRITICAL_RESPONSE_RULES,
        'Use \\n to separate each topic in the summary field — do not write a single long paragraph. Other text fields should also use \\n for readability.',
        'Based on the data above, perform technical analysis and respond in the following JSON format:',
        SCHEMA_PREFACE,
        buildSchemaBody(),
        indicatorGuideInstruction,
        patternListInstruction,
        strategyInstruction,
        candlestickInstruction,
        supportResistanceInstruction,
        regularSkillInstruction,
    ]
        .filter(s => s !== '')
        .join('\n');
};

function byName(a: Skill, b: Skill): number {
    return a.name.localeCompare(b.name, 'en');
}

export function buildAnalysisPrompt(
    symbol: string,
    bars: Bar[],
    indicators: IndicatorResult,
    skills: Skill[] = [],
    timeframe: Timeframe = '1Day'
): string {
    const activeSkills = skills
        .filter(s => s.confidenceWeight >= MIN_CONFIDENCE_WEIGHT)
        .toSorted(byName);

    const skillGroups = activeSkills.reduce<Record<SkillGroupKey, Skill[]>>(
        (acc, skill) => {
            const key: SkillGroupKey = skill.type ?? 'regular';
            return { ...acc, [key]: [...acc[key], skill] };
        },
        {
            pattern: [],
            strategy: [],
            indicator_guide: [],
            candlestick: [],
            support_resistance: [],
            regular: [],
        }
    );
    const patternSkills = skillGroups.pattern;
    const strategySkills = skillGroups.strategy;
    const indicatorGuideSkills = skillGroups.indicator_guide;
    const candlestickSkills = skillGroups.candlestick;
    const supportResistanceSkills = skillGroups.support_resistance;
    const regularSkills = skillGroups.regular;

    const config = resolvePromptConfig(timeframe);

    const sections = [
        `Symbol: ${symbol}`,
        `Timeframe: ${TIMEFRAME_LABEL[timeframe]}\nTimeframe interpretation: ${TIMEFRAME_CONTEXT[timeframe]}`,
        ANALYSIS_INTENT_BLOCK,
        ANALYSIS_GUIDELINES,
        formatMarketSection(bars),
        formatLongTermContext(bars),
        formatRecentBarsSection(bars, config.recentBarsCount),
        formatBuySellVolumeSection(indicators, config.recentBarsCount),
        formatIndicatorSection(indicators, config),
        formatSMCSection(indicators, bars),
        ...(indicatorGuideSkills.length > 0
            ? [
                  `## Indicator Signal Guides\n${indicatorGuideSkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        ...(patternSkills.length > 0
            ? [
                  `## Pattern Analysis\n${patternSkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        ...(candlestickSkills.length > 0
            ? [
                  `## Candlestick Pattern Guides\n${candlestickSkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        ...(supportResistanceSkills.length > 0
            ? [
                  `## Support/Resistance Tool Guides\n${supportResistanceSkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        ...(strategySkills.length > 0
            ? [
                  `## Strategy Analysis\n${strategySkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        ...(regularSkills.length > 0
            ? [
                  `## Active Skills\n${regularSkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        buildAnalysisRequest(
            patternSkills,
            strategySkills,
            indicatorGuideSkills,
            candlestickSkills,
            supportResistanceSkills,
            regularSkills
        ),
    ];

    return sections.join('\n\n');
}
