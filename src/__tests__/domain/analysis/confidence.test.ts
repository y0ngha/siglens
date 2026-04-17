import {
    enrichAnalysisWithConfidence,
    filterPatterns,
} from '@/domain/analysis/confidence';
import type {
    PatternResult,
    PatternSummary,
    RawAnalysisResponse,
    Skill,
    SkillChartDisplay,
    StrategyResult,
} from '@/domain/types';
import {
    HIGH_CONFIDENCE_WEIGHT,
    MEDIUM_CONFIDENCE_WEIGHT,
    MIN_CONFIDENCE_WEIGHT,
    UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
} from '@/domain/indicators/constants';

type RawPatternSummary = Omit<PatternSummary, 'confidenceWeight' | 'id'>;
type RawStrategyResult = Omit<StrategyResult, 'confidenceWeight' | 'id'>;

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
    overrides?: Partial<RawPatternSummary>
): RawPatternSummary => ({
    patternName: '테스트 패턴',
    skillName: '테스트 스킬',
    detected: true,
    trend: 'bullish',
    summary: '테스트 요약',
    ...overrides,
});

const makeStrategyResult = (
    overrides?: Partial<RawStrategyResult>
): RawStrategyResult => ({
    strategyName: '테스트 전략',
    trend: 'bullish',
    summary: '테스트 요약',
    ...overrides,
});

const makePatternResult = (
    overrides?: Partial<PatternResult>
): PatternResult => ({
    id: '테스트 패턴_0',
    patternName: '테스트 패턴',
    skillName: '테스트 스킬',
    detected: true,
    trend: 'bullish',
    summary: '테스트 요약',
    confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
    ...overrides,
});

const makeAnalysisResponse = (
    overrides?: Partial<RawAnalysisResponse>
): RawAnalysisResponse => ({
    summary: '테스트 종합 분석',
    trend: 'bullish',
    indicatorResults: [],
    riskLevel: 'low',
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    strategyResults: [],
    candlePatterns: [],
    trendlines: [],
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

        it('모든 패턴이 MIN_CONFIDENCE_WEIGHT를 초과하면 전체가 반환된다', () => {
            const aboveMin = MIN_CONFIDENCE_WEIGHT + 0.1;
            const patterns = [
                makePatternResult({ confidenceWeight: aboveMin }),
                makePatternResult({ confidenceWeight: HIGH_CONFIDENCE_WEIGHT }),
            ];
            const result = filterPatterns(patterns);
            expect(result).toHaveLength(2);
        });
    });

    describe('enrichAnalysisWithConfidence', () => {
        describe('patternSummaries id 부여', () => {
            it('단일 패턴에 id가 부여된다', () => {
                const analysis = makeAnalysisResponse({
                    patternSummaries: [
                        makePatternSummary({
                            patternName: '헤드앤숄더',
                            skillName: '테스트 스킬',
                        }),
                    ],
                });
                const skills = [
                    makeSkill({
                        name: '테스트 스킬',
                        confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
                    }),
                ];
                const result = enrichAnalysisWithConfidence(analysis, skills);
                expect(result.patternSummaries[0].id).toBe('헤드앤숄더_0');
            });

            it('동일한 patternName이 여러 개일 때 고유한 id를 부여한다', () => {
                const analysis = makeAnalysisResponse({
                    patternSummaries: [
                        makePatternSummary({
                            patternName: '헤드앤숄더',
                            skillName: '테스트 스킬',
                        }),
                        makePatternSummary({
                            patternName: '헤드앤숄더',
                            skillName: '테스트 스킬',
                        }),
                    ],
                });
                const skills = [
                    makeSkill({
                        name: '테스트 스킬',
                        confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
                    }),
                ];
                const result = enrichAnalysisWithConfidence(analysis, skills);
                expect(result.patternSummaries[0].id).toBe('헤드앤숄더_0');
                expect(result.patternSummaries[1].id).toBe('헤드앤숄더_1');
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

            it('매칭되지 않는 skillName은 confidenceWeight 0으로 처리되어 필터링된다', () => {
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
                expect(result.patternSummaries).toHaveLength(0);
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

            it('매칭되는 skill이 없을 때 해당 패턴은 필터링된다', () => {
                const analysis = makeAnalysisResponse({
                    patternSummaries: [
                        makePatternSummary({ skillName: '없는스킬' }),
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.patternSummaries).toHaveLength(0);
            });
        });

        describe('strategyResults id 부여', () => {
            it('단일 strategyResult에 id가 부여된다', () => {
                const analysis = makeAnalysisResponse({
                    strategyResults: [
                        makeStrategyResult({ strategyName: 'RSI 다이버전스' }),
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.strategyResults[0].id).toBe('RSI 다이버전스_0');
            });

            it('동일한 strategyName이 여러 개일 때 고유한 id를 부여한다', () => {
                const analysis = makeAnalysisResponse({
                    strategyResults: [
                        makeStrategyResult({ strategyName: 'RSI 다이버전스' }),
                        makeStrategyResult({ strategyName: 'RSI 다이버전스' }),
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.strategyResults[0].id).toBe('RSI 다이버전스_0');
                expect(result.strategyResults[1].id).toBe('RSI 다이버전스_1');
            });
        });

        describe('strategyResults confidenceWeight 채우기', () => {
            it('strategyResults에 strategyName과 일치하는 skill의 confidenceWeight를 채운다', () => {
                const analysis = makeAnalysisResponse({
                    strategyResults: [
                        makeStrategyResult({ strategyName: 'RSI 다이버전스' }),
                    ],
                });
                const skills = [
                    makeSkill({
                        name: 'RSI 다이버전스',
                        confidenceWeight: MEDIUM_CONFIDENCE_WEIGHT,
                    }),
                ];
                const result = enrichAnalysisWithConfidence(analysis, skills);
                expect(result.strategyResults[0].confidenceWeight).toBe(
                    MEDIUM_CONFIDENCE_WEIGHT
                );
            });

            it('매칭되지 않는 strategyName은 confidenceWeight를 0으로 채운다', () => {
                const analysis = makeAnalysisResponse({
                    strategyResults: [
                        makeStrategyResult({ strategyName: '없는스킬' }),
                    ],
                });
                const skills = [
                    makeSkill({
                        name: '다른스킬',
                        confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
                    }),
                ];
                const result = enrichAnalysisWithConfidence(analysis, skills);
                expect(result.strategyResults[0].confidenceWeight).toBe(
                    UNMATCHED_SKILL_CONFIDENCE_WEIGHT
                );
            });
        });

        describe('skills 빈 배열일 때', () => {
            it('skills가 빈 배열이면 patternSummaries는 모두 필터링된다', () => {
                const analysis = makeAnalysisResponse({
                    patternSummaries: [
                        makePatternSummary({ skillName: '헤드앤숄더' }),
                    ],
                    strategyResults: [
                        makeStrategyResult({ strategyName: 'RSI 다이버전스' }),
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.patternSummaries).toHaveLength(0);
            });

            it('skills가 빈 배열이면 strategyResults의 confidenceWeight는 0이다', () => {
                const analysis = makeAnalysisResponse({
                    strategyResults: [
                        makeStrategyResult({ strategyName: 'RSI 다이버전스' }),
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.strategyResults[0].confidenceWeight).toBe(
                    UNMATCHED_SKILL_CONFIDENCE_WEIGHT
                );
            });
        });

        describe('candlePatterns id 부여', () => {
            it('candlePatterns에 id가 부여된다', () => {
                const analysis = makeAnalysisResponse({
                    candlePatterns: [
                        {
                            patternName: 'morning_star',
                            detected: true,
                            trend: 'bullish',
                            summary: '샛별형 패턴 감지',
                        },
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.candlePatterns[0].id).toBe('morning_star_0');
            });

            it('동일한 patternName이 여러 개일 때 고유한 id를 부여한다', () => {
                const analysis = makeAnalysisResponse({
                    candlePatterns: [
                        {
                            patternName: 'three_inside_up',
                            detected: true,
                            trend: 'bullish',
                            summary: '첫 번째 패턴',
                        },
                        {
                            patternName: 'three_inside_up',
                            detected: true,
                            trend: 'bullish',
                            summary: '두 번째 패턴',
                        },
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.candlePatterns[0].id).toBe('three_inside_up_0');
                expect(result.candlePatterns[1].id).toBe('three_inside_up_1');
            });

            it('candlePatterns가 빈 배열일 때 빈 배열을 유지한다', () => {
                const analysis = makeAnalysisResponse({ candlePatterns: [] });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.candlePatterns).toEqual([]);
            });
        });

        describe('영어 pattern 필드 기반 fallback 매칭', () => {
            it('AI가 영어 pattern 값으로 skillName을 반환해도 올바른 skill이 매칭된다', () => {
                const analysis = makeAnalysisResponse({
                    patternSummaries: [
                        makePatternSummary({ skillName: 'head_and_shoulders' }),
                    ],
                });
                const skills = [
                    makeSkill({
                        name: '헤드앤숄더',
                        pattern: 'head_and_shoulders',
                        confidenceWeight: HIGH_CONFIDENCE_WEIGHT,
                    }),
                ];
                const result = enrichAnalysisWithConfidence(analysis, skills);
                expect(result.patternSummaries[0].confidenceWeight).toBe(
                    HIGH_CONFIDENCE_WEIGHT
                );
            });

            it('영어 pattern 기반 fallback 매칭으로 renderConfig가 올바르게 주입된다', () => {
                const chartDisplay = makeSkillChartDisplay({ show: true });
                const analysis = makeAnalysisResponse({
                    patternSummaries: [
                        makePatternSummary({ skillName: 'head_and_shoulders' }),
                    ],
                });
                const skills = [
                    makeSkill({
                        name: '헤드앤숄더',
                        pattern: 'head_and_shoulders',
                        display: { chart: chartDisplay },
                    }),
                ];
                const result = enrichAnalysisWithConfidence(analysis, skills);
                expect(result.patternSummaries[0].renderConfig).toEqual(
                    chartDisplay
                );
            });
        });

        describe('filterPatterns 적용', () => {
            it('confidenceWeight가 MIN_CONFIDENCE_WEIGHT 미만인 패턴은 결과에서 제외된다', () => {
                const analysis = makeAnalysisResponse({
                    patternSummaries: [
                        makePatternSummary({ skillName: '없는스킬' }),
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
                expect(
                    result.patternSummaries.every(
                        p => p.confidenceWeight >= MIN_CONFIDENCE_WEIGHT
                    )
                ).toBe(true);
                expect(result.patternSummaries).toHaveLength(1);
                expect(result.patternSummaries[0].skillName).toBe('헤드앤숄더');
            });
        });

        describe('actionRecommendation pass-through', () => {
            it('actionRecommendation이 있으면 enriched 결과에 포함된다', () => {
                const analysis = makeAnalysisResponse({
                    actionRecommendation: {
                        positionAnalysis: '테스트 위치 분석',
                        entry: '테스트 진입',
                        exit: '테스트 청산',
                        riskReward: '테스트 손익비',
                    },
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.actionRecommendation).toBeDefined();
                expect(result.actionRecommendation?.positionAnalysis).toBe(
                    '테스트 위치 분석'
                );
            });

            it('actionRecommendation이 없으면 enriched 결과에도 없다', () => {
                const analysis = makeAnalysisResponse();
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.actionRecommendation).toBeUndefined();
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

            it('patternSummaries와 strategyResults 외의 필드는 변경하지 않는다', () => {
                const actionRecommendation = {
                    positionAnalysis: '원본 위치 분석',
                    entry: '원본 진입',
                    exit: '원본 청산',
                    riskReward: '원본 손익비',
                };
                const analysis = makeAnalysisResponse({
                    summary: '원본 요약',
                    trend: 'bearish',
                    riskLevel: 'high',
                    actionRecommendation,
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.summary).toBe('원본 요약');
                expect(result.trend).toBe('bearish');
                expect(result.riskLevel).toBe('high');
                expect(result.actionRecommendation).toEqual(
                    actionRecommendation
                );
            });
        });

        describe('indicatorResults 정규화', () => {
            it('유효한 indicatorResults 항목이 enriched 결과에 포함된다', () => {
                const analysis = makeAnalysisResponse({
                    indicatorResults: [
                        {
                            indicatorName: 'RSI',
                            signals: [
                                {
                                    type: 'skill',
                                    description: '과매수',
                                    trend: 'bearish',
                                    strength: 'strong',
                                },
                            ],
                        },
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.indicatorResults).toHaveLength(1);
                expect(result.indicatorResults[0].indicatorName).toBe('RSI');
                expect(result.indicatorResults[0].signals[0].description).toBe(
                    '과매수'
                );
            });

            it('indicatorName이 없는 항목은 탈락시킨다', () => {
                const analysis = makeAnalysisResponse({
                    indicatorResults: [
                        { signals: [] },
                        { indicatorName: 'MACD', signals: [] },
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.indicatorResults).toHaveLength(1);
                expect(result.indicatorResults[0].indicatorName).toBe('MACD');
            });
        });

        describe('trendlines 정규화', () => {
            it('유효한 trendline이 enriched 결과에 포함된다', () => {
                const analysis = makeAnalysisResponse({
                    trendlines: [
                        {
                            direction: 'ascending',
                            start: { time: 1, price: 100 },
                            end: { time: 2, price: 200 },
                        },
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.trendlines).toHaveLength(1);
                expect(result.trendlines[0].direction).toBe('ascending');
            });

            it('direction이 유효하지 않은 항목은 탈락시킨다', () => {
                const analysis = makeAnalysisResponse({
                    trendlines: [
                        {
                            direction: 'sideways',
                            start: { time: 1, price: 100 },
                            end: { time: 2, price: 200 },
                        },
                        {
                            direction: 'descending',
                            start: { time: 3, price: 300 },
                            end: { time: 4, price: 250 },
                        },
                    ],
                });
                const result = enrichAnalysisWithConfidence(analysis, []);
                expect(result.trendlines).toHaveLength(1);
                expect(result.trendlines[0].direction).toBe('descending');
            });
        });
    }); // enrichAnalysisWithConfidence
});
