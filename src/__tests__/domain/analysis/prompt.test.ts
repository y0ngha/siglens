import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { CANDLE_PATTERN_DETECTION_BARS } from '@/domain/analysis/candle-detection';
import {
    HIGH_CONFIDENCE_WEIGHT,
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
    MA_DEFAULT_PERIODS,
    EMA_DEFAULT_PERIODS,
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
} from '@/domain/indicators/constants';
import {
    HAMMER_BODY_OFFSET,
    HAMMER_HIGH_OFFSET,
    HAMMER_LOW_OFFSET,
} from '@/__tests__/fixtures/candle';
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
const TEST_STOCHASTIC_K = 75.5;
const TEST_STOCHASTIC_D = 68.3;
const TEST_STOCH_RSI_K = 0.65;
const TEST_STOCH_RSI_D = 0.52;
const TEST_CCI_VALUE = 125.5;
const TEST_VP_POC = 150.0;
const TEST_VP_VAH = 160.0;
const TEST_VP_VAL = 140.0;
const TEST_ICHIMOKU_TENKAN = 152.5;
const TEST_ICHIMOKU_KIJUN = 148.0;
const TEST_ICHIMOKU_SENKOU_A = 155.0;
const TEST_ICHIMOKU_SENKOU_B = 145.0;
const TEST_ICHIMOKU_CHIKOU = 151.0;
const TEST_HIGH_CONFIDENCE = HIGH_CONFIDENCE_WEIGHT;
const TEST_ABOVE_HIGH_CONFIDENCE = 0.9;
const TEST_MEDIUM_CONFIDENCE = 0.7;
const TEST_MIN_CONFIDENCE_WEIGHT = MIN_CONFIDENCE_WEIGHT;
const TEST_ABOVE_MIN_CONFIDENCE = 0.6;
const TEST_BELOW_MIN_CONFIDENCE = 0.4;
const TEST_LOW_CONFIDENCE = 0.3;
const TEST_MARKET_SECTION_INDEX = 2;
// expected value: ((110 - 100) / 100) * 100 = 10.00%
const TEST_CHANGE_RATE_FORMATTED = `${(((TEST_NEXT_CLOSE - TEST_PREV_CLOSE) / TEST_PREV_CLOSE) * 100).toFixed(2)}%`;

const TEST_MA_5_VALUE = 152.3;
const TEST_MA_20_VALUE = 150.25;
const TEST_MA_60_VALUE = 148.1;
const TEST_MA_120_VALUE = 145.5;
const TEST_MA_200_VALUE = 142.8;
const TEST_ATR_VALUE = 2.45;
const TEST_OBV_VALUE = 1234567;
const TEST_PSAR_VALUE = 150.0;
const TEST_WILLIAMS_R_VALUE = -25.5;
const TEST_SUPERTREND_VALUE = 148.5;
const TEST_MFI_VALUE = 65.5;
const TEST_KELTNER_UPPER = 155.0;
const TEST_KELTNER_MIDDLE = 150.0;
const TEST_KELTNER_LOWER = 145.0;
const TEST_CMF_VALUE = 0.15;
const TEST_DONCHIAN_UPPER = 155.0;
const TEST_DONCHIAN_MIDDLE = 150.0;
const TEST_DONCHIAN_LOWER = 145.0;

const TEST_EMA_9_VALUE = 151.3;
const TEST_EMA_20_VALUE = 150.8;
const TEST_EMA_21_VALUE = 150.75;
const TEST_EMA_60_VALUE = 148.9;

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
    cci: [],
    vwap: [],
    macd: [],
    bollinger: [],
    dmi: [],
    stochastic: [],
    stochRsi: [],
    ma: {},
    ema: {},
    volumeProfile: null,
    ichimoku: [],
    atr: [],
    obv: [],
    parabolicSar: [],
    williamsR: [],
    supertrend: [],
    mfi: [],
    keltnerChannel: [],
    cmf: [],
    donchianChannel: [],
    ...overrides,
});

const makeEngulfingBars = (): [Bar, Bar] => [
    {
        time: TEST_BAR_BASE_TIME,
        open: 110,
        high: 115,
        low: 105,
        close: 106,
        volume: TEST_BAR_BASE_VOLUME,
    },
    {
        time: TEST_BAR_BASE_TIME + TEST_BAR_INTERVAL,
        open: 104,
        high: 120,
        low: 103,
        close: 118,
        volume: TEST_BAR_BASE_VOLUME,
    },
];

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

        it('Stochastic 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ stochastic: [] }),
                []
            );
            expect(result).toContain(
                `Stochastic(${STOCHASTIC_K_PERIOD},${STOCHASTIC_D_PERIOD},${STOCHASTIC_SMOOTHING}): %K N/A`
            );
        });

        it('마지막 Stochastic 요소의 모든 필드가 null일 때 N/A를 표시한다', () => {
            const indicators = makeIndicators({
                stochastic: [{ percentK: null, percentD: null }],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(
                `Stochastic(${STOCHASTIC_K_PERIOD},${STOCHASTIC_D_PERIOD},${STOCHASTIC_SMOOTHING}): %K N/A`
            );
        });

        it('Stochastic 값을 포함한다', () => {
            const indicators = makeIndicators({
                stochastic: [
                    {
                        percentK: TEST_STOCHASTIC_K,
                        percentD: TEST_STOCHASTIC_D,
                    },
                ],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(TEST_STOCHASTIC_K.toFixed(2));
            expect(result).toContain(TEST_STOCHASTIC_D.toFixed(2));
        });

        it('StochRSI 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ stochRsi: [] }),
                []
            );
            expect(result).toContain(
                `StochRSI(${STOCH_RSI_RSI_PERIOD},${STOCH_RSI_STOCH_PERIOD},${STOCH_RSI_K_PERIOD},${STOCH_RSI_D_PERIOD}): K N/A`
            );
        });

        it('마지막 StochRSI 요소의 모든 필드가 null일 때 N/A를 표시한다', () => {
            const indicators = makeIndicators({
                stochRsi: [{ k: null, d: null }],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(
                `StochRSI(${STOCH_RSI_RSI_PERIOD},${STOCH_RSI_STOCH_PERIOD},${STOCH_RSI_K_PERIOD},${STOCH_RSI_D_PERIOD}): K N/A`
            );
        });

        it('StochRSI 값을 포함한다', () => {
            const indicators = makeIndicators({
                stochRsi: [
                    {
                        k: TEST_STOCH_RSI_K,
                        d: TEST_STOCH_RSI_D,
                    },
                ],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(TEST_STOCH_RSI_K.toFixed(2));
            expect(result).toContain(TEST_STOCH_RSI_D.toFixed(2));
        });
    });

    describe('지표 섹션 - CCI', () => {
        it('CCI 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ cci: [] }),
                []
            );
            expect(result).toContain(`CCI(${CCI_DEFAULT_PERIOD}): N/A`);
        });

        it('CCI 배열이 모두 null일 때 N/A를 표시한다', () => {
            const indicators = makeIndicators({
                cci: [null, null, null],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(`CCI(${CCI_DEFAULT_PERIOD}): N/A`);
        });

        it('CCI 값을 포함한다', () => {
            const indicators = makeIndicators({
                cci: [null, TEST_CCI_VALUE],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(TEST_CCI_VALUE.toFixed(2));
        });
    });

    describe('지표 섹션 - Volume Profile', () => {
        it('volumeProfile이 null일 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ volumeProfile: null }),
                []
            );
            expect(result).toContain(
                'Volume Profile: POC N/A / VAH N/A / VAL N/A'
            );
        });

        it('volumeProfile 값이 있을 때 POC/VAH/VAL 값을 포함한다', () => {
            const indicators = makeIndicators({
                volumeProfile: {
                    poc: TEST_VP_POC,
                    vah: TEST_VP_VAH,
                    val: TEST_VP_VAL,
                    profile: [],
                },
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(TEST_VP_POC.toFixed(2));
            expect(result).toContain(TEST_VP_VAH.toFixed(2));
            expect(result).toContain(TEST_VP_VAL.toFixed(2));
        });
    });

    describe('지표 섹션 - MA', () => {
        it('ma가 빈 객체일 때 모든 기간이 N/A로 표시된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ ma: {} }),
                []
            );
            MA_DEFAULT_PERIODS.forEach(p => {
                expect(result).toContain(`MA(${p}): N/A`);
            });
        });

        it('MA 배열이 전부 null일 때 N/A로 표시된다', () => {
            const indicators = makeIndicators({
                ma: {
                    5: [null, null],
                    20: [null, null],
                    60: [null, null],
                    120: [null, null],
                    200: [null, null],
                },
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            MA_DEFAULT_PERIODS.forEach(p => {
                expect(result).toContain(`MA(${p}): N/A`);
            });
        });

        it('각 기간별 MA 값이 프롬프트에 포함된다', () => {
            const indicators = makeIndicators({
                ma: {
                    5: [null, TEST_MA_5_VALUE],
                    20: [null, TEST_MA_20_VALUE],
                    60: [null, TEST_MA_60_VALUE],
                    120: [null, TEST_MA_120_VALUE],
                    200: [null, TEST_MA_200_VALUE],
                },
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(`MA(5): ${TEST_MA_5_VALUE.toFixed(2)}`);
            expect(result).toContain(`MA(20): ${TEST_MA_20_VALUE.toFixed(2)}`);
            expect(result).toContain(`MA(60): ${TEST_MA_60_VALUE.toFixed(2)}`);
            expect(result).toContain(
                `MA(120): ${TEST_MA_120_VALUE.toFixed(2)}`
            );
            expect(result).toContain(
                `MA(200): ${TEST_MA_200_VALUE.toFixed(2)}`
            );
        });
    });

    describe('지표 섹션 - EMA', () => {
        it('ema가 빈 객체일 때 모든 기간이 N/A로 표시된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ ema: {} }),
                []
            );
            EMA_DEFAULT_PERIODS.forEach(p => {
                expect(result).toContain(`EMA(${p}): N/A`);
            });
        });

        it('EMA 배열이 전부 null일 때 N/A로 표시된다', () => {
            const indicators = makeIndicators({
                ema: {
                    9: [null, null],
                    20: [null, null],
                    21: [null, null],
                    60: [null, null],
                },
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            EMA_DEFAULT_PERIODS.forEach(p => {
                expect(result).toContain(`EMA(${p}): N/A`);
            });
        });

        it('각 기간별 EMA 값이 프롬프트에 포함된다', () => {
            const indicators = makeIndicators({
                ema: {
                    9: [null, TEST_EMA_9_VALUE],
                    20: [null, TEST_EMA_20_VALUE],
                    21: [null, TEST_EMA_21_VALUE],
                    60: [null, TEST_EMA_60_VALUE],
                },
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(`EMA(9): ${TEST_EMA_9_VALUE.toFixed(2)}`);
            expect(result).toContain(
                `EMA(20): ${TEST_EMA_20_VALUE.toFixed(2)}`
            );
            expect(result).toContain(
                `EMA(21): ${TEST_EMA_21_VALUE.toFixed(2)}`
            );
            expect(result).toContain(
                `EMA(60): ${TEST_EMA_60_VALUE.toFixed(2)}`
            );
        });
    });

    describe('지표 섹션 - Ichimoku', () => {
        it('ichimoku 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ ichimoku: [] }),
                []
            );
            expect(result).toContain(
                `Ichimoku(${ICHIMOKU_CONVERSION_PERIOD},${ICHIMOKU_BASE_PERIOD},${ICHIMOKU_SPAN_B_PERIOD}): Tenkan N/A`
            );
        });

        it('마지막 ichimoku 요소의 모든 필드가 null일 때 N/A를 표시한다', () => {
            const indicators = makeIndicators({
                ichimoku: [
                    {
                        tenkan: null,
                        kijun: null,
                        senkouA: null,
                        senkouB: null,
                        chikou: null,
                    },
                ],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(
                `Ichimoku(${ICHIMOKU_CONVERSION_PERIOD},${ICHIMOKU_BASE_PERIOD},${ICHIMOKU_SPAN_B_PERIOD}): Tenkan N/A`
            );
        });

        it('ichimoku 값을 포함한다', () => {
            const indicators = makeIndicators({
                ichimoku: [
                    {
                        tenkan: TEST_ICHIMOKU_TENKAN,
                        kijun: TEST_ICHIMOKU_KIJUN,
                        senkouA: TEST_ICHIMOKU_SENKOU_A,
                        senkouB: TEST_ICHIMOKU_SENKOU_B,
                        chikou: TEST_ICHIMOKU_CHIKOU,
                    },
                ],
            });
            const result = buildAnalysisPrompt(TEST_SYMBOL, [], indicators, []);
            expect(result).toContain(TEST_ICHIMOKU_TENKAN.toFixed(2));
            expect(result).toContain(TEST_ICHIMOKU_KIJUN.toFixed(2));
            expect(result).toContain(TEST_ICHIMOKU_SENKOU_A.toFixed(2));
            expect(result).toContain(TEST_ICHIMOKU_SENKOU_B.toFixed(2));
            expect(result).toContain(TEST_ICHIMOKU_CHIKOU.toFixed(2));
        });
    });

    describe('지표 섹션 - ATR', () => {
        it('atr 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ atr: [] }),
                []
            );
            expect(result).toContain(`ATR(${ATR_DEFAULT_PERIOD}): N/A`);
        });

        it('atr 값을 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ atr: [null, TEST_ATR_VALUE] }),
                []
            );
            expect(result).toContain(
                `ATR(${ATR_DEFAULT_PERIOD}): ${TEST_ATR_VALUE.toFixed(2)}`
            );
        });
    });

    describe('지표 섹션 - OBV', () => {
        it('obv 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ obv: [] }),
                []
            );
            expect(result).toContain('OBV: N/A');
        });

        it('obv 값을 comma 포매팅하여 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ obv: [TEST_OBV_VALUE] }),
                []
            );
            expect(result).toContain('OBV: 1,234,567');
        });
    });

    describe('지표 섹션 - Parabolic SAR', () => {
        it('parabolicSar 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ parabolicSar: [] }),
                []
            );
            expect(result).toContain('Parabolic SAR: N/A (N/A)');
        });

        it('parabolicSar 값과 trend를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({
                    parabolicSar: [{ sar: TEST_PSAR_VALUE, trend: 'up' }],
                }),
                []
            );
            expect(result).toContain(
                `Parabolic SAR: ${TEST_PSAR_VALUE.toFixed(2)} (up)`
            );
        });
    });

    describe('지표 섹션 - Williams %R', () => {
        it('williamsR 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ williamsR: [] }),
                []
            );
            expect(result).toContain(
                `Williams %R(${WILLIAMS_R_DEFAULT_PERIOD}): N/A`
            );
        });

        it('williamsR 값을 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ williamsR: [null, TEST_WILLIAMS_R_VALUE] }),
                []
            );
            expect(result).toContain(
                `Williams %R(${WILLIAMS_R_DEFAULT_PERIOD}): ${TEST_WILLIAMS_R_VALUE.toFixed(2)}`
            );
        });
    });

    describe('지표 섹션 - Supertrend', () => {
        it('supertrend 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ supertrend: [] }),
                []
            );
            expect(result).toContain(
                `Supertrend(${SUPERTREND_ATR_PERIOD},${SUPERTREND_MULTIPLIER}): N/A (N/A)`
            );
        });

        it('supertrend 값과 trend를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({
                    supertrend: [
                        { supertrend: TEST_SUPERTREND_VALUE, trend: 'up' },
                    ],
                }),
                []
            );
            expect(result).toContain(
                `Supertrend(${SUPERTREND_ATR_PERIOD},${SUPERTREND_MULTIPLIER}): ${TEST_SUPERTREND_VALUE.toFixed(2)} (up)`
            );
        });
    });

    describe('지표 섹션 - MFI', () => {
        it('mfi 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ mfi: [] }),
                []
            );
            expect(result).toContain(`MFI(${MFI_DEFAULT_PERIOD}): N/A`);
        });

        it('mfi 값을 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ mfi: [null, TEST_MFI_VALUE] }),
                []
            );
            expect(result).toContain(
                `MFI(${MFI_DEFAULT_PERIOD}): ${TEST_MFI_VALUE.toFixed(2)}`
            );
        });
    });

    describe('지표 섹션 - Keltner Channel', () => {
        it('keltnerChannel 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ keltnerChannel: [] }),
                []
            );
            expect(result).toContain(
                `Keltner Channel(${KELTNER_EMA_PERIOD},${KELTNER_ATR_PERIOD},${KELTNER_MULTIPLIER}): Upper N/A`
            );
        });

        it('keltnerChannel 값을 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({
                    keltnerChannel: [
                        {
                            upper: TEST_KELTNER_UPPER,
                            middle: TEST_KELTNER_MIDDLE,
                            lower: TEST_KELTNER_LOWER,
                        },
                    ],
                }),
                []
            );
            expect(result).toContain(TEST_KELTNER_UPPER.toFixed(2));
            expect(result).toContain(TEST_KELTNER_MIDDLE.toFixed(2));
            expect(result).toContain(TEST_KELTNER_LOWER.toFixed(2));
        });
    });

    describe('지표 섹션 - CMF', () => {
        it('cmf 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ cmf: [] }),
                []
            );
            expect(result).toContain(`CMF(${CMF_DEFAULT_PERIOD}): N/A`);
        });

        it('cmf 값을 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ cmf: [null, TEST_CMF_VALUE] }),
                []
            );
            expect(result).toContain(
                `CMF(${CMF_DEFAULT_PERIOD}): ${TEST_CMF_VALUE.toFixed(2)}`
            );
        });
    });

    describe('지표 섹션 - Donchian Channel', () => {
        it('donchianChannel 배열이 비어있을 때 N/A를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({ donchianChannel: [] }),
                []
            );
            expect(result).toContain(
                `Donchian Channel(${DONCHIAN_DEFAULT_PERIOD}): Upper N/A`
            );
        });

        it('donchianChannel 값을 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators({
                    donchianChannel: [
                        {
                            upper: TEST_DONCHIAN_UPPER,
                            middle: TEST_DONCHIAN_MIDDLE,
                            lower: TEST_DONCHIAN_LOWER,
                        },
                    ],
                }),
                []
            );
            expect(result).toContain(TEST_DONCHIAN_UPPER.toFixed(2));
            expect(result).toContain(TEST_DONCHIAN_MIDDLE.toFixed(2));
            expect(result).toContain(TEST_DONCHIAN_LOWER.toFixed(2));
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
            expect(result).toMatch(/\[.+]/);
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
            expect(result).toContain('"keyPrices"');
            expect(result).toContain('"label": "넥라인"');
        });

        it('patternSummaries 스키마에 patternLines 필드가 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('"patternLines"');
            expect(result).toContain('"label": "상단 추세선"');
            expect(result).toContain('"label": "하단 추세선"');
        });

        it('patternSummaries 스키마의 keyPrices가 label/price 구조를 포함한다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('"label": "넥라인"');
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

    describe('trendlines 스키마', () => {
        it('trendlines 스키마 키가 프롬프트에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('"direction": "ascending | descending"');
        });

        it('가이드라인에 추세선 감지 지침이 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).toContain('Trendline Detection');
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
            expect(result).toMatch(/\[.+]/);
        });

        it('다봉 패턴 감지 시 패턴명이 포함된다', () => {
            // prevBar(음봉) → currBar(양봉, 장악형 조건 충족) → bullish_engulfing 반드시 감지됨
            const bars = makeEngulfingBars();
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toMatch(/Multi-candle pattern: .+/);
        });

        it('슬라이딩 윈도우로 감지된 다봉 패턴은 봉 위치와 함께 포함된다', () => {
            // prevBar(음봉) → currBar(양봉, 장악형 조건 충족) → bullish_engulfing 반드시 감지됨
            const bars = makeEngulfingBars();
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toMatch(/\[\d+ bars ago] Multi-candle pattern: .+/);
        });

        it('단봉 패턴은 봉 위치 정보와 함께 패턴 섹션에 포함된다', () => {
            const bars = [makeBar(0)];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toMatch(/\[\d+ bars ago] Single candle pattern: .+/);
        });

        it('다봉 패턴이 있으면 해당 다봉 패턴과 관련 봉의 단봉 패턴만 포함된다', () => {
            // hammer bar (단봉) + engulfing pair (다봉)
            // 마지막 패턴(다봉)과 그 관련 봉의 단봉만 포함되어야 함
            const hammerBar: Bar = {
                time: TEST_BAR_BASE_TIME - TEST_BAR_INTERVAL,
                open: TEST_BAR_BASE_PRICE,
                high: TEST_BAR_BASE_PRICE + HAMMER_HIGH_OFFSET,
                low: TEST_BAR_BASE_PRICE + HAMMER_LOW_OFFSET,
                close: TEST_BAR_BASE_PRICE + HAMMER_BODY_OFFSET,
                volume: TEST_BAR_BASE_VOLUME,
            };
            const [engulfingPrev, engulfingCurr] = makeEngulfingBars();
            const bars = [hammerBar, engulfingPrev, engulfingCurr];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            // Multi-candle pattern should be included
            expect(result).toMatch(/Multi-candle pattern: .+/);
            // Hammer bar is NOT involved in the multi pattern, so it should be excluded
            const patternSection =
                result.split('Short-term Trend Signal')[1] ?? '';
            expect(patternSection).not.toContain('Hammer');
        });

        it('다봉 패턴만 존재할 때 해당 다봉 패턴만 포함된다', () => {
            // prevBar(음봉) → currBar(양봉, 장악형 조건 충족) → bullish_engulfing 감지
            // 다봉 패턴에 관련된 봉의 단봉 패턴은 detectCandlePatternEntries에서 이미 제외됨
            const bars = makeEngulfingBars();
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                bars,
                makeIndicators(),
                []
            );
            expect(result).toMatch(/Multi-candle pattern/);
            expect(result).not.toMatch(/Single candle pattern/);
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
            const neutralBars: Bar[] = Array.from(
                { length: CANDLE_PATTERN_DETECTION_BARS },
                (_, i) => ({
                    time: TEST_BAR_BASE_TIME + (5 + i) * TEST_BAR_INTERVAL,
                    open: 103,
                    high: 104,
                    low: 102,
                    close: 103,
                    volume: TEST_BAR_BASE_VOLUME,
                })
            );
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

    describe('Skills 섹션 - type이 indicator_guide인 skill일 때', () => {
        it('Indicator Signal Guides 섹션에 포함된다', () => {
            const skill = makeSkill({
                type: 'indicator_guide',
                name: 'RSI Signal Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('Indicator Signal Guides');
            expect(result).toContain('RSI Signal Guide');
        });

        it('패턴 분석 섹션에는 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'indicator_guide',
                name: 'RSI Signal Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('Pattern Analysis');
        });

        it('활성화된 Skills 섹션에는 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'indicator_guide',
                name: 'RSI Signal Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('Active Skills');
        });

        it('indicator_guide skill이 없을 때 Indicator Signal Guides 섹션이 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).not.toContain('Indicator Signal Guides');
        });

        it('여러 indicator_guide skill이 모두 Indicator Signal Guides 섹션에 포함된다', () => {
            const skills = [
                makeSkill({
                    type: 'indicator_guide',
                    name: 'RSI Signal Guide',
                }),
                makeSkill({
                    type: 'indicator_guide',
                    name: 'MACD Signal Guide',
                }),
            ];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                skills
            );
            expect(result).toContain('Indicator Signal Guides');
            expect(result).toContain('RSI Signal Guide');
            expect(result).toContain('MACD Signal Guide');
        });

        it('indicator_guide, pattern, regular skill이 각각 해당 섹션에 포함된다', () => {
            const indicatorGuideSkill = makeSkill({
                type: 'indicator_guide',
                name: 'RSI Signal Guide',
            });
            const patternSkill = makeSkill({
                type: 'pattern',
                name: 'Head and Shoulders',
            });
            const regularSkill = makeSkill({
                type: undefined,
                name: 'Wyckoff Theory',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [indicatorGuideSkill, patternSkill, regularSkill]
            );
            expect(result).toContain('Indicator Signal Guides');
            expect(result).toContain('RSI Signal Guide');
            expect(result).toContain('Pattern Analysis');
            expect(result).toContain('Head and Shoulders');
            expect(result).toContain('Active Skills');
            expect(result).toContain('Wyckoff Theory');
        });

        it('confidenceWeight가 0.5 미만인 indicator_guide skill은 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'indicator_guide',
                name: 'Low Confidence Guide',
                confidenceWeight: TEST_BELOW_MIN_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('Low Confidence Guide');
            expect(result).not.toContain('Indicator Signal Guides');
        });
    });

    describe('분석 요청 섹션 - Indicator Guide Writing Rules', () => {
        it('indicator_guide skill이 있을 때 signals Writing Rules for Indicator Guides 섹션이 포함된다', () => {
            const skill = makeSkill({
                type: 'indicator_guide',
                name: 'RSI Signal Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain(
                'signals Writing Rules for Indicator Guides'
            );
        });

        it('indicator_guide skill이 없을 때 signals Writing Rules for Indicator Guides 섹션이 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).not.toContain(
                'signals Writing Rules for Indicator Guides'
            );
        });

        it('indicator_guide skill 이름 목록이 분석 요청에 포함된다', () => {
            const skills = [
                makeSkill({
                    type: 'indicator_guide',
                    name: 'RSI Signal Guide',
                }),
                makeSkill({
                    type: 'indicator_guide',
                    name: 'MACD Signal Guide',
                }),
            ];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                skills
            );
            expect(result).toContain('Indicator guide list to apply:');
            expect(result).toContain('- RSI Signal Guide');
            expect(result).toContain('- MACD Signal Guide');
        });

        it('indicator_guide Writing Rules에 시그널 type을 "skill"로 사용하도록 지시한다', () => {
            const skill = makeSkill({
                type: 'indicator_guide',
                name: 'RSI Signal Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain(
                'The type field of each signal entry MUST be "skill"'
            );
        });

        it('indicator_guide Writing Rules에 description 필드 작성 형식 지시가 포함된다', () => {
            const skill = makeSkill({
                type: 'indicator_guide',
                name: 'RSI Signal Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain(
                'The description field must be written in Korean and include the indicator name and specific condition'
            );
        });

        it('indicator_guide Writing Rules는 pattern Writing Rules보다 앞에 위치한다', () => {
            const indicatorGuideSkill = makeSkill({
                type: 'indicator_guide',
                name: 'RSI Signal Guide',
            });
            const patternSkill = makeSkill({
                type: 'pattern',
                name: 'Head and Shoulders',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [indicatorGuideSkill, patternSkill]
            );
            const indicatorGuideIndex = result.indexOf(
                'signals Writing Rules for Indicator Guides'
            );
            const patternWritingRulesIndex = result.indexOf(
                'patternSummaries Writing Rules'
            );
            expect(indicatorGuideIndex).toBeLessThan(patternWritingRulesIndex);
        });

        it('confidenceWeight가 0.5 미만인 indicator_guide skill은 Writing Rules 목록에 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'indicator_guide',
                name: 'Low Confidence Guide',
                confidenceWeight: TEST_BELOW_MIN_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain(
                'signals Writing Rules for Indicator Guides'
            );
            expect(result).not.toContain('- Low Confidence Guide');
        });
    });

    describe('요약 작성 가이드라인', () => {
        let result: string;

        beforeEach(() => {
            result = buildAnalysisPrompt(TEST_SYMBOL, [], makeIndicators(), []);
        });

        it('접근 가능한 언어 지시가 포함된다', () => {
            expect(result).toContain('accessible');
        });

        it('모든 섹션 종합 지시가 포함된다', () => {
            expect(result).toContain('synthesize ALL');
        });

        it('Summary Writing Guidelines 섹션이 포함된다', () => {
            expect(result).toContain('Summary Writing Guidelines');
        });
    });

    describe('매매 추천 가이드라인', () => {
        let result: string;

        beforeEach(() => {
            result = buildAnalysisPrompt(TEST_SYMBOL, [], makeIndicators(), []);
        });

        it('Action Recommendation Guidelines 섹션이 포함된다', () => {
            expect(result).toContain('Action Recommendation Guidelines');
        });

        it('actionRecommendation 필드가 스키마에 포함된다', () => {
            expect(result).toContain('"actionRecommendation"');
        });

        it('actionRecommendation 스키마에 positionAnalysis 필드가 포함된다', () => {
            expect(result).toContain('positionAnalysis');
        });

        it('actionRecommendation 스키마에 entry 필드가 포함된다', () => {
            expect(result).toContain('"entry"');
        });

        it('actionRecommendation 스키마에 exit 필드가 포함된다', () => {
            expect(result).toContain('"exit"');
        });

        it('actionRecommendation 스키마에 riskReward 필드가 포함된다', () => {
            expect(result).toContain('riskReward');
        });

        it('actionRecommendation 스키마에 entryPrices 필드가 포함된다', () => {
            expect(result).toContain('entryPrices');
        });

        it('actionRecommendation 스키마에 stopLoss 필드가 포함된다', () => {
            expect(result).toContain('stopLoss');
        });

        it('actionRecommendation 스키마에 takeProfitPrices 필드가 포함된다', () => {
            expect(result).toContain('takeProfitPrices');
        });
    });

    describe('Skills 섹션 - type이 strategy인 skill일 때', () => {
        const strategySkill = makeSkill({
            type: 'strategy',
            name: '엘리어트 파동',
        });

        it('Strategy Analysis 섹션에 포함된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [strategySkill]
            );
            expect(result).toContain('Strategy Analysis');
            expect(result).toContain('엘리어트 파동');
        });

        it('Active Skills 섹션에는 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [strategySkill]
            );
            expect(result).not.toContain('Active Skills');
        });

        it('Pattern Analysis 섹션에는 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [strategySkill]
            );
            expect(result).not.toContain('Pattern Analysis');
        });

        it('strategy skill에 대한 skillResults Writing Rules 지시사항이 생성된다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [strategySkill]
            );
            expect(result).toContain(
                'skillResults Writing Rules for Strategy Skills'
            );
            expect(result).toContain('- 엘리어트 파동');
        });

        it('strategy skill이 없으면 skillResults Writing Rules 지시사항이 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).not.toContain(
                'skillResults Writing Rules for Strategy Skills'
            );
        });

        it('confidenceWeight가 0.5 미만인 strategy skill은 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'strategy',
                name: '낮은신뢰도전략',
                confidenceWeight: TEST_BELOW_MIN_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('낮은신뢰도전략');
            expect(result).not.toContain('Strategy Analysis');
        });

        it('pattern, strategy, regular skill이 모두 있을 때 각 섹션에 올바르게 분류된다', () => {
            const patternSkill = makeSkill({
                type: 'pattern',
                name: 'Head and Shoulders',
            });
            const strategySkill = makeSkill({
                type: 'strategy',
                name: '엘리어트 파동',
            });
            const regularSkill = makeSkill({
                type: undefined,
                name: 'Wyckoff Theory',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [patternSkill, strategySkill, regularSkill]
            );
            expect(result).toContain('Pattern Analysis');
            expect(result).toContain('Head and Shoulders');
            expect(result).toContain('Strategy Analysis');
            expect(result).toContain('엘리어트 파동');
            expect(result).toContain('Active Skills');
            expect(result).toContain('Wyckoff Theory');
        });
    });

    describe('Skills 섹션 - type이 candlestick인 skill일 때', () => {
        it('Candlestick Pattern Guides 섹션에 포함된다', () => {
            const skill = makeSkill({
                type: 'candlestick',
                name: 'Engulfing Pattern Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain('Candlestick Pattern Guides');
            expect(result).toContain('Engulfing Pattern Guide');
        });

        it('패턴 분석 섹션에는 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'candlestick',
                name: 'Engulfing Pattern Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('Pattern Analysis');
        });

        it('활성화된 Skills 섹션에는 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'candlestick',
                name: 'Engulfing Pattern Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('Active Skills');
        });

        it('candlestick skill이 없을 때 Candlestick Pattern Guides 섹션이 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).not.toContain('Candlestick Pattern Guides');
        });

        it('여러 candlestick skill이 모두 Candlestick Pattern Guides 섹션에 포함된다', () => {
            const skills = [
                makeSkill({
                    type: 'candlestick',
                    name: 'Engulfing Pattern Guide',
                }),
                makeSkill({
                    type: 'candlestick',
                    name: 'Doji Pattern Guide',
                }),
            ];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                skills
            );
            expect(result).toContain('Candlestick Pattern Guides');
            expect(result).toContain('Engulfing Pattern Guide');
            expect(result).toContain('Doji Pattern Guide');
        });

        it('candlestick, pattern, indicator_guide, strategy, regular skill이 각각 해당 섹션에 포함된다', () => {
            const candlestickSkill = makeSkill({
                type: 'candlestick',
                name: 'Engulfing Pattern Guide',
            });
            const patternSkill = makeSkill({
                type: 'pattern',
                name: 'Head and Shoulders',
            });
            const indicatorGuideSkill = makeSkill({
                type: 'indicator_guide',
                name: 'RSI Signal Guide',
            });
            const strategySkill = makeSkill({
                type: 'strategy',
                name: '엘리어트 파동',
            });
            const regularSkill = makeSkill({
                type: undefined,
                name: 'Wyckoff Theory',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [
                    candlestickSkill,
                    patternSkill,
                    indicatorGuideSkill,
                    strategySkill,
                    regularSkill,
                ]
            );
            expect(result).toContain('Candlestick Pattern Guides');
            expect(result).toContain('Engulfing Pattern Guide');
            expect(result).toContain('Pattern Analysis');
            expect(result).toContain('Head and Shoulders');
            expect(result).toContain('Indicator Signal Guides');
            expect(result).toContain('RSI Signal Guide');
            expect(result).toContain('Strategy Analysis');
            expect(result).toContain('엘리어트 파동');
            expect(result).toContain('Active Skills');
            expect(result).toContain('Wyckoff Theory');
        });

        it('confidenceWeight가 0.5 미만인 candlestick skill은 포함되지 않는다', () => {
            const skill = makeSkill({
                type: 'candlestick',
                name: 'Low Confidence Guide',
                confidenceWeight: TEST_BELOW_MIN_CONFIDENCE,
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).not.toContain('Low Confidence Guide');
            expect(result).not.toContain('Candlestick Pattern Guides');
        });
    });

    describe('분석 요청 섹션 - Candlestick Writing Rules', () => {
        it('candlestick skill이 있을 때 candlePatterns Writing Rules 섹션이 포함된다', () => {
            const skill = makeSkill({
                type: 'candlestick',
                name: 'Engulfing Pattern Guide',
            });
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                [skill]
            );
            expect(result).toContain(
                'candlePatterns Writing Rules for Candlestick Skills'
            );
        });

        it('candlestick skill이 없을 때 candlePatterns Writing Rules 섹션이 포함되지 않는다', () => {
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                []
            );
            expect(result).not.toContain(
                'candlePatterns Writing Rules for Candlestick Skills'
            );
        });

        it('candlestick skill 이름 목록이 분석 요청에 포함된다', () => {
            const skills = [
                makeSkill({
                    type: 'candlestick',
                    name: 'Engulfing Pattern Guide',
                }),
                makeSkill({
                    type: 'candlestick',
                    name: 'Doji Pattern Guide',
                }),
            ];
            const result = buildAnalysisPrompt(
                TEST_SYMBOL,
                [],
                makeIndicators(),
                skills
            );
            expect(result).toContain(
                'Candlestick pattern guide list to apply:'
            );
            expect(result).toContain('- Engulfing Pattern Guide');
            expect(result).toContain('- Doji Pattern Guide');
        });
    });
});
