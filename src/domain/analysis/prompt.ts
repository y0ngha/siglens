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
    Timeframe,
} from '@/domain/types';

const INDICATOR_DECIMAL_PLACES = 2;
const RECENT_BARS_COUNT = 30;
const DATETIME_DISPLAY_LENGTH = 16;
const PERCENTAGE_FACTOR = 100;
const INDICATOR_TREND_SAMPLE_COUNT = 5;

// TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
const TIMEFRAME_LABEL: Record<Timeframe, string> = {
    // '1Min': '1-Minute',
    // '5Min': '5-Minute',
    // '15Min': '15-Minute',
    // '1Hour': '1-Hour',
    '1Day': 'Daily',
};

type IndicatorTrend = 'rising' | 'falling' | 'flat';

const detectTrend = (values: (number | null)[]): IndicatorTrend | null => {
    const nonNull = values
        .slice(-INDICATOR_TREND_SAMPLE_COUNT)
        .filter((v): v is number => v !== null);
    if (nonNull.length < 2) return null;
    const first = nonNull[0];
    const last = nonNull[nonNull.length - 1];
    const diff = last - first;
    const threshold = Math.abs(first) * 0.01;
    if (diff > threshold) return 'rising';
    if (diff < -threshold) return 'falling';
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

const formatRecentBarsSection = (bars: Bar[]): string => {
    const recentBars = bars.slice(-RECENT_BARS_COUNT);

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

const formatVolumeSection = (bars: Bar[]): string => {
    const recentBars = bars.slice(-RECENT_BARS_COUNT);

    if (recentBars.length === 0) {
        return ['## Volume Analysis', '- No data available'].join('\n');
    }

    const avgVolume =
        recentBars.reduce((acc, b) => acc + b.volume, 0) / recentBars.length;
    const lastBar = recentBars[recentBars.length - 1];
    const volumeRatio =
        avgVolume > 0 ? (lastBar.volume / avgVolume) * PERCENTAGE_FACTOR : 0;

    return [
        '## Volume Analysis',
        `- Last ${recentBars.length}-bar average: ${formatVolume(avgVolume)}`,
        `- Current volume: ${formatVolume(lastBar.volume)} (${volumeRatio.toFixed(INDICATOR_DECIMAL_PLACES)}% of average)`,
    ].join('\n');
};

const trendLabel = (trend: IndicatorTrend | null): string =>
    trend === null ? '' : ` [${trend}]`;

const formatIndicatorSection = (indicators: IndicatorResult): string => {
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

    const rsiTrend = detectTrend(indicators.rsi);
    const cciTrend = detectTrend(indicators.cci);
    const macdTrend = detectTrend(
        indicators.macd.map(m => m.histogram ?? null)
    );

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
    signals:
        '[{ "type": "...", "description": "...", "strength": "strong | moderate | weak" }]',
    skillSignals: '[{ "skillName": "...", "signals": [...] }]',
    riskLevel: '"low | medium | high"',
    keyLevels:
        '{ "support": [{ "price": 150.00, "reason": "..." }], "resistance": [{ "price": 160.00, "reason": "..." }], "poc": { "price": 155.00, "reason": "..." } }',
    priceTargets:
        '{ "bullish": { "targets": [{ "price": 165.00, "basis": "..." }], "condition": "..." }, "bearish": { "targets": [{ "price": 145.00, "basis": "..." }], "condition": "..." } }',
    patternSummaries:
        // Only chart patterns defined in skills/*.md. Candle patterns go in candlePatterns.
        '[{ "patternName": "...", "skillName": "...", "detected": true, "trend": "bullish | bearish | neutral", "summary": "...", "keyPrices": [{ "label": "넥라인", "price": 150.00 }], "patternLines": [{ "label": "상단 추세선", "start": { "time": 1700000000, "price": 155.00 }, "end": { "time": 1700100000, "price": 152.00 } }, { "label": "하단 추세선", "start": { "time": 1700000000, "price": 148.00 }, "end": { "time": 1700100000, "price": 146.00 } }], "timeRange": { "start": 1700000000, "end": 1700100000 } }]',
    skillResults:
        '[{ "skillName": "...", "trend": "bullish | bearish | neutral", "summary": "..." }]',
    candlePatterns:
        // Only candle patterns detected from bar data. Skills patterns go in patternSummaries.
        '[{ "patternName": "three_outside_down", "detected": true, "trend": "bearish", "summary": "..." }]',
    trendlines:
        '[{ "direction": "ascending | descending", "start": { "time": 1700000000, "price": 150.00 }, "end": { "time": 1700100000, "price": 155.00 } }]',
    actionRecommendation:
        '{ "positionAnalysis": "Current price position vs support/resistance analysis", "entry": "Entry strategy with specific price ranges", "exit": "Exit strategy with specific price ranges", "riskReward": "Risk-reward ratio analysis" }',
};

const buildSchemaBody = (): string => {
    const entries = Object.entries(ANALYSIS_RESPONSE_SCHEMA)
        .map(([key, value]) => `  "${key}": ${value}`)
        .join(',\n');
    return `{\n${entries}\n}`;
};

const ANALYSIS_GUIDELINES = [
    '## Analysis Guidelines',
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
    '### Ichimoku Cloud Interpretation',
    '- Price above the cloud (Kumo): bullish trend; price below: bearish trend; price inside: neutral/consolidation',
    '- Tenkan-sen crossing above Kijun-sen is a bullish signal (TK cross); crossing below is bearish',
    '- Chikou Span above price from 26 periods ago confirms bullish momentum; below confirms bearish',
    '- Thick cloud ahead indicates strong support/resistance; thin cloud suggests a potential breakout zone',
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
    '### Conflicting Signals',
    '- When indicators give conflicting signals (e.g. RSI overbought but MACD bullish cross), list each signal individually and then state which side has stronger confluence.',
    '- Weight signals by the number of confirming indicators and the strength of each signal.',
    '- Mention the conflict explicitly in the summary so the user understands the mixed picture.',
    '',
    '### Summary Writing Guidelines',
    '- The summary must synthesize ALL analysis sections: indicator readings, detected patterns, volume profile findings, skill results, and strategy outcomes.',
    '- Write in accessible language that non-technical investors can understand.',
    '- Instead of stating raw indicator values, explain their practical meaning (e.g., "the stock has risen quickly and may be due for a pause" instead of "RSI is overbought at 75").',
    '- When referencing patterns, explain what they typically predict in simple terms.',
    '- If signals conflict, clearly state the mixed picture and which direction has stronger support.',
    '- The summary should answer: "What is happening with this stock and what does it mean for the investor?"',
    '',
    '### Action Recommendation Guidelines',
    '- actionRecommendation must be consistent with the keyLevels and priceTargets you already computed. Use those values directly — do not re-derive support/resistance from scratch.',
    '- positionAnalysis: State where the current price sits relative to the keyLevels (support, resistance, POC) you identified above.',
    '- entry: Provide specific entry price ranges with reasoning. Consider:',
    '  - If current price is near resistance, advise waiting for a pullback to support (e.g., "current price 180 is near resistance 181, consider buying at support 175~177")',
    '  - If current price is near support, entry may be favorable (e.g., "current price 166 is near support 167, consider staged entry at 165~167")',
    '  - Always provide specific price ranges, not vague descriptions',
    '- exit: Provide specific exit price ranges for both profit-taking and stop-loss, referencing the priceTargets and resistance levels above.',
    '- riskReward: Calculate the risk-reward ratio based on entry, stop-loss, and target prices. Express as a ratio (e.g., "stop-loss 3% vs target 9% → risk:reward = 1:3").',
    '- Write in accessible language that non-technical users can understand.',
    '',
    '### Insufficient Data',
    '- If bar data is too short to reliably calculate an indicator or detect a pattern, state "데이터 부족" rather than guessing.',
    '- Do not fabricate support/resistance levels or patterns when the data does not clearly support them.',
].join('\n');

const RESPONSE_LANGUAGE_INSTRUCTION =
    'IMPORTANT: All text field values in the JSON response (summary, description, reason, basis, condition, positionAnalysis, entry, exit, riskReward, etc.) must be written in Korean (한국어). Do not use English for any response content. Use formal/polite speech level (존댓말, e.g. "~입니다", "~습니다"). For the summary field, use \\n to separate each topic or sentence into its own line — do not write the summary as a single long paragraph. Other text fields (description, reason, basis, condition, positionAnalysis, entry, exit, riskReward, etc.) should also use \\n for line breaks where it improves readability.';

const buildAnalysisRequest = (
    patternSkills: Skill[],
    strategySkills: Skill[],
    indicatorGuideSkills: Skill[]
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
                  '- The "skillName" field in each patternSummaries entry MUST exactly match one of the skill names listed below. Copy the name verbatim — do not translate, abbreviate, or modify it.',
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
                  '### skillResults Writing Rules for Strategy Skills',
                  '- For each strategy skill listed below, include exactly one entry in skillResults.',
                  "- Follow the summary format specified in each strategy skill's ## AI Analysis Instructions section.",
                  '- The summary field must use the structured markdown format with **label**: value lines.',
                  "- Set the trend field based on each skill's own analysis instructions (bullish/bearish/neutral).",
                  '',
                  'Strategy skill list to analyze:',
                  ...strategySkills.map(s => `- ${s.name}`),
              ].join('\n')
            : '';

    const indicatorGuideInstruction =
        indicatorGuideSkills.length > 0
            ? [
                  '',
                  '### signals Writing Rules for Indicator Guides',
                  '- Use the Indicator Signal Guides above to interpret the current indicator values in ## Indicator Values.',
                  '- For each indicator guide, evaluate whether the current values meet any signal condition described in its Signal Interpretation section.',
                  '- When a signal condition is met, include a corresponding entry in the signals array.',
                  '- The type field of each signal entry MUST be "skill". Do not use indicator-specific type values.',
                  '- The description field must be written in Korean and include the indicator name and specific condition (e.g., "Stochastic %K 82 — 과매수 구간 진입, ADX 18로 레인지 환경에서 신뢰도 높음").',
                  '- Signal strength guidelines:',
                  '  - strong: value is in an extreme zone (e.g., RSI > 80 or < 20, Stochastic > 90 or < 10, CCI > +200 or < -200) OR multiple indicators confirm the same direction',
                  '  - moderate: value is in a standard threshold zone (e.g., RSI 70–80, Stochastic 80–90, CCI ±100–200) with single-indicator confirmation',
                  '  - weak: value is approaching a threshold but not yet crossed, or the signal conflicts with the prevailing trend',
                  '- When the Key Combinations section of a guide identifies a multi-indicator confluence that is currently active, increase the signal strength by one level and note the confluence in the description.',
                  "- Respect each guide's Caveats section: do not generate a signal if the caveats indicate it would be unreliable in the current market context (e.g., Stochastic overbought in a strong uptrend with ADX > 25 should not automatically produce a bearish signal).",
                  '',
                  'Indicator guide list to apply:',
                  ...indicatorGuideSkills.map(s => `- ${s.name}`),
              ].join('\n')
            : '';

    return [
        '## Analysis Request',
        RESPONSE_LANGUAGE_INSTRUCTION,
        'Based on the data above, perform technical analysis and respond in the following JSON format:',
        buildSchemaBody(),
        indicatorGuideInstruction,
        patternListInstruction,
        strategyInstruction,
    ]
        .filter(s => s !== '')
        .join('\n');
};

export function buildAnalysisPrompt(
    symbol: string,
    bars: Bar[],
    indicators: IndicatorResult,
    skills: Skill[] = [],
    timeframe: Timeframe = '1Day'
): string {
    const activeSkills = skills.filter(
        s => s.confidenceWeight >= MIN_CONFIDENCE_WEIGHT
    );
    const patternSkills = activeSkills.filter(s => s.type === 'pattern');
    const strategySkills = activeSkills.filter(s => s.type === 'strategy');
    const indicatorGuideSkills = activeSkills.filter(
        s => s.type === 'indicator_guide'
    );
    const regularSkills = activeSkills.filter(
        s =>
            s.type !== 'pattern' &&
            s.type !== 'strategy' &&
            s.type !== 'indicator_guide'
    );

    const sections = [
        `Symbol: ${symbol}`,
        `Timeframe: ${TIMEFRAME_LABEL[timeframe]}`,
        formatMarketSection(bars),
        formatLongTermContext(bars),
        formatRecentBarsSection(bars),
        formatVolumeSection(bars),
        formatIndicatorSection(indicators),
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
        ANALYSIS_GUIDELINES,
        buildAnalysisRequest(
            patternSkills,
            strategySkills,
            indicatorGuideSkills
        ),
    ];

    return sections.join('\n\n');
}
