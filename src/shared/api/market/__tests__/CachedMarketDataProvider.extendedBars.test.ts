import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CRYPTO_SESSION,
    type Bar,
    type GetBarsOptions,
} from '@y0ngha/siglens-core';
import { CachedMarketDataProvider } from '@/shared/api/market/CachedMarketDataProvider';
import type {
    ExtendedBarsProvider,
    SiglensMarketProvider,
} from '@/shared/api/market/marketProvider.types';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(
            async (key: string, value: unknown, _opts?: { ex?: number }) => {
                store.set(key, value);
            }
        ),
    };
    return { store, fakeRedis };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => fakeRedis,
}));

const ET = 'America/New_York';
const utc = (iso: string): number => Math.floor(Date.parse(iso) / 1000);
const bar = (iso: string, close = 1): Bar => ({
    time: utc(iso),
    open: close,
    high: close,
    low: close,
    close,
    volume: 10,
});

// 2026-06-30(화) — EDT(UTC−4). 월요일(06-29)은 history, 오늘(06-30)은 tail 몫이다.
const monPre = bar('2026-06-29T08:05:00Z'); // 04:05 ET — 프리마켓
const monRegular = bar('2026-06-29T14:00:00Z'); // 10:00 ET — 정규장(Redis에 넣지 않는다)
const monAfter = bar('2026-06-29T20:00:00Z'); // 16:00 ET — 애프터마켓
const tuePre = bar('2026-06-30T12:55:00Z'); // 08:55 ET — 프리마켓
const tueRegular = bar('2026-06-30T13:30:00Z'); // 09:30 ET — 정규장
const baseOptions: GetBarsOptions = {
    symbol: 'aapl',
    timeframe: '5Min',
    from: '2026-06-20T00:00:00Z',
};

type ExtendedInner = SiglensMarketProvider & ExtendedBarsProvider;

function makeInner(): {
    inner: ExtendedInner;
    getExtendedBars: ReturnType<
        typeof vi.fn<(o: GetBarsOptions) => Promise<Bar[]>>
    >;
    getBars: ReturnType<typeof vi.fn>;
} {
    const getExtendedBars = vi.fn(async (o: GetBarsOptions) =>
        o.before !== undefined
            ? [monPre, monRegular, monAfter]
            : [tuePre, tueRegular]
    );
    const getBars = vi.fn(async () => [monRegular]);
    const inner = {
        getBars,
        getQuote: vi.fn(async () => null),
        getTodayBar: vi.fn(async () => null),
        getQuoteSnapshot: vi.fn(async () => ({ quote: null, todayBar: null })),
        getExtendedBars,
    } as unknown as ExtendedInner;
    return { inner, getExtendedBars, getBars };
}

function ttlOf(key: string): number | undefined {
    return fakeRedis.set.mock.calls.find(([k]) => k === key)?.[2]?.ex;
}

describe('CachedMarketDataProvider.getExtendedBars', () => {
    beforeEach(() => {
        store.clear();
        fakeRedis.get.mockClear();
        fakeRedis.set.mockClear();
        vi.useFakeTimers({ toFake: ['Date'] });
        // 화 11:00 ET — 정규장 중
        vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
        // 거부형 기본값: 어떤 테스트도 실제 FMP로 새어 나가지 못한다.
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('network must not be used'))
        );
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    describe('캐시 키 격리', () => {
        it('새 키 계통(bars:intrahist-ext·bars:raw-ext)에만 쓰고, 정규장 키(bars:intrahist·bars:raw·bars:eodhist)는 만들지 않는다', async () => {
            const { inner } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await p.getExtendedBars(baseOptions);

            expect([...store.keys()].toSorted()).toEqual([
                'bars:intrahist-ext:AAPL:5Min:2026-06-20:2026-06-30:',
                'bars:raw-ext:AAPL:5Min:2026-06-30::',
            ]);
            expect(
                [...store.keys()].filter(
                    k =>
                        k.startsWith('bars:intrahist:') ||
                        k.startsWith('bars:raw:') ||
                        k.startsWith('bars:eodhist')
                )
            ).toEqual([]);
        });

        it('limit이 다르면 확장 키도 갈라진다', async () => {
            const { inner } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await p.getExtendedBars({ ...baseOptions, limit: 288 });
            expect(store.has('bars:raw-ext:AAPL:5Min:2026-06-30::288')).toBe(
                true
            );
        });

        it('정규장 getBars 경로의 키·inner 호출은 확장 메서드가 있어도 그대로다', async () => {
            const { inner, getBars, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await p.getBars(baseOptions);

            expect(getExtendedBars).not.toHaveBeenCalled();
            expect(getBars).toHaveBeenCalledWith({
                ...baseOptions,
                from: '2026-06-20',
                before: '2026-06-30',
            });
            expect([...store.keys()].filter(k => k.includes('-ext'))).toEqual(
                []
            );
            expect(
                store.has('bars:intrahist:AAPL:5Min:2026-06-20:2026-06-30:')
            ).toBe(true);
        });
    });

    describe('저장·반환', () => {
        it('정규장 밖 봉만 Redis에 저장하고 병합해 돌려준다(정규장 봉은 정규 경로 몫)', async () => {
            const { inner } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            const result = await p.getExtendedBars(baseOptions);

            expect(result).toEqual([monPre, monAfter, tuePre]);
            expect(
                store.get('bars:intrahist-ext:AAPL:5Min:2026-06-20:2026-06-30:')
            ).toEqual({ data: [monPre, monAfter] });
            expect(store.get('bars:raw-ext:AAPL:5Min:2026-06-30::')).toEqual({
                data: [tuePre],
            });
        });

        it('FMP `to`가 오늘을 포함해 돌려줘도 history 키에는 오늘 봉을 넣지 않는다(오늘 봉은 tail 몫, 중복 없음)', async () => {
            const { inner, getExtendedBars } = makeInner();
            getExtendedBars.mockImplementation(async o =>
                o.before !== undefined
                    ? [monPre, monAfter, tuePre] // 오늘(06-30) 프리 봉이 섞여 옴
                    : [tuePre]
            );
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            const result = await p.getExtendedBars(baseOptions);

            expect(
                store.get('bars:intrahist-ext:AAPL:5Min:2026-06-20:2026-06-30:')
            ).toEqual({ data: [monPre, monAfter] });
            expect(result).toEqual([monPre, monAfter, tuePre]);
        });

        it('history는 어제까지(before=오늘), tail은 오늘(from=오늘)로 inner에 요청한다', async () => {
            const { inner, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await p.getExtendedBars(baseOptions);

            expect(getExtendedBars).toHaveBeenCalledWith({
                ...baseOptions,
                from: '2026-06-20',
                before: '2026-06-30',
            });
            expect(getExtendedBars).toHaveBeenCalledWith({
                ...baseOptions,
                from: '2026-06-30',
                before: undefined,
            });
        });

        it('같은 날 재호출은 캐시(L1·Redis)에서 낸다', async () => {
            const { inner, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await p.getExtendedBars(baseOptions);
            await p.getExtendedBars(baseOptions);
            expect(getExtendedBars).toHaveBeenCalledTimes(2);
        });

        it('from이 오늘이면 history 없이 tail만 받는다', async () => {
            const { inner, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            const result = await p.getExtendedBars({
                ...baseOptions,
                from: '2026-06-30',
            });
            expect(getExtendedBars).toHaveBeenCalledTimes(1);
            expect(result).toEqual([tuePre]);
        });

        it('inner가 던지면 전파되고 캐싱되지 않는다', async () => {
            const { inner, getExtendedBars } = makeInner();
            getExtendedBars.mockRejectedValue(new Error('FMP 502'));
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await expect(p.getExtendedBars(baseOptions)).rejects.toThrow(
                'FMP 502'
            );
            expect(store.size).toBe(0);
        });
    });

    describe('L1 메모리 분리', () => {
        it('확장 히스토리가 많아도 정규장 히스토리 L1(5년 일봉 등과 공유하는 LRU)을 밀어내지 않는다', async () => {
            const { inner, getBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            // 정규장 intraday 히스토리를 L1에 올린다
            await p.getBars(baseOptions);
            const regularHistoryCalls = (): number =>
                getBars.mock.calls.filter(([o]) => o.before !== undefined)
                    .length;
            expect(regularHistoryCalls()).toBe(1);

            // 정규장 L1 상한(128)을 넘는 확장 히스토리를 쌓는다
            for (let i = 0; i < 140; i += 1) {
                await p.getExtendedBars({ ...baseOptions, symbol: `S${i}` });
            }
            // Redis를 비워도 정규장 히스토리는 L1에서 나와 inner를 다시 부르지 않는다
            store.clear();
            await p.getBars(baseOptions);
            expect(regularHistoryCalls()).toBe(1);
        });

        it('확장 히스토리는 자기 L1에서 나온다(Redis가 비어도 history는 inner를 다시 부르지 않는다)', async () => {
            const { inner, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await p.getExtendedBars(baseOptions);
            store.clear();
            await p.getExtendedBars(baseOptions);
            const historyCalls = getExtendedBars.mock.calls.filter(
                ([o]) => o.before !== undefined
            );
            expect(historyCalls).toHaveLength(1);
        });
    });

    describe('tail TTL — 정규장 TTL이 아니라 확장 세션 기준', () => {
        const tailKey = 'bars:raw-ext:AAPL:5Min:2026-06-30::';

        it('정규장 중(11:00 ET)은 60초', async () => {
            const { inner } = makeInner();
            await new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            }).getExtendedBars(baseOptions);
            expect(ttlOf(tailKey)).toBe(60);
        });

        it('프리마켓(07:00 ET)에도 60초 — 정규장 TTL(다음 개장까지)을 쓰면 새 프리마켓 봉이 몇 시간 가려진다', async () => {
            vi.setSystemTime(new Date('2026-06-30T11:00:00Z')); // 07:00 EDT
            const { inner } = makeInner();
            await new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            }).getExtendedBars(baseOptions);
            expect(ttlOf(tailKey)).toBe(60);
        });

        it('애프터마켓(18:00 ET)에도 60초', async () => {
            vi.setSystemTime(new Date('2026-06-30T22:00:00Z')); // 18:00 EDT
            const { inner } = makeInner();
            await new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            }).getExtendedBars(baseOptions);
            expect(ttlOf(tailKey)).toBe(60);
        });

        it('야간(22:00 ET)은 다음 거래일 04:00 ET까지(6시간)', async () => {
            vi.setSystemTime(new Date('2026-07-01T02:00:00Z')); // 06-30 22:00 EDT
            const { inner } = makeInner();
            await new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            }).getExtendedBars(baseOptions);
            expect(ttlOf('bars:raw-ext:AAPL:5Min:2026-06-30::')).toBe(
                6 * SECONDS_PER_HOUR
            );
        });

        it('빈 tail은 15분 상한으로만 굳힌다', async () => {
            vi.setSystemTime(new Date('2026-07-01T02:00:00Z'));
            const { inner, getExtendedBars } = makeInner();
            getExtendedBars.mockImplementation(async o =>
                o.before !== undefined ? [monPre] : []
            );
            await new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            }).getExtendedBars(baseOptions);
            expect(ttlOf('bars:raw-ext:AAPL:5Min:2026-06-30::')).toBe(15 * 60);
        });
    });

    describe('게이트 — FMP(inner)를 부르지 않고 빈 배열', () => {
        function expectNoUpstream(
            getExtendedBars: ReturnType<typeof vi.fn>,
            result: Bar[]
        ): void {
            expect(result).toEqual([]);
            expect(getExtendedBars).not.toHaveBeenCalled();
            expect(store.size).toBe(0);
            expect(globalThis.fetch).not.toHaveBeenCalled();
        }

        it('크립토 세션', async () => {
            const { inner, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, CRYPTO_SESSION, {
                intradayDateTimeZone: ET,
            });
            expectNoUpstream(
                getExtendedBars,
                await p.getExtendedBars(baseOptions)
            );
        });

        it('한국 주식 세션', async () => {
            const { inner, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, KR_EQUITY_SESSION, {
                intradayDateTimeZone: ET,
            });
            expectNoUpstream(
                getExtendedBars,
                await p.getExtendedBars(baseOptions)
            );
        });

        it('1Day', async () => {
            const { inner, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            expectNoUpstream(
                getExtendedBars,
                await p.getExtendedBars({ ...baseOptions, timeframe: '1Day' })
            );
        });

        it('날짜 해석 타임존이 없는 provider(Yahoo 등)', async () => {
            const { inner, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner);
            expectNoUpstream(
                getExtendedBars,
                await p.getExtendedBars(baseOptions)
            );
        });

        it('확장 봉을 모르는 inner(Fake·Yahoo)', async () => {
            const { inner, getExtendedBars } = makeInner();
            const bare = { ...inner, getExtendedBars: undefined };
            const p = new CachedMarketDataProvider(
                bare as unknown as SiglensMarketProvider,
                undefined,
                { intradayDateTimeZone: ET }
            );
            expectNoUpstream(
                getExtendedBars,
                await p.getExtendedBars(baseOptions)
            );
        });

        it('from 없는 요청', async () => {
            const { inner, getExtendedBars } = makeInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            expectNoUpstream(
                getExtendedBars,
                await p.getExtendedBars({ ...baseOptions, from: undefined })
            );
        });
    });
});
