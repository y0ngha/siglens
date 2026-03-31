import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import {
    HIGH_CONFIDENCE_WEIGHT,
    MIN_CONFIDENCE_WEIGHT,
    RSI_DEFAULT_PERIOD,
} from '@/domain/indicators/constants';
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
const TEST_HIGH_CONFIDENCE = HIGH_CONFIDENCE_WEIGHT;
const TEST_ABOVE_HIGH_CONFIDENCE = 0.9;
const TEST_MEDIUM_CONFIDENCE = 0.7;
const TEST_MIN_CONFIDENCE_WEIGHT = MIN_CONFIDENCE_WEIGHT;
const TEST_ABOVE_MIN_CONFIDENCE = 0.6;
const TEST_BELOW_MIN_CONFIDENCE = 0.4;
const TEST_LOW_CONFIDENCE = 0.3;
const TEST_MARKET_SECTION_INDEX = 1;
// expected value: ((110 - 100) / 100) * 100 = 10.00%
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
    name: 'Test Skill',
    description: 'Test description',
    indicators: [],
    confidenceWeight: TEST_HIGH_CONFIDENCE,
    content: '## Analysis Criteria\n- Test content',
    ...overrides,
});

describe('prompt', () => {
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

    describe('현재 시장 상황 섹션 - bars가 비어있을 때', () => {
        it('현재가, 변화율, 거래량 모두 N/A를 표시한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            const marketSection =
                result.split('\n\n')[TEST_MARKET_SECTION_INDEX];
            expect(marketSection).toContain('Current Price: N/A');
            expect(marketSection).toContain('Price Change %: N/A');
            expect(marketSection).toContain('Volume: N/A');
        });
    });

    describe('현재 시장 상황 섹션 - bars가 있을 때', () => {
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
            expect(result).toContain('Price Change %: N/A');
        });

        it('거래량을 포함한다', () => {
            const bars = [makeBar(0)];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toContain('Volume:');
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
            expect(result).toContain(`RSI(${RSI_DEFAULT_PERIOD}): N/A`);
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
            expect(result).toContain(`RSI(${RSI_DEFAULT_PERIOD}): N/A`);
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

        it('마지막 MACD 요소의 모든 필드가 null일 때 N/A를 표시한다', () => {
            const indicators = makeIndicators({
                macd: [{ macd: null, signal: null, histogram: null }],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
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
            expect(result).toContain('Bollinger Bands: Upper N/A');
        });

        it('마지막 볼린저 밴드 요소의 모든 필드가 null일 때 N/A를 표시한다', () => {
            const indicators = makeIndicators({
                bollinger: [{ upper: null, middle: null, lower: null }],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain('Bollinger Bands: Upper N/A');
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

        it('마지막 DMI 요소의 모든 필드가 null일 때 N/A를 표시한다', () => {
            const indicators = makeIndicators({
                dmi: [{ diPlus: null, diMinus: null, adx: null }],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
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

    describe('Skills 섹션 - skills가 비어있을 때', () => {
        it('패턴 분석 섹션이 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).not.toContain('Pattern Analysis');
        });

        it('활성화된 Skills 섹션이 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).not.toContain('Active Skills');
        });
    });

    describe('Skills 섹션 - confidenceWeight 필터링', () => {
        it('confidenceWeight가 0.5 미만인 skill은 포함되지 않는다', () => {
            const skill = makeSkill({
                name: 'Excluded Skill',
                confidenceWeight: TEST_BELOW_MIN_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('Excluded Skill');
        });

        it('confidenceWeight가 정확히 0.5일 때 포함된다', () => {
            const skill = makeSkill({
                name: 'Boundary Skill',
                confidenceWeight: TEST_MIN_CONFIDENCE_WEIGHT,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('Boundary Skill');
        });

        it('confidenceWeight가 0.5 이상인 skill은 포함된다', () => {
            const skill = makeSkill({
                name: 'Included Skill',
                confidenceWeight: TEST_ABOVE_MIN_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('Included Skill');
        });

        it('낮은 신뢰도 skill만 있을 때 skill 섹션이 포함되지 않는다', () => {
            const skills = [
                makeSkill({ confidenceWeight: TEST_LOW_CONFIDENCE }),
                makeSkill({ confidenceWeight: TEST_BELOW_MIN_CONFIDENCE }),
            ];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                skills
            );
            expect(result).not.toContain('Active Skills');
            expect(result).not.toContain('Pattern Analysis');
        });
    });

    describe('Skills 섹션 - type이 pattern인 skill일 때', () => {
        it('패턴 분석 섹션에 포함된다', () => {
            const skill = makeSkill({
                type: 'pattern',
                name: 'Double Top',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('Pattern Analysis');
            expect(result).toContain('Double Top');
        });

        it('활성화된 Skills 섹션에는 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'pattern',
                name: 'Double Top',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('Active Skills');
        });
    });

    describe('Skills 섹션 - type이 pattern이 아닌 skill일 때', () => {
        it('활성화된 Skills 섹션에 포함된다', () => {
            const skill = makeSkill({
                name: 'RSI Divergence',
                type: undefined,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('Active Skills');
            expect(result).toContain('RSI Divergence');
        });

        it('패턴 분석 섹션에는 포함되지 않는다', () => {
            const skill = makeSkill({
                name: 'RSI Divergence',
                type: undefined,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('Pattern Analysis');
        });
    });

    describe('Skills 섹션 - 신뢰도 레이블', () => {
        it('confidenceWeight가 0.8 이상이면 높은 신뢰도로 표시된다', () => {
            const skill = makeSkill({
                confidenceWeight: TEST_ABOVE_HIGH_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('[High Confidence]');
        });

        it('confidenceWeight가 정확히 0.8이면 높은 신뢰도로 표시된다', () => {
            const skill = makeSkill({
                confidenceWeight: TEST_HIGH_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('[High Confidence]');
        });

        it('confidenceWeight가 0.5 이상 0.8 미만이면 중간 신뢰도로 표시된다', () => {
            const skill = makeSkill({
                confidenceWeight: TEST_MEDIUM_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('[Medium Confidence]');
        });
    });

    describe('Skills 섹션 - skill 내용 포함', () => {
        it('skill의 name이 포함된다', () => {
            const skill = makeSkill({ name: 'Wyckoff Theory' });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('Wyckoff Theory');
        });

        it('skill의 content가 포함된다', () => {
            const skill = makeSkill({
                content: '## Special Analysis Criteria\n- Unique content',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('Special Analysis Criteria');
            expect(result).toContain('Unique content');
        });
    });

    describe('Skills 섹션 - 여러 skill이 있을 때', () => {
        it('패턴과 일반 skill이 각자 해당 섹션에 포함된다', () => {
            const patternSkill = makeSkill({
                type: 'pattern',
                name: 'Head and Shoulders',
            });
            const regularSkill = makeSkill({ name: 'RSI Divergence' });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [patternSkill, regularSkill]
            );
            expect(result).toContain('Pattern Analysis');
            expect(result).toContain('Head and Shoulders');
            expect(result).toContain('Active Skills');
            expect(result).toContain('RSI Divergence');
        });

        it('여러 패턴 skill이 모두 패턴 분석 섹션에 포함된다', () => {
            const skills = [
                makeSkill({ type: 'pattern', name: 'Double Top' }),
                makeSkill({ type: 'pattern', name: 'Double Bottom' }),
            ];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                skills
            );
            expect(result).toContain('Double Top');
            expect(result).toContain('Double Bottom');
        });

        it('높은 신뢰도와 낮은 신뢰도 skill이 섞여있을 때 낮은 것은 제외된다', () => {
            const skills = [
                makeSkill({
                    name: 'Included Skill',
                    confidenceWeight: TEST_HIGH_CONFIDENCE,
                }),
                makeSkill({
                    name: 'Excluded Skill',
                    confidenceWeight: TEST_LOW_CONFIDENCE,
                }),
            ];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                skills
            );
            expect(result).toContain('Included Skill');
            expect(result).not.toContain('Excluded Skill');
        });
    });

    describe('최근 봉 데이터 섹션 - bars가 비어있을 때', () => {
        it('데이터 없음을 표시한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('Recent Bar Data');
            expect(result).toContain('No data available');
        });
    });

    describe('최근 봉 데이터 섹션 - bars가 있을 때', () => {
        it('OHLCV 형식 레이블이 포함된다', () => {
            const bars = [makeBar(0, TEST_CLOSE_PRICE)];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toContain('O:');
            expect(result).toContain('H:');
            expect(result).toContain('L:');
            expect(result).toContain('C:');
            expect(result).toContain('V:');
        });

        it('캔들패턴이 대괄호 형식으로 포함된다', () => {
            const bars = [makeBar(0)];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toMatch(/\[.+\]/);
        });

        it('30개를 초과하는 봉이 있을 때 최근 30봉만 포함한다', () => {
            const bars = Array.from({ length: 31 }, (_, i) => makeBar(i));
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toContain('Last 30 bars');
        });

        it('봉이 30개 이하일 때 실제 봉 수를 표시한다', () => {
            const bars = Array.from({ length: 5 }, (_, i) => makeBar(i));
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toContain('Last 5 bars');
        });
    });

    describe('거래량 분석 섹션 - bars가 비어있을 때', () => {
        it('데이터 없음을 표시한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('Volume Analysis');
            expect(result).toContain('No data available');
        });
    });

    describe('거래량 분석 섹션 - bars가 있을 때', () => {
        it('봉 평균과 현재 거래량이 포함된다', () => {
            const bars = [makeBar(0)];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toContain('bar average');
            expect(result).toContain('Current volume');
        });

        it('평균 대비 비율이 포함된다', () => {
            const bars = [makeBar(0)];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toContain('% of average');
        });
    });

    describe('분석 가이드라인 섹션', () => {
        it('지지/저항 판단 가이드라인이 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('Support/Resistance Assessment');
        });

        it('가격 목표 산출 가이드라인이 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('Price Target Calculation');
        });

        it('가이드라인 섹션은 분석 요청 섹션보다 앞에 위치한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            const guidelineIndex = result.indexOf('Analysis Guidelines');
            const requestIndex = result.indexOf('Analysis Request');
            expect(guidelineIndex).toBeLessThan(requestIndex);
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

        it('skillSignals 필드가 요청에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('skillSignals');
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

        it('patternSummaries 필드가 요청에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('patternSummaries');
        });

        it('skillResults 필드가 요청에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('skillResults');
        });

        it('riskLevel 필드가 요청에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('riskLevel');
        });

        it('patternSummaries 스키마에 detected 필드가 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('detected');
        });

        it('patternSummaries 스키마에 keyPrices 필드가 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('keyPrices');
        });

        it('patternSummaries 스키마에 timeRange 필드가 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('timeRange');
        });

        it('keyLevels 스키마에 reason 필드가 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('"reason"');
        });

        it('keyLevels 스키마에 poc 필드가 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('"poc"');
        });

        it('priceTargets 필드가 요청에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('priceTargets');
        });

        it('priceTargets 스키마에 bullish와 bearish 시나리오가 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('"bullish"');
            expect(result).toContain('"bearish"');
        });
    });

    describe('candlePatterns 스키마', () => {
        it('candlePatterns 스키마 키가 프롬프트에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('candlePatterns');
        });

        it('가이드라인에 patternSummaries는 Skills 전용이라는 안내 문구가 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain(
                'Only include chart patterns defined in skills/*.md'
            );
        });
    });

    describe('분석 요청 섹션 - Skills 패턴 목록 지시', () => {
        it('패턴 skill이 있을 때 patternSummaries 작성 규칙 안내가 포함된다', () => {
            const skill = makeSkill({
                type: 'pattern',
                name: 'Head and Shoulders',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('patternSummaries Writing Rules');
        });

        it('패턴 skill이 있을 때 해당 패턴명이 분석 대상 목록에 포함된다', () => {
            const skill = makeSkill({
                type: 'pattern',
                name: 'Head and Shoulders',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('Skills pattern list to analyze');
            expect(result).toContain('- Head and Shoulders');
        });

        it('여러 패턴 skill이 있을 때 모든 패턴명이 목록에 포함된다', () => {
            const skills = [
                makeSkill({ type: 'pattern', name: 'Double Top' }),
                makeSkill({ type: 'pattern', name: 'Double Bottom' }),
            ];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                skills
            );
            expect(result).toContain('- Double Top');
            expect(result).toContain('- Double Bottom');
        });

        it('패턴 skill이 없을 때 patternSummaries 작성 규칙 안내가 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).not.toContain('patternSummaries Writing Rules');
        });

        it('패턴 skill이 있을 때 캔들 패턴을 patternSummaries에 포함하지 말라는 지시가 포함된다', () => {
            const skill = makeSkill({
                type: 'pattern',
                name: 'Head and Shoulders',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain(
                'Do not include candle patterns (single/multi candle) in patternSummaries'
            );
        });

        it('패턴 skill이 있을 때 감지되지 않은 패턴도 detected: false로 포함하라는 지시가 있다', () => {
            const skill = makeSkill({
                type: 'pattern',
                name: 'Head and Shoulders',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('detected: false');
        });

        it('일반 skill만 있을 때 patternSummaries 작성 규칙 안내가 포함되지 않는다', () => {
            const skill = makeSkill({
                name: 'RSI Divergence',
                type: undefined,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('patternSummaries Writing Rules');
        });

        it('confidenceWeight 미달 패턴 skill은 목록에 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'pattern',
                name: 'Excluded Pattern',
                confidenceWeight: TEST_BELOW_MIN_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('- Excluded Pattern');
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

    describe('한국어 응답 지시', () => {
        it('분석 요청 섹션에 한국어 응답 지시가 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('Korean');
        });

        it('한국어 응답 지시는 JSON 스키마보다 앞에 위치한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            const koreanInstructionIndex = result.indexOf('Korean');
            const schemaIndex = result.indexOf('"summary"');
            expect(koreanInstructionIndex).toBeLessThan(schemaIndex);
        });
    });

    describe('캔들 패턴 레이블', () => {
        it('단봉 캔들 패턴 레이블이 대괄호 형식으로 bar row에 포함된다', () => {
            const bars = [makeBar(0)];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toMatch(/\[.+\]/);
        });

        it('다봉 패턴 감지 시 패턴명이 포함된다', () => {
            const prevBar: Bar = {
                time: TEST_BAR_BASE_TIME,
                open: 110,
                high: 115,
                low: 105,
                close: 106,
                volume: TEST_BAR_BASE_VOLUME,
            };
            const currBar: Bar = {
                time: TEST_BAR_BASE_TIME + TEST_BAR_INTERVAL,
                open: 104,
                high: 120,
                low: 103,
                close: 118,
                volume: TEST_BAR_BASE_VOLUME,
            };
            const bars = [prevBar, currBar];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            if (result.includes('Detected multi-candle pattern:')) {
                expect(result).toMatch(/Detected multi-candle pattern: .+/);
            }
        });

        it('최근 15봉 이전에만 존재하는 다봉 패턴은 감지 결과에 포함되지 않는다', () => {
            // bars[3], bars[4]: bullish_engulfing (bearish then engulfing bullish)
            // bars[5] ~ bars[19]: 15 neutral bars with no detectable pattern
            const engulfingPrev: Bar = {
                time: TEST_BAR_BASE_TIME + 3 * TEST_BAR_INTERVAL,
                open: 105,
                high: 106,
                low: 99,
                close: 100,
                volume: TEST_BAR_BASE_VOLUME,
            };
            const engulfingCurr: Bar = {
                time: TEST_BAR_BASE_TIME + 4 * TEST_BAR_INTERVAL,
                open: 99,
                high: 108,
                low: 98,
                close: 107,
                volume: TEST_BAR_BASE_VOLUME,
            };
            const neutralBars: Bar[] = Array.from({ length: 15 }, (_, i) => ({
                time: TEST_BAR_BASE_TIME + (5 + i) * TEST_BAR_INTERVAL,
                open: 103,
                high: 104,
                low: 102,
                close: 103,
                volume: TEST_BAR_BASE_VOLUME,
            }));
            const leadingBars: Bar[] = Array.from({ length: 3 }, (_, i) => ({
                time: TEST_BAR_BASE_TIME + i * TEST_BAR_INTERVAL,
                open: 103,
                high: 104,
                low: 102,
                close: 103,
                volume: TEST_BAR_BASE_VOLUME,
            }));
            const bars = [
                ...leadingBars,
                engulfingPrev,
                engulfingCurr,
                ...neutralBars,
            ];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).not.toContain('bullish_engulfing');
        });
    });
});
