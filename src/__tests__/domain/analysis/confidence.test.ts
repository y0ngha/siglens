import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import type { RawAnalysisResponse } from '@/domain/analysis/confidence';
import { HIGH_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';
import type { Skill } from '@/domain/types';

const TEST_HIGH_CONFIDENCE = HIGH_CONFIDENCE_WEIGHT;
const TEST_MEDIUM_CONFIDENCE = 0.7;

const makeSkill = (overrides?: Partial<Skill>): Skill => ({
    name: '테스트 스킬',
    description: '테스트 설명',
    indicators: [],
    confidenceWeight: TEST_HIGH_CONFIDENCE,
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
    ...overrides,
});

describe('confidence', () => {
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
                    confidenceWeight: TEST_HIGH_CONFIDENCE,
                }),
            ];
            const result = enrichAnalysisWithConfidence(analysis, skills);
            expect(result.patternSummaries[0].confidenceWeight).toBe(
                TEST_HIGH_CONFIDENCE
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
                    confidenceWeight: TEST_HIGH_CONFIDENCE,
                }),
            ];
            const result = enrichAnalysisWithConfidence(analysis, skills);
            expect(result.patternSummaries[0].confidenceWeight).toBe(0);
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
                    confidenceWeight: TEST_HIGH_CONFIDENCE,
                }),
            ];
            const result = enrichAnalysisWithConfidence(analysis, skills);
            expect(result.skillResults[0].confidenceWeight).toBe(0);
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
            expect(result.patternSummaries[0].confidenceWeight).toBe(0);
            expect(result.skillResults[0].confidenceWeight).toBe(0);
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
                    confidenceWeight: TEST_HIGH_CONFIDENCE,
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
