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
} from '@/domain/indicators/constants';
import {
    detectCandlePattern,
    detectMultiCandlePattern,
} from '@/domain/analysis/candle';
import { getCandlePatternLabel } from '@/domain/analysis/candle-labels';
import type {
    AnalysisResponse,
    Bar,
    IndicatorResult,
    Skill,
} from '@/domain/types';

const INDICATOR_DECIMAL_PLACES = 2;
const RECENT_BARS_COUNT = 30;
export const CANDLE_PATTERN_DETECTION_BARS = 15;
const DATETIME_DISPLAY_LENGTH = 16;
const PERCENTAGE_FACTOR = 100;

type CandlePatternEntryType = 'single' | 'multi';

interface CandlePatternEntry {
    barsAgo: number;
    patternType: CandlePatternEntryType;
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

const formatBarRow = (bar: Bar): string => {
    const datetime = new Date(bar.time * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, DATETIME_DISPLAY_LENGTH);
    const pattern = detectCandlePattern(bar);
    return `${datetime} | O:${fmt(bar.open)} H:${fmt(bar.high)} L:${fmt(bar.low)} C:${fmt(bar.close)} V:${formatVolume(bar.volume)} [${getCandlePatternLabel(pattern)}]`;
};

const buildCandlePatternEntries = (bars: Bar[]): CandlePatternEntry[] => {
    const patternBars = bars.slice(-CANDLE_PATTERN_DETECTION_BARS);
    const totalBars = patternBars.length;

    const singleEntries: CandlePatternEntry[] = patternBars.map((bar, i) => ({
        barsAgo: totalBars - 1 - i,
        patternType: 'single',
        patternName: detectCandlePattern(bar),
    }));

    const multiEntries: CandlePatternEntry[] = patternBars.flatMap((_, i) => {
        const windowEnd = i + 1;
        const candleWindow = patternBars.slice(0, windowEnd);
        const detected = detectMultiCandlePattern(candleWindow);
        if (detected === null) return [];
        return [
            {
                barsAgo: totalBars - 1 - i,
                patternType: 'multi' as const,
                patternName: detected,
            },
        ];
    });

    const multiBarPositions = new Set(multiEntries.map(e => e.barsAgo));
    const filteredSingleEntries = singleEntries.filter(
        e => !multiBarPositions.has(e.barsAgo)
    );

    return [...filteredSingleEntries, ...multiEntries].sort(
        (a, b) => b.barsAgo - a.barsAgo
    );
};

const formatPatternEntry = (entry: CandlePatternEntry): string =>
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
                  `## Detected Candle Patterns (Last ${CANDLE_PATTERN_DETECTION_BARS} bars)`,
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

const formatIndicatorSection = (indicators: IndicatorResult): string => {
    const lastRSI = lastNonNull(indicators.rsi);
    const lastMACD = lastOf(indicators.macd);
    const lastBollinger = lastOf(indicators.bollinger);
    const lastDMI = lastOf(indicators.dmi);

    return [
        '## Indicator Values',
        `- RSI(${RSI_DEFAULT_PERIOD}): ${fmt(lastRSI)}`,
        `- MACD: ${fmt(lastMACD?.macd ?? null)} / Signal ${fmt(lastMACD?.signal ?? null)} / Histogram ${fmt(lastMACD?.histogram ?? null)}`,
        `- Bollinger Bands: Upper ${fmt(lastBollinger?.upper ?? null)} / Middle ${fmt(lastBollinger?.middle ?? null)} / Lower ${fmt(lastBollinger?.lower ?? null)}`,
        `- DMI: +DI ${fmt(lastDMI?.diPlus ?? null)} / -DI ${fmt(lastDMI?.diMinus ?? null)} / ADX ${fmt(lastDMI?.adx ?? null)}`,
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
    summary: '"Overall analysis summary"',
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
        '[{ "patternName": "...", "skillName": "...", "detected": true, "trend": "bullish | bearish | neutral", "summary": "...", "keyPrices": [150.00], "timeRange": { "start": 1700000000, "end": 1700100000 } }]',
    skillResults:
        '[{ "skillName": "...", "trend": "bullish | bearish | neutral", "summary": "..." }]',
    candlePatterns:
        // Only candle patterns detected from bar data. Skills patterns go in patternSummaries.
        '[{ "patternName": "three_outside_down", "detected": true, "trend": "bearish", "summary": "..." }]',
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
    '### Support/Resistance Assessment',
    `- Check convergence points of moving averages (MA ${MA_DEFAULT_PERIODS.join(',')}, EMA ${EMA_DEFAULT_PERIODS[EMA_SUPPORT_RESISTANCE_SHORT_INDEX]}/${EMA_DEFAULT_PERIODS[EMA_SUPPORT_RESISTANCE_LONG_INDEX]}) first`,
    '- Identify PoC (Point of Control — highest volume price area) from the last 30 bars',
    '- Treat high/low of high-volume bars as supply/demand zones',
    '- Reference prior swing highs/lows and Bollinger Band boundaries',
    '- Each level must include a reason',
    '',
    '### Price Target Calculation',
    '- Apply the measured move rule (project pattern height) for detected patterns',
    '- First target: nearest support/resistance; second target: based on pattern measurement',
    '- State the trigger condition (breakout/breakdown reference level) for each scenario',
    '- Strengthen target viability with supporting indicators (RSI extremes, Bollinger Band touch, MACD trend)',
].join('\n');

const RESPONSE_LANGUAGE_INSTRUCTION =
    'IMPORTANT: All text field values in the JSON response (summary, description, reason, basis, condition, etc.) must be written in Korean (한국어). Do not use English for any response content.';

const buildAnalysisRequest = (patternSkills: Skill[]): string => {
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
                  '',
                  'Skills pattern list to analyze:',
                  ...patternSkills.map(s => `- ${s.name}`),
              ].join('\n')
            : '';

    return [
        '## Analysis Request',
        RESPONSE_LANGUAGE_INSTRUCTION,
        'Based on the data above, perform technical analysis and respond in the following JSON format:',
        buildSchemaBody(),
        patternListInstruction,
    ]
        .filter(s => s !== '')
        .join('\n');
};

export function buildAnalysisPrompt(
    symbol: string,
    bars: Bar[],
    indicators: IndicatorResult,
    skills: Skill[] = []
): string {
    const activeSkills = skills.filter(
        s => s.confidenceWeight >= MIN_CONFIDENCE_WEIGHT
    );
    const patternSkills = activeSkills.filter(s => s.type === 'pattern');
    const regularSkills = activeSkills.filter(s => s.type !== 'pattern');

    const sections = [
        `Symbol: ${symbol}`,
        formatMarketSection(bars),
        formatRecentBarsSection(bars),
        formatVolumeSection(bars),
        formatIndicatorSection(indicators),
        ...(patternSkills.length > 0
            ? [
                  `## Pattern Analysis\n${patternSkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        ...(regularSkills.length > 0
            ? [
                  `## Active Skills\n${regularSkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        ANALYSIS_GUIDELINES,
        buildAnalysisRequest(patternSkills),
    ];

    return sections.join('\n\n');
}
