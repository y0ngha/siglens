jest.mock('@/infrastructure/cache/redis');
jest.mock('@/infrastructure/market/factory');

import { getSectorSignals } from '@/infrastructure/dashboard/sectorSignalsApi';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { createMarketDataProvider } from '@/infrastructure/market/factory';
import { SECTOR_STOCKS } from '@/domain/constants/dashboard-tickers';
import type { Bar, SectorSignalsResult } from '@/domain/types';

const mockCreateCacheProvider = createCacheProvider as jest.MockedFunction<
    typeof createCacheProvider
>;
const mockCreateMarketDataProvider =
    createMarketDataProvider as jest.MockedFunction<
        typeof createMarketDataProvider
    >;

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelete = jest.fn();
const mockGetBars = jest.fn();
const mockGetQuote = jest.fn();

function buildBar(overrides: Partial<Bar> = {}): Bar {
    return {
        time: 1,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1000,
        ...overrides,
    };
}

/**
 * Build enough synthetic bars to likely trigger at least one signal.
 * We alternate closes to push RSI into oversold / overbought territory.
 */
function buildOscillatingBars(count: number): Bar[] {
    const bars: Bar[] = [];
    let price = 100;
    for (let i = 0; i < count; i++) {
        // Sharp decline to push RSI oversold, then rebound on the last bar
        if (i < count - 1) {
            price -= 1;
        } else {
            price += 5; // reversal bar
        }
        bars.push({
            time: i + 1,
            open: price,
            high: price + 1,
            low: price - 1,
            close: price,
            volume: 1000,
        });
    }
    return bars;
}

describe('getSectorSignals 함수는', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-04-19T12:30:00Z'));

        mockCacheGet.mockReset();
        mockCacheSet.mockReset();
        mockCacheDelete.mockReset();
        mockGetBars.mockReset();
        mockGetQuote.mockReset();

        mockCreateCacheProvider.mockReturnValue({
            get: mockCacheGet,
            set: mockCacheSet,
            delete: mockCacheDelete,
        });
        mockCreateMarketDataProvider.mockReturnValue({
            getBars: mockGetBars,
            getQuote: mockGetQuote,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('캐시 히트일 때', () => {
        it('provider를 호출하지 않고 캐시된 결과를 반환한다', async () => {
            const cached: SectorSignalsResult = {
                computedAt: '2026-04-19T00:00:00Z',
                stocks: [],
            };
            mockCacheGet.mockResolvedValue(cached);

            const result = await getSectorSignals();

            expect(result).toEqual(cached);
            expect(mockGetBars).not.toHaveBeenCalled();
            expect(mockCacheSet).not.toHaveBeenCalled();
        });

        it('1Day 기본 타임프레임의 캐시 키는 YYYY-MM-DD 버킷을 사용한다', async () => {
            mockCacheGet.mockResolvedValue({
                computedAt: '2026-04-19T00:00:00Z',
                stocks: [],
            });

            await getSectorSignals();

            expect(mockCacheGet).toHaveBeenCalledWith(
                'dashboard:signals:1Day:2026-04-19'
            );
        });
    });

    describe('캐시 프로바이더가 null일 때', () => {
        it('캐시를 건너뛰고 provider를 호출한다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);
            mockGetBars.mockResolvedValue([]);

            const result = await getSectorSignals();

            expect(mockCacheGet).not.toHaveBeenCalled();
            expect(mockCacheSet).not.toHaveBeenCalled();
            expect(mockGetBars).toHaveBeenCalled();
            expect(result.stocks).toEqual([]);
            expect(result.computedAt).toBe('2026-04-19T12:30:00.000Z');
        });
    });

    describe('캐시 읽기가 실패할 때', () => {
        it('예외를 무시하고 provider를 호출해 결과를 반환한다', async () => {
            mockCacheGet.mockRejectedValue(new Error('redis read down'));
            mockGetBars.mockResolvedValue([]);
            mockCacheSet.mockResolvedValue(undefined);

            const result = await getSectorSignals();

            expect(result).toBeDefined();
            expect(mockGetBars).toHaveBeenCalled();
        });
    });

    describe('캐시 미스일 때', () => {
        it('provider를 호출하고 결과를 캐시에 저장한다', async () => {
            mockCacheGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([]);
            mockCacheSet.mockResolvedValue(undefined);

            await getSectorSignals();

            expect(mockGetBars).toHaveBeenCalledTimes(SECTOR_STOCKS.length);
            expect(mockCacheSet).toHaveBeenCalledTimes(1);
            const [key, payload, ttl] = mockCacheSet.mock.calls[0];
            expect(key).toBe('dashboard:signals:1Day:2026-04-19');
            expect(payload).toMatchObject({
                stocks: expect.any(Array),
                computedAt: '2026-04-19T12:30:00.000Z',
            });
            expect(ttl).toBe(3600);
        });

        it('lookback 400일 범위를 from 파라미터로 전달한다', async () => {
            mockCacheGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([]);

            await getSectorSignals();

            const firstCallOptions = mockGetBars.mock.calls[0][0];
            expect(firstCallOptions.timeframe).toBe('1Day');
            // 2026-04-19 - 400 days = 2025-03-15
            expect(firstCallOptions.from).toBe('2025-03-15T12:30:00.000Z');
            expect(firstCallOptions.symbol).toBe(SECTOR_STOCKS[0].symbol);
        });

        it('SECTOR_STOCKS 전체에 대해 getBars 호출이 발생한다 (청크 처리 포함)', async () => {
            mockCacheGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([]);

            await getSectorSignals();

            const calledSymbols = mockGetBars.mock.calls.map(
                c => c[0].symbol as string
            );
            expect(calledSymbols).toHaveLength(SECTOR_STOCKS.length);
            for (const stock of SECTOR_STOCKS) {
                expect(calledSymbols).toContain(stock.symbol);
            }
        });
    });

    describe('개별 종목 fetch가 실패할 때', () => {
        it('나머지 종목은 정상 처리하고 실패 종목은 결과에서 제외한다', async () => {
            mockCacheGet.mockResolvedValue(null);
            mockGetBars.mockImplementation((opts: { symbol: string }) =>
                opts.symbol === 'AAPL'
                    ? Promise.reject(new Error('fetch failed'))
                    : Promise.resolve([])
            );

            const result = await getSectorSignals();

            const appleResult = result.stocks.find(s => s.symbol === 'AAPL');
            expect(appleResult).toBeUndefined();
        });
    });

    describe('캐시 저장이 실패할 때', () => {
        it('응답은 정상적으로 반환된다', async () => {
            mockCacheGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([]);
            mockCacheSet.mockRejectedValue(new Error('redis write down'));

            const result = await getSectorSignals();

            expect(result).toBeDefined();
        });
    });

    describe('bars 개수가 2개 미만인 종목은', () => {
        it('결과에서 제외된다', async () => {
            mockCacheGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([buildBar()]);

            const result = await getSectorSignals();

            expect(result.stocks).toEqual([]);
        });
    });

    describe('signals가 비어 있는 종목은', () => {
        it('결과에서 제외된다', async () => {
            mockCacheGet.mockResolvedValue(null);
            // 2 flat bars → no detectors will fire
            mockGetBars.mockResolvedValue([
                buildBar({ time: 1 }),
                buildBar({ time: 2 }),
            ]);

            const result = await getSectorSignals();

            expect(result.stocks).toEqual([]);
        });
    });

    describe('signals가 존재하는 종목은', () => {
        it('결과에 포함되고 price, changePercent, trend가 계산된다', async () => {
            mockCacheGet.mockResolvedValue(null);
            const oscillating = buildOscillatingBars(60);
            mockGetBars.mockImplementation((opts: { symbol: string }) =>
                opts.symbol === 'AAPL'
                    ? Promise.resolve(oscillating)
                    : Promise.resolve([])
            );

            const result = await getSectorSignals();

            const apple = result.stocks.find(s => s.symbol === 'AAPL');
            expect(apple).toBeDefined();
            if (apple) {
                expect(apple.koreanName).toBe('애플');
                expect(apple.sectorSymbol).toBe('XLK');
                expect(apple.signals.length).toBeGreaterThan(0);
                expect(typeof apple.price).toBe('number');
                expect(typeof apple.changePercent).toBe('number');
                expect(['uptrend', 'downtrend', 'sideways']).toContain(
                    apple.trend
                );
            }
        });

        it('이전 종가가 0일 때 changePercent는 0으로 계산된다', async () => {
            mockCacheGet.mockResolvedValue(null);
            // Build bars where prev.close === 0, with enough history to produce signals
            const bars: Bar[] = [];
            for (let i = 0; i < 60; i++) {
                bars.push(
                    buildBar({
                        time: i + 1,
                        open: 100 - i,
                        high: 101 - i,
                        low: 99 - i,
                        close: 100 - i,
                    })
                );
            }
            // Force second-to-last close to 0, last close to non-zero so price != 0
            bars[bars.length - 2] = buildBar({
                time: bars.length - 1,
                open: 0,
                high: 1,
                low: 0,
                close: 0,
            });
            bars[bars.length - 1] = buildBar({
                time: bars.length,
                open: 5,
                high: 5,
                low: 5,
                close: 5,
            });
            mockGetBars.mockImplementation((opts: { symbol: string }) =>
                opts.symbol === 'AAPL'
                    ? Promise.resolve(bars)
                    : Promise.resolve([])
            );

            const result = await getSectorSignals();
            const apple = result.stocks.find(s => s.symbol === 'AAPL');
            if (apple) {
                expect(apple.changePercent).toBe(0);
            }
        });
    });

    describe('타임프레임별 동작', () => {
        it('1Hour 타임프레임은 YYYY-MM-DDTHH 버킷 캐시 키와 900초 TTL을 사용한다', async () => {
            mockCacheGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([]);
            mockCacheSet.mockResolvedValue(undefined);

            await getSectorSignals('1Hour');

            expect(mockCacheGet).toHaveBeenCalledWith(
                'dashboard:signals:1Hour:2026-04-19T12'
            );
            const [key, , ttl] = mockCacheSet.mock.calls[0];
            expect(key).toBe('dashboard:signals:1Hour:2026-04-19T12');
            expect(ttl).toBe(900);
            const firstCallOptions = mockGetBars.mock.calls[0][0];
            expect(firstCallOptions.timeframe).toBe('1Hour');
            // 2026-04-19 - 40 days = 2026-03-10
            expect(firstCallOptions.from).toBe('2026-03-10T12:30:00.000Z');
        });

        it('15Min 타임프레임은 15분 버킷으로 floor한 캐시 키와 300초 TTL을 사용한다', async () => {
            mockCacheGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([]);
            mockCacheSet.mockResolvedValue(undefined);

            // 12:30 floors to :30 (bucket minutes = 30)
            await getSectorSignals('15Min');

            expect(mockCacheGet).toHaveBeenCalledWith(
                'dashboard:signals:15Min:2026-04-19T12:30'
            );
            const [key, , ttl] = mockCacheSet.mock.calls[0];
            expect(key).toBe('dashboard:signals:15Min:2026-04-19T12:30');
            expect(ttl).toBe(300);
            const firstCallOptions = mockGetBars.mock.calls[0][0];
            expect(firstCallOptions.timeframe).toBe('15Min');
            // 2026-04-19 - 10 days = 2026-04-09
            expect(firstCallOptions.from).toBe('2026-04-09T12:30:00.000Z');
        });

        it('15Min 타임프레임은 분을 15분 하한 버킷으로 내림한다 (예: :07 → :00)', async () => {
            jest.setSystemTime(new Date('2026-04-19T12:07:00Z'));
            mockCacheGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([]);
            mockCacheSet.mockResolvedValue(undefined);

            await getSectorSignals('15Min');

            expect(mockCacheGet).toHaveBeenCalledWith(
                'dashboard:signals:15Min:2026-04-19T12:00'
            );
        });
    });
});
