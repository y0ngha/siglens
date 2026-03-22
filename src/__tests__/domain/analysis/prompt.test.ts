import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import type { Bar, IndicatorResult, Skill } from '@/domain/types';

const TEST_SYMBOL = 'AAPL';
const TEST_BAR_BASE_TIME = 1700000000;
const TEST_BAR_INTERVAL = 60;
const TEST_BAR_BASE_PRICE = 100;
const TEST_BAR_BASE_HIGH = 110;
const TEST_BAR_BASE_LOW = 90;
const TEST_BAR_BASE_VOLUME = 1000;
const TEST_CLOSE_PRICE = 150.0;
const TEST_PREV_CLOSE = 100.0;
const TEST_NEXT_CLOSE = 110.0;
const TEST_RSI_VALUE = 65.5;
const TEST_MACD_VALUE = 1.23;
const TEST_SIGNAL_VALUE = 0.98;
const TEST_HISTOGRAM_VALUE = 0.25;
const TEST_BOLLINGER_UPPER = 155.0;
const TEST_BOLLINGER_MIDDLE = 150.0;
const TEST_BOLLINGER_LOWER = 145.0;
const TEST_DI_PLUS = 25.0;
const TEST_DI_MINUS = 18.0;
const TEST_ADX_VALUE = 30.0;
const TEST_HIGH_CONFIDENCE = 0.8;
const TEST_ABOVE_HIGH_CONFIDENCE = 0.9;
const TEST_MEDIUM_CONFIDENCE = 0.7;
const TEST_MIN_CONFIDENCE_WEIGHT = 0.5;
const TEST_ABOVE_MIN_CONFIDENCE = 0.6;
const TEST_BELOW_MIN_CONFIDENCE = 0.4;
const TEST_LOW_CONFIDENCE = 0.3;
const TEST_MARKET_SECTION_INDEX = 1;
const TEST_CHANGE_RATE_FORMATTED = `${(((TEST_NEXT_CLOSE - TEST_PREV_CLOSE) / TEST_PREV_CLOSE) * 100).toFixed(2)}%`;

const makeBar = (i: number, close?: number): Bar => ({
    time: TEST_BAR_BASE_TIME + i * TEST_BAR_INTERVAL,
    open: TEST_BAR_BASE_PRICE + i,
    high: TEST_BAR_BASE_HIGH + i,
    low: TEST_BAR_BASE_LOW + i,
    close: close ?? TEST_BAR_BASE_PRICE + i,
    volume: TEST_BAR_BASE_VOLUME,
});

const makeIndicators = (
    overrides?: Partial<IndicatorResult>
): IndicatorResult => ({
    rsi: [],
    vwap: [],
    macd: [],
    bollinger: [],
    dmi: [],
    ma: {},
    ema: {},
    ...overrides,
});

const makeSkill = (overrides?: Partial<Skill>): Skill => ({
    name: '테스트 스킬',
    description: '테스트 설명',
    indicators: [],
    confidence_weight: TEST_HIGH_CONFIDENCE,
    content: '## 분석 기준\n- 테스트 내용',
    ...overrides,
});

describe('buildAnalysisPrompt', () => {
    describe('반환 타입', () => {
        it('문자열을 반환한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(typeof result).toBe('string');
        });
    });

    describe('종목명 섹션', () => {
        it('symbol이 프롬프트에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain(TEST_SYMBOL);
        });
    });

    describe('현재 시장 상황 섹션', () => {
        describe('bars가 비어있을 때', () => {
            it('현재가, 변화율, 거래량 모두 N/A를 표시한다', () => {
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    []
                );
                const marketSection =
                    result.split('\n\n')[TEST_MARKET_SECTION_INDEX];
                expect(marketSection).toContain('현재가: N/A');
                expect(marketSection).toContain('변화율: N/A');
                expect(marketSection).toContain('거래량: N/A');
            });
        });

        describe('bars가 있을 때', () => {
            it('현재가(마지막 봉의 종가)를 포함한다', () => {
                const bars = [makeBar(0, TEST_CLOSE_PRICE)];
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    bars,
                    makeIndicators(),
                    []
                );
                expect(result).toContain(TEST_CLOSE_PRICE.toFixed(2));
            });

            it('봉이 2개 이상일 때 변화율을 포함한다', () => {
                const bars = [
                    makeBar(0, TEST_PREV_CLOSE),
                    makeBar(1, TEST_NEXT_CLOSE),
                ];
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    bars,
                    makeIndicators(),
                    []
                );
                expect(result).toContain(TEST_CHANGE_RATE_FORMATTED);
            });

            it('봉이 1개일 때 변화율은 N/A다', () => {
                const bars = [makeBar(0, TEST_CLOSE_PRICE)];
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    bars,
                    makeIndicators(),
                    []
                );
                expect(result).toContain('변화율: N/A');
            });

            it('거래량을 포함한다', () => {
                const bars = [makeBar(0)];
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    bars,
                    makeIndicators(),
                    []
                );
                expect(result).toContain('거래량:');
            });
        });
    });

    describe('인디케이터 수치 섹션', () => {
        it('RSI 값이 없을 때 N/A를 표시한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ rsi: [] }),
                []
            );
            expect(result).toContain('RSI(14): N/A');
        });

        it('초기 null 구간 이후 마지막 RSI 값을 포함한다', () => {
            const indicators = makeIndicators({
                rsi: [null, null, TEST_RSI_VALUE],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(TEST_RSI_VALUE.toFixed(2));
        });

        it('전부 null인 RSI 배열일 때 N/A를 표시한다', () => {
            const indicators = makeIndicators({ rsi: [null, null, null] });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain('RSI(14): N/A');
        });

        it('MACD 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ macd: [] }),
                []
            );
            expect(result).toContain('MACD: N/A');
        });

        it('MACD 값을 포함한다', () => {
            const indicators = makeIndicators({
                macd: [
                    {
                        macd: TEST_MACD_VALUE,
                        signal: TEST_SIGNAL_VALUE,
                        histogram: TEST_HISTOGRAM_VALUE,
                    },
                ],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(TEST_MACD_VALUE.toFixed(2));
            expect(result).toContain(TEST_SIGNAL_VALUE.toFixed(2));
            expect(result).toContain(TEST_HISTOGRAM_VALUE.toFixed(2));
        });

        it('볼린저 밴드 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ bollinger: [] }),
                []
            );
            expect(result).toContain('볼린저 밴드: Upper N/A');
        });

        it('볼린저 밴드 값을 포함한다', () => {
            const indicators = makeIndicators({
                bollinger: [
                    {
                        upper: TEST_BOLLINGER_UPPER,
                        middle: TEST_BOLLINGER_MIDDLE,
                        lower: TEST_BOLLINGER_LOWER,
                    },
                ],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(TEST_BOLLINGER_UPPER.toFixed(2));
            expect(result).toContain(TEST_BOLLINGER_MIDDLE.toFixed(2));
            expect(result).toContain(TEST_BOLLINGER_LOWER.toFixed(2));
        });

        it('DMI 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ dmi: [] }),
                []
            );
            expect(result).toContain('DMI: +DI N/A');
        });

        it('DMI 값을 포함한다', () => {
            const indicators = makeIndicators({
                dmi: [
                    {
                        diPlus: TEST_DI_PLUS,
                        diMinus: TEST_DI_MINUS,
                        adx: TEST_ADX_VALUE,
                    },
                ],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(TEST_DI_PLUS.toFixed(2));
            expect(result).toContain(TEST_DI_MINUS.toFixed(2));
            expect(result).toContain(TEST_ADX_VALUE.toFixed(2));
        });
    });

    describe('Skills 섹션', () => {
        describe('skills가 비어있을 때', () => {
            it('패턴 분석 섹션이 포함되지 않는다', () => {
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    []
                );
                expect(result).not.toContain('패턴 분석');
            });

            it('활성화된 Skills 섹션이 포함되지 않는다', () => {
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    []
                );
                expect(result).not.toContain('활성화된 Skills');
            });
        });

        describe('confidence_weight 필터링', () => {
            it('confidence_weight가 0.5 미만인 skill은 포함되지 않는다', () => {
                const skill = makeSkill({
                    name: '제외될 스킬',
                    confidence_weight: TEST_BELOW_MIN_CONFIDENCE,
                });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).not.toContain('제외될 스킬');
            });

            it('confidence_weight가 정확히 0.5일 때 포함된다', () => {
                const skill = makeSkill({
                    name: '경계값 스킬',
                    confidence_weight: TEST_MIN_CONFIDENCE_WEIGHT,
                });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).toContain('경계값 스킬');
            });

            it('confidence_weight가 0.5 이상인 skill은 포함된다', () => {
                const skill = makeSkill({
                    name: '포함될 스킬',
                    confidence_weight: TEST_ABOVE_MIN_CONFIDENCE,
                });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).toContain('포함될 스킬');
            });

            it('낮은 신뢰도 skill만 있을 때 skill 섹션이 포함되지 않는다', () => {
                const skills = [
                    makeSkill({ confidence_weight: TEST_LOW_CONFIDENCE }),
                    makeSkill({ confidence_weight: TEST_BELOW_MIN_CONFIDENCE }),
                ];
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    skills
                );
                expect(result).not.toContain('활성화된 Skills');
                expect(result).not.toContain('패턴 분석');
            });
        });

        describe('type: pattern skill', () => {
            it('패턴 분석 섹션에 포함된다', () => {
                const skill = makeSkill({ type: 'pattern', name: '이중천장' });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).toContain('패턴 분석');
                expect(result).toContain('이중천장');
            });

            it('활성화된 Skills 섹션에는 포함되지 않는다', () => {
                const skill = makeSkill({ type: 'pattern', name: '이중천장' });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).not.toContain('활성화된 Skills');
            });
        });

        describe('type이 pattern이 아닌 skill', () => {
            it('활성화된 Skills 섹션에 포함된다', () => {
                const skill = makeSkill({ name: 'RSI 다이버전스' });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).toContain('활성화된 Skills');
                expect(result).toContain('RSI 다이버전스');
            });

            it('패턴 분석 섹션에는 포함되지 않는다', () => {
                const skill = makeSkill({ name: 'RSI 다이버전스' });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).not.toContain('패턴 분석');
            });
        });

        describe('신뢰도 레이블', () => {
            it('confidence_weight가 0.8 이상이면 높은 신뢰도로 표시된다', () => {
                const skill = makeSkill({
                    confidence_weight: TEST_ABOVE_HIGH_CONFIDENCE,
                });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).toContain('[높은 신뢰도]');
            });

            it('confidence_weight가 정확히 0.8이면 높은 신뢰도로 표시된다', () => {
                const skill = makeSkill({
                    confidence_weight: TEST_HIGH_CONFIDENCE,
                });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).toContain('[높은 신뢰도]');
            });

            it('confidence_weight가 0.5 이상 0.8 미만이면 중간 신뢰도로 표시된다', () => {
                const skill = makeSkill({
                    confidence_weight: TEST_MEDIUM_CONFIDENCE,
                });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).toContain('[중간 신뢰도]');
            });
        });

        describe('skill 내용 포함', () => {
            it('skill의 name이 포함된다', () => {
                const skill = makeSkill({ name: '와이코프 이론' });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).toContain('와이코프 이론');
            });

            it('skill의 content가 포함된다', () => {
                const skill = makeSkill({
                    content: '## 특별한 분석 기준\n- 고유한 내용',
                });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [skill]
                );
                expect(result).toContain('특별한 분석 기준');
                expect(result).toContain('고유한 내용');
            });
        });

        describe('여러 skill이 있을 때', () => {
            it('패턴과 일반 skill이 각자 해당 섹션에 포함된다', () => {
                const patternSkill = makeSkill({
                    type: 'pattern',
                    name: '헤드앤숄더',
                });
                const regularSkill = makeSkill({ name: 'RSI 다이버전스' });
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    [patternSkill, regularSkill]
                );
                expect(result).toContain('패턴 분석');
                expect(result).toContain('헤드앤숄더');
                expect(result).toContain('활성화된 Skills');
                expect(result).toContain('RSI 다이버전스');
            });

            it('여러 패턴 skill이 모두 패턴 분석 섹션에 포함된다', () => {
                const skills = [
                    makeSkill({ type: 'pattern', name: '이중천장' }),
                    makeSkill({ type: 'pattern', name: '이중바닥' }),
                ];
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    skills
                );
                expect(result).toContain('이중천장');
                expect(result).toContain('이중바닥');
            });

            it('높은 신뢰도와 낮은 신뢰도 skill이 섞여있을 때 낮은 것은 제외된다', () => {
                const skills = [
                    makeSkill({
                        name: '포함될 스킬',
                        confidence_weight: TEST_HIGH_CONFIDENCE,
                    }),
                    makeSkill({
                        name: '제외될 스킬',
                        confidence_weight: TEST_LOW_CONFIDENCE,
                    }),
                ];
                const result = buildAnalysisPrompt(
                    TEST_SYMBOL,
                    [],
                    makeIndicators(),
                    skills
                );
                expect(result).toContain('포함될 스킬');
                expect(result).not.toContain('제외될 스킬');
            });
        });
    });

    describe('분석 요청 섹션', () => {
        it('JSON 형식 응답을 요청한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('JSON');
        });

        it('trend 필드가 요청에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('trend');
        });

        it('signals 필드가 요청에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('signals');
        });

        it('keyLevels 필드가 요청에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('keyLevels');
        });
    });

    describe('skills 기본값', () => {
        it('skills 파라미터를 생략하면 빈 배열과 동일하게 동작한다', () => {
            const withEmpty = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            const withDefault = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators()
            );
            expect(withDefault).toBe(withEmpty);
        });
    });
});
