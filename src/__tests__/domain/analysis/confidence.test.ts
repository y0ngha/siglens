import {
    enrichAnalysisWithConfidence,
    filterPatterns,
} from '@/domain/analysis/confidence';
import type { RawAnalysisResponse } from '@/domain/analysis/confidence';
import {
    HIGH_CONFIDENCE_WEIGHT,
    MIN_CONFIDENCE_WEIGHT,
    UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
} from '@/domain/indicators/constants';
import type {
    CandlePatternSummary,
    PatternResult,
    Skill,
    SkillChartDisplay,
} from '@/domain/types';

const TEST_MEDIUM_CONFIDENCE = 0.7;

const makeSkillChartDisplay = (
    overrides?: Partial<SkillChartDisplay>
): SkillChartDisplay => ({
    show: false,
    type: 'marker',
    color: '#ef4444',
    label: '테스트 라벨',
    ...overrides,
});

const makeSkill = (overrides?: Partial<Skill>): Skill => ({
    name: '테스트 스킬',
    description: '테스트 설명',
    indicators: [],
    confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
    content: '## 분석 기준\n- 테스트 내용',
    ...overrides,
});

const makePatternSummary = (
    overrides?: Partial<RawAnalysisResponse['patternSummaries'][number]>
): RawAnalysisResponse['patternSummaries'][number] => ({
    patternName: '테스트 패턴',
    skillName: '테스트 스킬',
    detected: true,
    trend: 'bullish',
    summary: '테스트 요약',
    ...overrides,
});

const makeSkillResult = (
    overrides?: Partial<RawAnalysisResponse['skillResults'][number]>
): RawAnalysisResponse['skillResults'][number] => ({
    skillName: '테스트 스킬',
    trend: 'bullish',
    summary: '테스트 요약',
    ...overrides,
});

const makePatternResult = (
    overrides?: Partial<PatternResult>
): PatternResult => ({
    patternName: '테스트 패턴',
    skillName: '테스트 스킬',
    detected: true,
    trend: 'bullish',
    summary: '테스트 요약',
    confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
    ...overrides,
});

const makeCandlePatternSummary = (
    overrides?: Partial<CandlePatternSummary>
): CandlePatternSummary => ({
    patternName: 'three_outside_down',
    detected: true,
    trend: 'bearish',
    summary: '캔들 패턴 테스트 요약',
    ...overrides,
});

const makeAnalysisResponse = (
    overrides?: Partial<RawAnalysisResponse>
): RawAnalysisResponse => ({
    summary: '테스트 종합 분석',
    trend: 'bullish',
    signals: [],
    skillSignals: [],
    riskLevel: 'low',
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    skillResults: [],
    candlePatterns: [],
    ...overrides,
});

describe('confidence', () => {
    describe('filterPatterns', () => {
        it('confidenceWeight가 MIN_CONFIDENCE_WEIGHT 이상인 패턴만 반환한다', () => {
            const patterns = [
                makePatternResult({ confidenceWeight: MIN_CONFIDENCE_WEIGHT }),
                makePatternResult({
                    confidenceWeight: MIN_CONFIDENCE_WEIGHT - 0.1,
                }),
                makePatternResult({ confidenceWeight: HIGH_CONFIDENCE_WEIGHT }),
            ];
            const result = filterPatterns(patterns);
            expect(result).toHaveLength(2);
            expect(
                result.every(p => p.confidenceWeight >= MIN_CONFIDENCE_WEIGHT)
            ).toBe(true);
        });

        it('모든 패턴이 MIN_CONFIDENCE_WEIGHT 미만이면 빈 배열을 반환한다', () => {
            const patterns = [
                makePatternResult({
                    confidenceWeight: MIN_CONFIDENCE_WEIGHT - 0.1,
                }),
                makePatternResult({
                    confidenceWeight: UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
                }),
            ];
            const result = filterPatterns(patterns);
            expect(result).toHaveLength(0);
        });

        it('빈 배열을 입력하면 빈 배열을 반환한다', () => {
            const result = filterPatterns([]);
            expect(result).toHaveLength(0);
        });
    });

    describe('patternSummaries confidenceWeight 채우기', () => {
        it('patternSummaries에 skillName과 일치하는 skill의 confidenceWeight를 채운다', () => {
            const analysis = makeAnalysisResponse({
                patternSummaries: [
                    makePatternSummary({ skillName: '헤드앤숄더' }),
                ],
            });
            const skills = [
                makeSkill({
                    name: '헤드앤숄더',
                    confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
                }),
            ];
            const result = enrichAnalysisWithConfidence(analysis, skills);
            expect(result.patternSummaries[0].confidenceWeight).toBe(
                HIGH_CONFIDENCE_WEIGHT
            );
        });

        it('매칭되지 않는 skillName은 confidenceWeight를 0으로 채운다', () => {
            const analysis = makeAnalysisResponse({
                patternSummaries: [
                    makePatternSummary({ skillName: '존재하지않는스킬' }),
                ],
            });
            const skills = [
                makeSkill({
                    name: '다른스킬',
                    confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
                }),
            ];
            const result = enrichAnalysisWithConfidence(analysis, skills);
            expect(result.patternSummaries[0].confidenceWeight).toBe(
                UNMATCHED_SKILL_CONFIDENCE_WEIGHT
            );
        });
    });

    describe('patternSummaries renderConfig 채우기', () => {
        it('매칭되는 skill의 display.chart가 있을 때 renderConfig에 채운다', () => {
            const chartDisplay = makeSkillChartDisplay();
            const analysis = makeAnalysisResponse({
                patternSummaries: [
                    makePatternSummary({ skillName: '헤드앤숄더' }),
                ],
            });
            const skills = [
                makeSkill({
                    name: '헤드앤숄더',
                    display: { chart: chartDisplay },
                }),
            ];
            const result = enrichAnalysisWithConfidence(analysis, skills);
            expect(result.patternSummaries[0].renderConfig).toEqual(
                chartDisplay
            );
        });

        it('skill에 display 필드가 없을 때 renderConfig는 undefined다', () => {
            const analysis = makeAnalysisResponse({
                patternSummaries: [
                    makePatternSummary({ skillName: '헤드앤숄더' }),
                ],
            });
            const skills = [
                makeSkill({
                    name: '헤드앤숄더',
                    display: undefined,
                }),
            ];
            const result = enrichAnalysisWithConfidence(analysis, skills);
            expect(result.patternSummaries[0].renderConfig).toBeUndefined();
        });

        it('매칭되는 skill이 없을 때 renderConfig는 undefined다', () => {
            const analysis = makeAnalysisResponse({
                patternSummaries: [
                    makePatternSummary({ skillName: '없는스킬' }),
                ],
            });
            const result = enrichAnalysisWithConfidence(analysis, []);
            expect(result.patternSummaries[0].renderConfig).toBeUndefined();
        });
    });

    describe('skillResults confidenceWeight 채우기', () => {
        it('skillResults에 skillName과 일치하는 skill의 confidenceWeight를 채운다', () => {
            const analysis = makeAnalysisResponse({
                skillResults: [
                    makeSkillResult({ skillName: 'RSI 다이버전스' }),
                ],
            });
            const skills = [
                makeSkill({
                    name: 'RSI 다이버전스',
                    confidenceWeight: TEST_MEDIUM_CONFIDENCE,
                }),
            ];
            const result = enrichAnalysisWithConfidence(analysis, skills);
            expect(result.skillResults[0].confidenceWeight).toBe(
                TEST_MEDIUM_CONFIDENCE
            );
        });

        it('매칭되지 않는 skillName은 confidenceWeight를 0으로 채운다', () => {
            const analysis = makeAnalysisResponse({
                skillResults: [makeSkillResult({ skillName: '없는스킬' })],
            });
            const skills = [
                makeSkill({
                    name: '다른스킬',
                    confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
                }),
            ];
            const result = enrichAnalysisWithConfidence(analysis, skills);
            expect(result.skillResults[0].confidenceWeight).toBe(
                UNMATCHED_SKILL_CONFIDENCE_WEIGHT
            );
        });
    });

    describe('skills 빈 배열일 때', () => {
        it('skills가 빈 배열이면 모든 confidenceWeight를 0으로 채운다', () => {
            const analysis = makeAnalysisResponse({
                patternSummaries: [
                    makePatternSummary({ skillName: '헤드앤숄더' }),
                ],
                skillResults: [
                    makeSkillResult({ skillName: 'RSI 다이버전스' }),
                ],
            });
            const result = enrichAnalysisWithConfidence(analysis, []);
            expect(result.patternSummaries[0].confidenceWeight).toBe(
                UNMATCHED_SKILL_CONFIDENCE_WEIGHT
            );
            expect(result.skillResults[0].confidenceWeight).toBe(
                UNMATCHED_SKILL_CONFIDENCE_WEIGHT
            );
        });
    });

    describe('candlePatterns 필드 통과', () => {
        it('candlePatterns가 있을 때 enrichment 후에도 동일하게 유지된다', () => {
            const candlePattern = makeCandlePatternSummary({
                patternName: 'morning_star',
                detected: true,
                trend: 'bullish',
                summary: '샛별형 패턴 감지',
            });
            const analysis = makeAnalysisResponse({
                candlePatterns: [candlePattern],
            });
            const result = enrichAnalysisWithConfidence(analysis, []);
            expect(result.candlePatterns).toEqual([candlePattern]);
        });

        it('candlePatterns가 빈 배열일 때 빈 배열을 유지한다', () => {
            const analysis = makeAnalysisResponse({ candlePatterns: [] });
            const result = enrichAnalysisWithConfidence(analysis, []);
            expect(result.candlePatterns).toEqual([]);
        });
    });

    describe('불변성', () => {
        it('원본 analysis 객체를 변경하지 않는다', () => {
            const patternSummary = makePatternSummary({
                skillName: '헤드앤숄더',
            });
            const analysis = makeAnalysisResponse({
                patternSummaries: [patternSummary],
            });
            const skills = [
                makeSkill({
                    name: '헤드앤숄더',
                    confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
                }),
            ];
            enrichAnalysisWithConfidence(analysis, skills);
            expect(
                (patternSummary as { confidenceWeight?: number })
                    .confidenceWeight
            ).toBeUndefined();
        });

        it('patternSummaries와 skillResults 외의 필드는 변경하지 않는다', () => {
            const analysis = makeAnalysisResponse({
                summary: '원본 요약',
                trend: 'bearish',
                riskLevel: 'high',
            });
            const result = enrichAnalysisWithConfidence(analysis, []);
            expect(result.summary).toBe('원본 요약');
            expect(result.trend).toBe('bearish');
            expect(result.riskLevel).toBe('high');
        });
    });
});
