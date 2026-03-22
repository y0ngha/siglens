import type { Bar, IndicatorResult, Skill } from '@/domain/types';

const MIN_CONFIDENCE_WEIGHT = 0.5;
const HIGH_CONFIDENCE_WEIGHT = 0.8;
const INDICATOR_DECIMAL_PLACES = 2;

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
            '## 현재 시장 상황',
            '- 현재가: N/A',
            '- 변화율: N/A',
            '- 거래량: N/A',
        ].join('\n');
    }

    const last = bars[bars.length - 1];
    const prev = bars.length > 1 ? bars[bars.length - 2] : null;
    const changeRate =
        prev !== null
            ? `${(((last.close - prev.close) / prev.close) * 100).toFixed(INDICATOR_DECIMAL_PLACES)}%`
            : 'N/A';

    return [
        '## 현재 시장 상황',
        `- 현재가: ${fmt(last.close)}`,
        `- 변화율: ${changeRate}`,
        `- 거래량: ${formatVolume(last.volume)}`,
    ].join('\n');
};

const formatIndicatorSection = (indicators: IndicatorResult): string => {
    const lastRSI = lastNonNull(indicators.rsi);
    const lastMACD = lastOf(indicators.macd);
    const lastBollinger = lastOf(indicators.bollinger);
    const lastDMI = lastOf(indicators.dmi);

    return [
        '## 인디케이터 수치',
        `- RSI(14): ${fmt(lastRSI)}`,
        `- MACD: ${fmt(lastMACD?.macd ?? null)} / Signal ${fmt(lastMACD?.signal ?? null)} / Histogram ${fmt(lastMACD?.histogram ?? null)}`,
        `- 볼린저 밴드: Upper ${fmt(lastBollinger?.upper ?? null)} / Middle ${fmt(lastBollinger?.middle ?? null)} / Lower ${fmt(lastBollinger?.lower ?? null)}`,
        `- DMI: +DI ${fmt(lastDMI?.diPlus ?? null)} / -DI ${fmt(lastDMI?.diMinus ?? null)} / ADX ${fmt(lastDMI?.adx ?? null)}`,
    ].join('\n');
};

const confidenceLabel = (weight: number): string =>
    weight >= HIGH_CONFIDENCE_WEIGHT ? '[높은 신뢰도]' : '[중간 신뢰도]';

const buildSkillBlock = (skill: Skill): string =>
    `### ${skill.name} ${confidenceLabel(skill.confidence_weight)}\n${skill.content}`;

const ANALYSIS_REQUEST = [
    '## 분석 요청',
    '위 데이터를 기반으로 기술적 분석을 수행하고 다음 JSON 형식으로 응답해주세요:',
    '{',
    '  "summary": "종합 분석 요약",',
    '  "trend": "bullish | bearish | neutral",',
    '  "signals": [{ "type": "...", "description": "...", "strength": "strong | moderate | weak" }],',
    '  "riskLevel": "low | medium | high",',
    '  "keyLevels": { "support": [], "resistance": [] }',
    '}',
].join('\n');

export function buildAnalysisPrompt(
    symbol: string,
    bars: Bar[],
    indicators: IndicatorResult,
    skills: Skill[] = []
): string {
    const activeSkills = skills.filter(
        s => s.confidence_weight >= MIN_CONFIDENCE_WEIGHT
    );
    const patternSkills = activeSkills.filter(s => s.type === 'pattern');
    const regularSkills = activeSkills.filter(s => s.type !== 'pattern');

    const sections = [
        `종목: ${symbol}`,
        formatMarketSection(bars),
        formatIndicatorSection(indicators),
        ...(patternSkills.length > 0
            ? [
                  `## 패턴 분석\n${patternSkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        ...(regularSkills.length > 0
            ? [
                  `## 활성화된 Skills\n${regularSkills.map(buildSkillBlock).join('\n\n')}`,
              ]
            : []),
        ANALYSIS_REQUEST,
    ];

    return sections.join('\n\n');
}
