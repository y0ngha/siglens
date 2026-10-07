// vi.mock은 Vitest transform이 모든 static import 위로 호이스트하므로 import 블록 위에 둔다.
// import 사이에 끼우면 import/first 위반(TESTING.md#TE-1).
vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    isRegularSessionOpen: vi.fn(),
}));

import { describe, expect, it, vi } from 'vitest';
import type { Bar, BarsData } from '@y0ngha/siglens-core';
import {
    CRYPTO_SESSION,
    US_EQUITY_SESSION,
    isRegularSessionOpen,
} from '@y0ngha/siglens-core';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    hasFormingBar,
    quantizeBarsDataToLastClosed,
} from '@/entities/bars/lib/quantizeBars';

const mockOpen = vi.mocked(isRegularSessionOpen);
const now = new Date('2026-06-05T18:00:00Z');
const SECONDS_PER_DAY = 86_400;
const secOf = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`) / 1000;
const TODAY_SEC = secOf('2026-06-05');

/**
 * `bar(3)`이 `now`의 세션 날짜(오늘) 봉이고, `bar(2)`는 하루 전, `bar(1)`은 이틀 전이다.
 * 기존 fixture(3봉)에서 마지막 봉이 "형성 중인 오늘 봉"이 되도록 시각을 맞춘다.
 */
function bar(close: number): Bar {
    return {
        time: TODAY_SEC - (3 - close) * SECONDS_PER_DAY,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
    };
}

/**
 * Builds a BarsData fixture with 3 bars and indicators that exercise all
 * three shape categories the loop must handle:
 *   - plain per-bar array  : rsi, macd (object-element array)
 *   - Record-of-arrays     : ma (Record<number, (number|null)[]>)
 *   - whole-series snapshot: volumeProfile (null | object), smc (object whose
 *                            values are NOT all arrays → must NOT be sliced)
 */
function makeData(): BarsData {
    return {
        bars: [bar(1), bar(2), bar(3)],
        indicators: {
            // 1. Plain per-bar primitive arrays
            rsi: [10, 20, 30],
            cci: [1, 2, 3],
            vwap: [null, 5, 6],
            atr: [null, 2, 3],
            obv: [100, 200, 300],
            williamsR: [-80, -50, -20],
            mfi: [30, 50, 70],
            cmf: [0.1, 0.2, 0.3],
            macdV: [null, 1, 2],
            connorsRsi: [null, 40, 60],
            forceIndex: [null, 100, 200],
            elderImpulse: ['green', 'blue', 'red'],
            yangZhang: [null, 0.01, 0.02],
            ewmaVolatility: [null, 0.01, 0.02],
            hurst: [null, 0.5, 0.6],
            varianceRatio: [null, 1.0, 1.1],
            // 2. Plain per-bar object-element arrays
            macd: [
                { macdLine: 1, signalLine: 0.5, histogram: 0.5 },
                { macdLine: 2, signalLine: 1, histogram: 1 },
                { macdLine: 3, signalLine: 2, histogram: 1 },
            ],
            bollinger: [
                { upper: 10, middle: 8, lower: 6 },
                { upper: 11, middle: 9, lower: 7 },
                { upper: 12, middle: 10, lower: 8 },
            ],
            dmi: [
                { plusDI: 20, minusDI: 15, adx: 25 },
                { plusDI: 22, minusDI: 14, adx: 27 },
                { plusDI: 24, minusDI: 13, adx: 29 },
            ],
            stochastic: [
                { k: 50, d: 48 },
                { k: 55, d: 52 },
                { k: 60, d: 57 },
            ],
            stochRsi: [
                { k: 30, d: 28 },
                { k: 40, d: 35 },
                { k: 50, d: 45 },
            ],
            ichimoku: [
                { tenkan: 10, kijun: 9, senkouA: 11, senkouB: 8, chikou: 10 },
                { tenkan: 11, kijun: 10, senkouA: 12, senkouB: 9, chikou: 11 },
                { tenkan: 12, kijun: 11, senkouA: 13, senkouB: 10, chikou: 12 },
            ],
            parabolicSar: [
                { sar: 100, trend: 'long' },
                { sar: 98, trend: 'long' },
                { sar: 96, trend: 'short' },
            ],
            supertrend: [
                { value: 100, direction: 'up' },
                { value: 105, direction: 'up' },
                { value: 110, direction: 'down' },
            ],
            keltnerChannel: [
                { upper: 120, middle: 110, lower: 100 },
                { upper: 122, middle: 112, lower: 102 },
                { upper: 124, middle: 114, lower: 104 },
            ],
            donchianChannel: [
                { upper: 130, middle: 120, lower: 110 },
                { upper: 132, middle: 122, lower: 112 },
                { upper: 134, middle: 124, lower: 114 },
            ],
            buySellVolume: [
                { buyVolume: 500, sellVolume: 400, ratio: 1.25 },
                { buyVolume: 600, sellVolume: 500, ratio: 1.2 },
                { buyVolume: 700, sellVolume: 600, ratio: 1.17 },
            ],
            squeezeMomentum: [
                {
                    momentum: 0.1,
                    sqzOn: true,
                    sqzOff: false,
                    noSqz: false,
                    increasing: true,
                },
                {
                    momentum: 0.2,
                    sqzOn: true,
                    sqzOff: false,
                    noSqz: false,
                    increasing: true,
                },
                {
                    momentum: 0.3,
                    sqzOn: false,
                    sqzOff: true,
                    noSqz: false,
                    increasing: true,
                },
            ],
            elderRay: [
                { bullPower: 1, bearPower: -1 },
                { bullPower: 2, bearPower: -2 },
                { bullPower: 3, bearPower: -3 },
            ],
            bollingerDerived: [
                { pctB: 0.5, bandwidth: 0.1 },
                { pctB: 0.6, bandwidth: 0.2 },
                { pctB: 0.7, bandwidth: 0.3 },
            ],
            chandelierExit: [
                { longStop: 95, shortStop: 105, trend: 'long' },
                { longStop: 94, shortStop: 104, trend: 'long' },
                { longStop: 93, shortStop: 103, trend: 'short' },
            ],
            regression: [
                { slope: 0.1, rSquared: 0.9 },
                { slope: 0.2, rSquared: 0.85 },
                { slope: 0.3, rSquared: 0.8 },
            ],
            // 3. Record-of-arrays (per-period, per-bar)
            ma: { 20: [1, 2, 3], 50: [null, 2, 4] },
            ema: { 12: [1, 2, 3], 26: [null, 1, 2] },
            // 4. Whole-series snapshots — must NOT be sliced
            volumeProfile: {
                poc: 150,
                valueAreaHigh: 160,
                valueAreaLow: 140,
                valueArea: [],
            },
            smc: {
                swingHighs: [{ index: 2, price: 155, confirmed: true }],
                swingLows: [{ index: 0, price: 145, confirmed: true }],
                orderBlocks: [],
                fairValueGaps: [],
                equalHighs: [],
                equalLows: [],
                premiumZone: { high: 160, low: 155 },
                discountZone: { high: 145, low: 140 },
                equilibriumZone: null,
                structureBreaks: [],
            },
        } as never,
    };
}

describe('quantizeBarsDataToLastClosed', () => {
    describe('Open session — drops forming bar from bars AND all per-bar indicator arrays', () => {
        it('bars array length drops from 3 to 2', () => {
            mockOpen.mockReturnValue(true);
            const result = quantizeBarsDataToLastClosed(makeData(), now);
            expect(result.bars).toHaveLength(2);
            expect(result.bars).toEqual([bar(1), bar(2)]);
        });

        it('plain per-bar primitive array (rsi) is sliced to length 2', () => {
            mockOpen.mockReturnValue(true);
            const result = quantizeBarsDataToLastClosed(makeData(), now);
            expect(result.indicators.rsi).toEqual([10, 20]);
        });

        it('object-element per-bar array (macd) is sliced to length 2', () => {
            mockOpen.mockReturnValue(true);
            const result = quantizeBarsDataToLastClosed(makeData(), now);
            expect(result.indicators.macd).toHaveLength(2);
            // Last element (histogram: 1 at index 2) is dropped
            expect(result.indicators.macd[1]).toMatchObject({
                histogram: 1,
                macdLine: 2,
            });
        });

        it('Record-of-arrays (ma) has each period array sliced to length 2', () => {
            mockOpen.mockReturnValue(true);
            const result = quantizeBarsDataToLastClosed(makeData(), now);
            expect(result.indicators.ma[20]).toEqual([1, 2]);
            expect(result.indicators.ma[50]).toEqual([null, 2]);
        });

        it('Record-of-arrays (ema) is also sliced correctly', () => {
            mockOpen.mockReturnValue(true);
            const result = quantizeBarsDataToLastClosed(makeData(), now);
            expect(result.indicators.ema[12]).toEqual([1, 2]);
            expect(result.indicators.ema[26]).toEqual([null, 1]);
        });

        it('snapshot: volumeProfile is UNCHANGED (not sliced)', () => {
            mockOpen.mockReturnValue(true);
            const data = makeData();
            const result = quantizeBarsDataToLastClosed(data, now);
            // Same reference — not copied, not mutated
            expect(result.indicators.volumeProfile).toBe(
                data.indicators.volumeProfile
            );
        });

        it('snapshot: smc is UNCHANGED (not sliced even though it contains arrays internally)', () => {
            mockOpen.mockReturnValue(true);
            const data = makeData();
            const result = quantizeBarsDataToLastClosed(data, now);
            // Same reference — the "all values are arrays" predicate is false for smc
            // because premiumZone/discountZone are objects, not arrays.
            expect(result.indicators.smc).toBe(data.indicators.smc);
        });

        it('input BarsData is not mutated (bars and rsi are new arrays)', () => {
            mockOpen.mockReturnValue(true);
            const data = makeData();
            const originalBars = data.bars;
            const originalRsi = data.indicators.rsi;
            quantizeBarsDataToLastClosed(data, now);
            // Original arrays are untouched
            expect(data.bars).toBe(originalBars);
            expect(data.bars).toHaveLength(3);
            expect(data.indicators.rsi).toBe(originalRsi);
            expect(data.indicators.rsi).toHaveLength(3);
        });
    });

    describe('Closed session — everything unchanged', () => {
        it('returns the same BarsData reference when session is closed', () => {
            mockOpen.mockReturnValue(false);
            const data = makeData();
            const result = quantizeBarsDataToLastClosed(data, now);
            expect(result).toBe(data);
        });

        it('bars length stays 3 when closed', () => {
            mockOpen.mockReturnValue(false);
            const result = quantizeBarsDataToLastClosed(makeData(), now);
            expect(result.bars).toHaveLength(3);
        });
    });

    describe('Empty bars — returned unchanged regardless of session', () => {
        it('returns same reference when bars is empty (open session)', () => {
            mockOpen.mockReturnValue(true);
            const data: BarsData = { bars: [], indicators: {} as never };
            const result = quantizeBarsDataToLastClosed(data, now);
            expect(result).toBe(data);
        });

        it('returns same reference when bars is empty (closed session)', () => {
            mockOpen.mockReturnValue(false);
            const data: BarsData = { bars: [], indicators: {} as never };
            const result = quantizeBarsDataToLastClosed(data, now);
            expect(result).toBe(data);
        });
    });

    describe('Worst-case edge cases', () => {
        it('length-1 bars during open session → bars becomes [], per-bar arrays become []', () => {
            mockOpen.mockReturnValue(true);
            const data: BarsData = {
                bars: [bar(42)],
                indicators: {
                    rsi: [55],
                    ma: { 20: [100] },
                    smc: {
                        premiumZone: null,
                        discountZone: null,
                        equilibriumZone: null,
                        swingHighs: [],
                        swingLows: [],
                        orderBlocks: [],
                        fairValueGaps: [],
                        equalHighs: [],
                        equalLows: [],
                        structureBreaks: [],
                    },
                    volumeProfile: null,
                } as never,
            };
            const result = quantizeBarsDataToLastClosed(data, now);
            expect(result.bars).toEqual([]);
            expect(result.indicators.rsi).toEqual([]);
            expect(result.indicators.ma[20]).toEqual([]);
        });

        it('per-bar array that is already empty stays empty after slice', () => {
            mockOpen.mockReturnValue(true);
            // Edge: if a per-bar array were somehow empty, slicing it should stay []
            const data: BarsData = {
                bars: [bar(1), bar(2)],
                indicators: {
                    rsi: [10, 20],
                    cci: [], // pathological: empty despite 2 bars
                } as never,
            };
            const result = quantizeBarsDataToLastClosed(data, now);
            expect(result.indicators.cci).toEqual([]);
        });

        it('volumeProfile: null passes through (null branch)', () => {
            mockOpen.mockReturnValue(true);
            const data: BarsData = {
                bars: [bar(1), bar(2), bar(3)],
                indicators: {
                    rsi: [10, 20, 30],
                    volumeProfile: null,
                } as never,
            };
            const result = quantizeBarsDataToLastClosed(data, now);
            expect(result.indicators.volumeProfile).toBeNull();
        });

        it('calls isRegularSessionOpen with the session and now Date passed in', () => {
            mockOpen.mockReturnValue(false);
            const specificNow = new Date('2026-06-05T20:30:00Z');
            quantizeBarsDataToLastClosed(makeData(), specificNow);
            expect(mockOpen).toHaveBeenCalledWith(
                US_EQUITY_SESSION,
                specificNow
            );
        });
    });
});

/**
 * 공포·탐욕용 5년 일봉도 같은 형성 중 봉을 끝에 달고 있다. 표준 봉만 떼면 서버
 * 공포·탐욕 점수가 하루 더 앞선 봉(형성 중)까지 보고, 차트·요약의 기준일과 어긋난다.
 */
describe('quantizeBarsDataToLastClosed — fearGreedBars', () => {
    it('정규장 중이면 5년 일봉의 마지막(형성 중) 봉도 함께 뗀다', () => {
        mockOpen.mockReturnValue(true);
        const data: BarsData = {
            ...makeData(),
            fearGreedBars: [bar(0), bar(1), bar(2), bar(3)],
        };

        const result = quantizeBarsDataToLastClosed(
            data,
            now,
            US_EQUITY_SESSION
        );

        expect(result.fearGreedBars).toEqual([bar(0), bar(1), bar(2)]);
        expect(result.bars.at(-1)).toEqual(result.fearGreedBars?.at(-1));
    });

    it('5년 일봉이 없는 데이터에는 필드를 만들지 않는다', () => {
        mockOpen.mockReturnValue(true);

        const result = quantizeBarsDataToLastClosed(
            makeData(),
            now,
            US_EQUITY_SESSION
        );

        expect('fearGreedBars' in result).toBe(false);
    });
});

/**
 * `hasFormingBar`는 quantize가 마지막 봉을 떼는 조건과 **같은 술어**다 — 서버가 seed 상태를 클라이언트에
 * 알리고(`page.tsx`), 클라이언트가 뷰 시점을 판정하는(`ChartContent`) 근거이므로 둘이 갈라지면 안 된다.
 */
describe('hasFormingBar', () => {
    it('세션이 정규장 중이면 참, 아니면 거짓이다 (session 판정을 그대로 위임)', () => {
        mockOpen.mockReturnValue(true);
        expect(hasFormingBar(US_EQUITY_SESSION, now)).toBe(true);
        mockOpen.mockReturnValue(false);
        expect(hasFormingBar(US_EQUITY_SESSION, now)).toBe(false);
    });

    it('마지막 봉이 오늘 봉인 시리즈에서는 quantize가 봉을 떼는 경우와 일치한다 (오늘 봉이 없으면 떼지 않는다 — 아래 describe)', () => {
        const data = makeData();
        for (const open of [true, false]) {
            mockOpen.mockReturnValue(open);
            const trimmed =
                quantizeBarsDataToLastClosed(data, now, US_EQUITY_SESSION).bars
                    .length < data.bars.length;
            expect(trimmed).toBe(hasFormingBar(US_EQUITY_SESSION, now));
        }
    });
});

/**
 * 2026-10-06 운영 장애(373220.KS): 정규장 중인데 시리즈에 오늘 봉이 아직 없으면(휴장 직후·개장 직후)
 * 옛 quantize는 확정된 직전 거래일 봉을 형성 중 봉으로 오인해 떼었다 → 한 세션 뒤처진 종가.
 */
describe('quantizeBarsDataToLastClosed — 마지막 봉이 현재 세션 봉일 때만 뗀다', () => {
    const KR = sessionSpecFor('kr-equity');
    // 2026-10-06 화 10:00 KST(= 01:00Z), KRX 정규장 중.
    const krNow = new Date('2026-10-06T01:00:00Z');

    const ohlc = (isoDate: string, close: number): Bar => ({
        time: secOf(isoDate),
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
    });
    const dataOf = (bars: Bar[]): BarsData => ({
        bars,
        indicators: { rsi: bars.map(b => b.close), ma: {}, ema: {} } as never,
    });

    it('KR 정규장 중 시리즈가 직전 거래일(10-02)에서 끝나면 아무것도 떼지 않는다', () => {
        mockOpen.mockReturnValue(true);
        const data = dataOf([
            ohlc('2026-09-30', 357000),
            ohlc('2026-10-01', 360000),
            ohlc('2026-10-02', 371000),
        ]);

        const result = quantizeBarsDataToLastClosed(data, krNow, KR);

        expect(result).toBe(data);
        expect(result.bars.at(-1)?.close).toBe(371000);
    });

    it('KR 정규장 중 시리즈 끝이 오늘(10-06) 봉이면 그 봉만 뗀다', () => {
        mockOpen.mockReturnValue(true);
        const data = dataOf([
            ohlc('2026-10-01', 360000),
            ohlc('2026-10-02', 371000),
            ohlc('2026-10-06', 372000),
        ]);

        const result = quantizeBarsDataToLastClosed(data, krNow, KR);

        expect(result.bars.map(b => b.close)).toEqual([360000, 371000]);
        expect(result.indicators.rsi).toEqual([360000, 371000]);
    });

    it('KR은 거래소 현지(KST) 날짜로 오늘을 정한다 — UTC로는 아직 전날인 새벽 시각', () => {
        mockOpen.mockReturnValue(true);
        // 2026-10-06 09:10 KST = 2026-10-06 00:10Z. 10-06 봉은 오늘이다.
        const early = new Date('2026-10-06T00:10:00Z');
        const data = dataOf([
            ohlc('2026-10-02', 371000),
            ohlc('2026-10-06', 372000),
        ]);

        expect(
            quantizeBarsDataToLastClosed(data, early, KR).bars.map(b => b.close)
        ).toEqual([371000]);
    });

    it('KR 장 마감 중에는 오늘 봉이 있어도 떼지 않는다', () => {
        mockOpen.mockReturnValue(false);
        const data = dataOf([
            ohlc('2026-10-02', 371000),
            ohlc('2026-10-06', 372000),
        ]);

        expect(quantizeBarsDataToLastClosed(data, krNow, KR)).toBe(data);
    });

    it('crypto(24/7): 마지막 봉이 오늘(UTC) 봉이면 떼고, 어제 봉이면 보존한다', () => {
        mockOpen.mockReturnValue(true);
        const cryptoNow = new Date('2026-10-06T00:30:00Z');

        const withToday = dataOf([
            ohlc('2026-10-04', 1),
            ohlc('2026-10-05', 2),
            ohlc('2026-10-06', 3),
        ]);
        expect(
            quantizeBarsDataToLastClosed(
                withToday,
                cryptoNow,
                CRYPTO_SESSION
            ).bars.map(b => b.close)
        ).toEqual([1, 2]);

        const withoutToday = dataOf([
            ohlc('2026-10-04', 1),
            ohlc('2026-10-05', 2),
        ]);
        expect(
            quantizeBarsDataToLastClosed(
                withoutToday,
                cryptoNow,
                CRYPTO_SESSION
            )
        ).toBe(withoutToday);
    });

    it('US 정규장 중 시리즈가 전 거래일에서 끝나면 보존한다', () => {
        mockOpen.mockReturnValue(true);
        // 2026-06-05 금 14:00 ET.
        const data = dataOf([ohlc('2026-06-03', 1), ohlc('2026-06-04', 2)]);

        expect(quantizeBarsDataToLastClosed(data, now, US_EQUITY_SESSION)).toBe(
            data
        );
    });
});
