import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CachedMarketDataProvider } from '@/shared/api/market/CachedMarketDataProvider';
import {
    CRYPTO_SESSION,
    FEAR_GREED_LOOKBACK_DAYS,
    type Bar,
    type GetBarsOptions,
    type MarketQuote,
} from '@y0ngha/siglens-core';
import type {
    QuoteSnapshot,
    SiglensMarketProvider,
} from '@/shared/api/market/marketProvider.types';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';
import { decodeCacheValue } from '@/shared/cache/cacheValueCodec';
import type { EodHistoryEntry } from '@/shared/api/market/eodHistoryMerge';
import { QUOTE_SNAPSHOT_MAX_TTL_SECONDS } from '@/shared/api/market/quoteSnapshotTtl';

// Counts finished decodes of eodhist entries read from Redis. The single-flight tests wait on
// this instead of wall-clock time: a caller only takes its owner/waiter role in getOrSetCache
// after its read is decoded (zstd runs off the microtask queue), so "every caller has decoded"
// is the exact point at which the roles are fixed.
const eodDecodes = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/shared/cache/cacheValueCodec', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@/shared/cache/cacheValueCodec')>();
    return {
        ...actual,
        decodeCacheValue: async (value: unknown) => {
            const decoded = await actual.decodeCacheValue(value);
            const data = (decoded as { data?: { asOf?: unknown } } | null)
                ?.data;
            if (data?.asOf !== undefined) eodDecodes.count += 1;
            return decoded;
        },
    };
});

/** `since` 이후 eodhist 엔트리 디코드가 `n`번 끝날 때까지 기다린다(시간이 아니라 사건 기준). */
async function waitForEodDecodes(since: number, n: number): Promise<void> {
    await vi.waitFor(() => {
        expect(eodDecodes.count - since).toBeGreaterThanOrEqual(n);
    });
}

/**
 * eodhist 엔트리의 Redis TTL(정리용 상한). 세션 롤이 아니라 엔트리의 asOf/checkedAt이 유효성을
 * 정하므로 완전/불완전과 무관하게 항상 같다.
 */
const EOD_ENTRY_TTL = SECONDS_PER_DAY * 5;
/** 불완전 히스토리를 업스트림 재확인 없이 내주는 쿨다운(EOD_PUBLISH_BUFFER_HOURS = 4h). */
const INCOMPLETE_COOLDOWN_MS = SECONDS_PER_HOUR * 4 * 1000;

/**
 * Captures the `ex` TTL passed to redis.set so we can assert that
 * `CachedMarketDataProvider` delegates to `computeBarsEffectiveTtl(timeframe, now, session)`
 * with the correct `MarketSessionSpec`:
 *   - crypto symbols → `CRYPTO_SESSION` (always-open, 24/7 uniform TTL)
 *   - equity symbols → `US_EQUITY_SESSION` (session-aware TTL, shorter during ET hours)
 */
const lastSetTtl: { value: number | undefined } = { value: undefined };

const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(
            async (key: string, value: unknown, opts?: { ex?: number }) => {
                store.set(key, value);
                lastSetTtl.value = opts?.ex;
            }
        ),
    };
    return { store, fakeRedis };
});
let redisEnabled = true;
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => (redisEnabled ? fakeRedis : null),
}));

/** Redis 스토어에 쓰인 eodhist 엔트리를 코덱으로 풀어 읽는다(`{ data: entry }` envelope). */
async function readEodEntry(
    symbol: string
): Promise<EodHistoryEntry | undefined> {
    const raw = store.get(`bars:eodhist:v3:${symbol}`);
    if (raw === undefined) return undefined;
    return ((await decodeCacheValue(raw)) as { data: EodHistoryEntry }).data;
}

/**
 * History window for lastClosed 2026-06-29 starts FEAR_GREED_LOOKBACK_DAYS earlier.
 * Derived (not literal) so a change to the core constant moves the expectations too.
 */
const addDays = (iso: string, days: number): string =>
    new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
        .toISOString()
        .slice(0, 10);
const utcSeconds = (iso: string): number =>
    Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000);
const WINDOW_START = addDays('2026-06-29', -FEAR_GREED_LOOKBACK_DAYS);
// First Saturday inside the window, and the Monday FMP would start at instead.
const WINDOW_SATURDAY = Array.from({ length: 7 }, (_, i) =>
    addDays(WINDOW_START, i + 1)
).find(d => new Date(`${d}T00:00:00Z`).getUTCDay() === 6)!;
const WINDOW_MONDAY = addDays(WINDOW_SATURDAY, 2);

/** Minimal bar factory for EOD split tests. */
const bar = (time: number): Bar => ({
    time,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
});

const SAMPLE_BARS: Bar[] = [
    { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
];
const SAMPLE_QUOTE: MarketQuote = {
    symbol: 'AAPL',
    price: 1.5,
    changesPercentage: 1.2,
    name: 'Apple',
    // core `MarketQuote.timestamp` — included here so the
    // existing `toEqual(SAMPLE_QUOTE)` round-trip assertions below already
    // prove the Redis JSON envelope preserves it, not just the pre-existing
    // fields.
    timestamp: 1_700_000_000,
};

function makeInner(
    overrides: Partial<SiglensMarketProvider> = {}
): SiglensMarketProvider {
    const base = {
        getBars: vi.fn(async () => SAMPLE_BARS),
        getQuote: vi.fn(async () => SAMPLE_QUOTE),
        getTodayBar: vi.fn(async () => null),
        ...overrides,
    };
    // 캐시 데코레이터는 getQuoteSnapshot만 부른다. 별도로 주지 않으면 개별 getQuote/
    // getTodayBar 스텁을 합쳐 스냅샷을 만든다(기존 케이스가 두 스텁으로 값을 지정한다).
    return {
        getQuoteSnapshot: vi.fn(async (symbol: string) => ({
            quote: await base.getQuote(symbol),
            todayBar: await base.getTodayBar(symbol),
        })),
        ...base,
    } as unknown as SiglensMarketProvider;
}

/**
 * barsOpts defaults to '5Min' so the single-key (`bars:raw:*`) path is exercised —
 * '1Day' without `before` now goes through the EOD-split path (getCachedDailyBars).
 * Tests that specifically target 1Day caching live in the '1Day EOD split' describe block.
 */
const barsOpts = (o: Partial<GetBarsOptions> = {}): GetBarsOptions => ({
    symbol: 'aapl',
    timeframe: '5Min',
    from: '2026-01-01',
    ...o,
});

function reset() {
    store.clear();
    redisEnabled = true;
    lastSetTtl.value = undefined;
    fakeRedis.get.mockClear();
    fakeRedis.set.mockClear();
}

/** Alias used by the EOD split tests (mirrors CachedFundamentalProvider naming). */
function resetSharedState() {
    reset();
}

describe('CachedMarketDataProvider', () => {
    beforeEach(reset);

    it('getBars: miss→fetch→set, hit→캐시값(키 bars:raw:SYM:TF:from:before:limit)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);

        const first = await p.getBars(barsOpts());
        expect(first).toEqual(SAMPLE_BARS);
        expect(inner.getBars).toHaveBeenCalledTimes(1);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::')).toBe(true);

        const second = await p.getBars(barsOpts());
        expect(second).toEqual(SAMPLE_BARS);
        expect(inner.getBars).toHaveBeenCalledTimes(1);
    });

    it('getBars: 빈 배열은 캐싱하지 않는다(transient 가드)', async () => {
        const inner = makeInner({ getBars: vi.fn(async () => []) });
        const p = new CachedMarketDataProvider(inner);
        expect(await p.getBars(barsOpts())).toEqual([]);
        expect(await p.getBars(barsOpts())).toEqual([]);
        expect(inner.getBars).toHaveBeenCalledTimes(2);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::')).toBe(false);
    });

    it('getBars: from/before/limit이 모두 undefined면 키에 빈 문자열로 채워진다 (?? 가드)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ from: undefined }));
        expect(inner.getBars).toHaveBeenCalledTimes(1);
        expect(store.has('bars:raw:AAPL:5Min:::')).toBe(true);
    });

    it('getBars: from/before가 다르면 키가 분리된다', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ from: '2026-01-01' }));
        await p.getBars(barsOpts({ from: '2026-02-01' }));
        await p.getBars(barsOpts({ from: '2026-01-01', before: '2026-03-01' }));
        expect(inner.getBars).toHaveBeenCalledTimes(3);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::')).toBe(true);
        expect(store.has('bars:raw:AAPL:5Min:2026-02-01::')).toBe(true);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01:2026-03-01:')).toBe(
            true
        );
    });

    it('getBars: limit이 다르면 키가 분리된다 (옵션 확장 시 캐시 충돌 방지)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ limit: 100 }));
        await p.getBars(barsOpts({ limit: 200 }));
        expect(inner.getBars).toHaveBeenCalledTimes(2);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::100')).toBe(true);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::200')).toBe(true);
    });

    it('getBars: inner throw는 전파되고 캐싱되지 않는다(worst case)', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 502');
        });
        const inner = makeInner({ getBars: boom });
        const p = new CachedMarketDataProvider(inner);
        await expect(p.getBars(barsOpts())).rejects.toThrow('FMP 502');
        expect(store.size).toBe(0);
        await expect(p.getBars(barsOpts())).rejects.toThrow('FMP 502');
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getQuote: miss→fetch→set(quote:snapshot:SYM), hit→캐시값, 심볼 대문자화', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        const first = await p.getQuote('aapl');
        expect(first).toEqual(SAMPLE_QUOTE);
        expect(inner.getQuoteSnapshot).toHaveBeenCalledTimes(1);
        expect(store.has('quote:snapshot:AAPL')).toBe(true);
        await p.getQuote('aapl');
        expect(inner.getQuote).toHaveBeenCalledTimes(1);
    });

    describe('quote snapshot TTL off-hours', () => {
        beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
        afterEach(() => vi.useRealTimers());

        const snapshotTtl = (): number | undefined =>
            fakeRedis.set.mock.calls.find(
                ([key]) => key === 'quote:snapshot:AAPL'
            )?.[2]?.ex;
        const fullSnapshotInner = () =>
            makeInner({
                getTodayBar: vi.fn(async () =>
                    bar(Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000))
                ),
            });

        it.each([
            ['right after the close (Tue 16:30 EDT)', '2026-06-30T20:30:00Z'],
            ['late evening (Tue 20:30 EDT)', '2026-07-01T00:30:00Z'],
            ['over the weekend (Sat)', '2026-07-04T15:00:00Z'],
        ])(
            '%s: kept at most 5 minutes, not until the next open',
            async (_label, iso) => {
                vi.setSystemTime(new Date(iso));
                await new CachedMarketDataProvider(
                    fullSnapshotInner()
                ).getQuote('AAPL');
                expect(snapshotTtl()).toBe(QUOTE_SNAPSHOT_MAX_TTL_SECONDS);
            }
        );

        it('during the session it stays 60 seconds', async () => {
            vi.setSystemTime(new Date('2026-06-30T15:00:00Z')); // 11:00 EDT
            await new CachedMarketDataProvider(fullSnapshotInner()).getQuote(
                'AAPL'
            );
            expect(snapshotTtl()).toBe(60);
        });

        it('a partial snapshot (no today bar) gets the same 5-minute cap off-hours', async () => {
            vi.setSystemTime(new Date('2026-07-01T00:30:00Z'));
            await new CachedMarketDataProvider(makeInner()).getQuote('AAPL');
            expect(snapshotTtl()).toBe(QUOTE_SNAPSHOT_MAX_TTL_SECONDS);
        });
    });

    it('getQuote: null(미가용)은 캐싱하지 않는다', async () => {
        const inner = makeInner({ getQuote: vi.fn(async () => null) });
        const p = new CachedMarketDataProvider(inner);
        expect(await p.getQuote('NODATA')).toBeNull();
        expect(await p.getQuote('NODATA')).toBeNull();
        expect(inner.getQuote).toHaveBeenCalledTimes(2);
        expect(store.has('quote:snapshot:NODATA')).toBe(false);
    });

    it('Redis 부재 시 inner로 fallback(worst case)', async () => {
        redisEnabled = false;
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        expect(await p.getBars(barsOpts())).toEqual(SAMPLE_BARS);
        expect(await p.getQuote('AAPL')).toEqual(SAMPLE_QUOTE);
        expect(store.size).toBe(0);
    });

    describe('1Day EOD split (session-dated key, DST-aware US-close)', () => {
        beforeEach(() => {
            resetSharedState();
            vi.useFakeTimers();
            // System time: Tue 2026-06-30 15:00 UTC = 11:00 EDT (summer, before close)
            // lastClosed = 2026-06-29 (Monday, most recent closed session)
            vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
        });
        afterEach(() => vi.useRealTimers());

        const longOpts: GetBarsOptions = {
            symbol: 'AAPL',
            timeframe: '1Day',
            from: '2024-06-30',
        };

        // ── key format: one key per symbol ────────────────────────────────────
        it('key format: history key is bars:eodhist:v3:AAPL (no date in the key); the entry records asOf=lastClosed', async () => {
            // At 2026-06-30T15:00Z (Tue 11:00 EDT, before close), lastClosed = 2026-06-29 (Mon)
            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars(longOpts);

            expect(store.has('bars:eodhist:v3:AAPL')).toBe(true);
            expect(store.has('quote:snapshot:AAPL')).toBe(true);
            const entry = await readEodEntry('AAPL');
            expect(entry).toMatchObject({
                asOf: '2026-06-29',
                checkedAt: Date.parse('2026-06-30T15:00:00Z'),
                fullAt: Date.parse('2026-06-30T15:00:00Z'),
                bars: [histBar],
            });
            // getOrSetCache envelope detection keys off a top-level `data`.
            expect(Object.keys(entry!).toSorted()).toEqual([
                'asOf',
                'bars',
                'checkedAt',
                'from',
                'fullAt',
            ]);
        });

        // ── cold = 1 EOD (before=lastClosed) + 1 getTodayBar ──────────────────
        it('cold: inner.getBars called once with before=lastClosed, inner.getTodayBar called once; both keys written', async () => {
            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000)
            );

            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars(longOpts);

            // getBars called once with before=lastClosed (2026-06-29, Monday)
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(getBars).toHaveBeenCalledWith(
                expect.objectContaining({ before: '2026-06-29' })
            );
            // getTodayBar called once
            expect(getTodayBar).toHaveBeenCalledTimes(1);
            expect(getTodayBar).toHaveBeenCalledWith('AAPL');
            // both cache keys written
            expect(store.has('bars:eodhist:v3:AAPL')).toBe(true);
            expect(store.has('quote:snapshot:AAPL')).toBe(true);
        });

        // ── Redis TTL is a cleanup bound, not the freshness rule ─────────────
        // Freshness lives in the entry (asOf / checkedAt), so complete and incomplete
        // histories are stored with the same long TTL — and stay readable across a roll,
        // which is what makes the incremental refresh possible.
        it.each([
            ['complete', '2026-06-29T00:00:00Z'],
            ['incomplete (FMP lag)', '2026-06-28T00:00:00Z'],
        ])(
            'bars:eodhist TTL is the 5-day cleanup bound for a %s history',
            async (_label, newestIso) => {
                const getBars = vi.fn(async () => [
                    bar(Math.floor(Date.parse(newestIso) / 1000)),
                ]);
                const provider = new CachedMarketDataProvider(
                    makeInner({ getBars, getTodayBar: vi.fn(async () => null) })
                );

                await provider.getBars(longOpts);

                const histSetCall = fakeRedis.set.mock.calls.find(
                    ([key]) => key === 'bars:eodhist:v3:AAPL'
                );
                expect(histSetCall![2]?.ex).toBe(EOD_ENTRY_TTL);
            }
        );

        // ── each session spec derives its own lastClosed (asOf) ───────────────
        it('KR session: Chuseok eve → entry is asOf the KRX session (09-23), key is per symbol', async () => {
            // 2026-09-23T11:00Z = 20:00 KST Wed → lastClosed 09-23.
            vi.setSystemTime(new Date('2026-09-23T11:00:00Z'));
            const getBars = vi.fn(async () => [
                bar(Math.floor(Date.parse('2026-09-23T00:00:00Z') / 1000)),
            ]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) }),
                KR_EQUITY_SESSION
            );

            await provider.getBars({ ...longOpts, symbol: '005930.KS' });

            expect(getBars).toHaveBeenCalledWith(
                expect.objectContaining({ before: '2026-09-23' })
            );
            expect((await readEodEntry('005930.KS'))?.asOf).toBe('2026-09-23');
        });

        it('crypto session: entry is asOf yesterday UTC (07-03), not the US session date', async () => {
            // 2026-07-04T15:00Z (Sat). Crypto lastClosed = 07-03; NYSE is closed Fri 07-03.
            vi.setSystemTime(new Date('2026-07-04T15:00:00Z'));
            const getBars = vi.fn(async () => [
                bar(Math.floor(Date.parse('2026-07-03T00:00:00Z') / 1000)),
            ]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) }),
                CRYPTO_SESSION
            );

            await provider.getBars({ ...longOpts, symbol: 'BTCUSD' });

            expect((await readEodEntry('BTCUSD'))?.asOf).toBe('2026-07-03');
        });

        // ── FMP publish-lag: cooldown, then incremental catch-up ──────────────
        it('[FMP lag] incomplete history is served as-is within the cooldown, then re-checked incrementally; once FMP catches up the new bar is appended', async () => {
            // System time: 2026-06-30T15:00Z → lastClosed = 2026-06-29
            // First fetch: FMP lagged, newest bar = 2026-06-28
            const laggedBar = bar(utcSeconds('2026-06-28'));
            const completeBar = bar(utcSeconds('2026-06-29'));
            const getBars = vi.fn().mockResolvedValueOnce([laggedBar]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) })
            );

            await provider.getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(1);

            // Within the cooldown: no upstream call, even on a fresh instance (Redis hit).
            vi.setSystemTime(new Date('2026-06-30T18:59:00Z'));
            await new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) })
            ).getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(1);

            // Past the cooldown, FMP has now published 2026-06-29: one incremental call
            // from the last cached bar (overlap) appends it.
            vi.setSystemTime(new Date('2026-06-30T19:01:00Z'));
            getBars.mockResolvedValueOnce([laggedBar, completeBar]);
            const result = await new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) })
            ).getBars(longOpts);

            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    from: '2026-06-28',
                    before: '2026-06-29',
                })
            );
            expect(result.map(b => b.time)).toEqual([
                laggedBar.time,
                completeBar.time,
            ]);

            // Now complete → served until the session rolls, no further calls.
            vi.setSystemTime(new Date('2026-06-30T23:00:00Z'));
            await new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) })
            ).getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(2);
        });

        // ── delisted/permanent-incomplete: ≤ 1 upstream call per cooldown ──────
        it('[delisted] permanent-incomplete history → at most one (incremental) upstream call per cooldown, never one per request', async () => {
            /**
             * A delisted symbol's newest bar is months before lastClosed, so the entry
             * never reaches lastClosed. Within the cooldown every request is a cache hit;
             * after it the next request re-checks incrementally (overlap bar only) and the
             * entry is stamped again — so the cost is ≤ 6 tiny calls/day, not one per request.
             */
            // System time: 2026-06-30T15:00Z → lastClosed = 2026-06-29
            const delistedOpts: GetBarsOptions = {
                symbol: 'DELIST',
                timeframe: '1Day',
                from: '2023-01-01', // old enough to trigger long window gate
            };
            const oldBar = bar(utcSeconds('2024-01-15'));
            const getBars = vi.fn(async () => [oldBar]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) })
            );

            // First call: cold full fetch.
            await provider.getBars(delistedOpts);
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({ from: WINDOW_START })
            );
            expect((await readEodEntry('DELIST'))?.checkedAt).toBe(
                Date.parse('2026-06-30T15:00:00Z')
            );

            // A burst of requests inside the cooldown: all cache hits.
            for (let i = 0; i < 5; i++) await provider.getBars(delistedOpts);
            expect(getBars).toHaveBeenCalledTimes(1);

            // Past the cooldown: exactly one incremental re-check, then hits again.
            vi.setSystemTime(
                new Date(
                    Date.parse('2026-06-30T15:00:00Z') +
                        INCOMPLETE_COOLDOWN_MS +
                        60_000
                )
            );
            for (let i = 0; i < 5; i++) await provider.getBars(delistedOpts);
            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    from: '2024-01-15',
                    before: '2026-06-29',
                })
            );

            // The next cooldown window costs one more call.
            vi.setSystemTime(
                new Date(
                    Date.parse('2026-06-30T15:00:00Z') +
                        2 * INCOMPLETE_COOLDOWN_MS +
                        120_000
                )
            );
            for (let i = 0; i < 5; i++) await provider.getBars(delistedOpts);
            expect(getBars).toHaveBeenCalledTimes(3);
        });

        // ── holiday-labeled key: cooldown + no gap (history + today contiguous) ──
        it('[holiday key] incomplete history (holiday-labeled lastClosed, real last trading day older) → served within cooldown + no gap (history + today contiguous)', async () => {
            /**
             * Scenario: lastClosed falls on a date that is treated as a holiday by the
             * exchange (no trading). The EOD fetch returns bars whose newest is the real
             * last trading day (older than lastClosed). today(quote) fills the live tail.
             *
             * Expected:
             * (a) the second call inside the cooldown does not hit the upstream.
             * (b) merged result = history bars (up to real last trading day) + today bar,
             *     contiguous (no gap).
             */
            // System time: 2026-06-30T15:00Z → lastClosed = 2026-06-29 (Mon)
            const lastRealTradingDayBar = bar(
                Math.floor(Date.parse('2026-06-26T00:00:00Z') / 1000) // Friday before a holiday week
            );
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000) // today quote
            );
            const getBars = vi.fn(async () => [lastRealTradingDayBar]);
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars(longOpts);
            await provider.getBars(longOpts);

            // (a) newest bar (2026-06-26) < lastClosed (2026-06-29): cooldown, one call
            expect(getBars).toHaveBeenCalledTimes(1);

            // (b) merged result is contiguous: history up to real last trading day + today
            const times = result.map(b => b.time);
            expect(times).toContain(lastRealTradingDayBar.time);
            expect(times).toContain(todayBarObj.time);
            // result is ascending and contains both anchors with no unexpected gap
            expect(times[0]).toBe(lastRealTradingDayBar.time);
            expect(times[times.length - 1]).toBe(todayBarObj.time);
        });

        // ── same session = cache hit (same lastClosed → same key) ─────────────
        it('same session repeat = cache hit (same lastClosed → same key → 0 refetch)', async () => {
            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000)
            );

            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(getTodayBar).toHaveBeenCalledTimes(1);

            // Advance time within the same session (still before Tue 20:00Z EDT close)
            vi.setSystemTime(new Date('2026-06-30T17:00:00Z'));

            // 2nd call same session — entry asOf is still 2026-06-29 → cache hit
            await provider.getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(1); // still 1
            expect(getTodayBar).toHaveBeenCalledTimes(1); // still 1 (quote:snapshot TTL may vary but key exists)
        });

        // ── new session → incremental refresh of the same key ─────────────────
        it('new session (after Tue close+buffer) → same key refreshed incrementally from the last cached bar', async () => {
            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            // First call: Tue 15:00Z (before close) → lastClosed = 2026-06-29 (Monday)
            await provider.getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(1);
            expect((await readEodEntry('AAPL'))?.asOf).toBe('2026-06-29');

            // Advance past Tue close+buffer: Wed 00:30Z = 20:30 EDT Tue
            // (20:00 ET + 4h buffer = 00:00 UTC Wed; 00:30Z is past buffer)
            vi.setSystemTime(new Date('2026-07-01T00:30:00Z'));

            await provider.getBars(longOpts);
            // asOf is behind → one upstream refresh, overlapping the last cached bar
            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    from: '2024-06-30',
                    before: '2026-06-30',
                })
            );
            expect((await readEodEntry('AAPL'))?.asOf).toBe('2026-06-30');
            // one key per symbol: no dated copies pile up
            expect(
                [...store.keys()].filter(k => k.startsWith('bars:eodhist'))
            ).toEqual(['bars:eodhist:v3:AAPL']);
        });

        // ── covers/truncation: isFresh=false when oldest bar > from ──────────
        it('[fixed window] history is fetched from the key window, not the request from', async () => {
            const getBars = vi.fn(async () => [bar(utcSeconds(WINDOW_START))]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) })
            );

            await provider.getBars({ ...longOpts, from: '2025-06-30' });

            expect(getBars).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: WINDOW_START,
                    before: '2026-06-29',
                })
            );
        });

        it('[fixed window] a narrower request cannot leave a short entry that a wider one would trust', async () => {
            // Sector scan (400d) first, then the 5y page window: both share one fetch.
            // The fake honours `from` like FMP, so a request-shaped fetch would store
            // only the 2025 bar and force the wide request to fetch again.
            const all = [
                bar(utcSeconds(WINDOW_START)),
                bar(utcSeconds('2025-06-30')),
            ];
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                all.filter(
                    x => x.time >= Date.parse(`${o.from!}T00:00:00Z`) / 1000
                )
            );
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) })
            );

            const narrow = await provider.getBars({
                ...longOpts,
                from: '2025-06-01',
            });
            const wide = await provider.getBars({
                ...longOpts,
                from: addDays(WINDOW_START, 5),
            });

            expect(getBars).toHaveBeenCalledTimes(1);
            expect(narrow).toHaveLength(1);
            expect(wide).toHaveLength(1);
        });

        it('[fixed window] a young listing (first bar long after from) is a cache hit, not a refetch', async () => {
            // Listed 2025-03-28 — FMP has nothing earlier, so the first bar never reaches `from`.
            const getBars = vi.fn(async () => [
                bar(Math.floor(Date.parse('2025-03-28T00:00:00Z') / 1000)),
                bar(Math.floor(Date.parse('2026-06-29T00:00:00Z') / 1000)),
            ]);
            const getTodayBar = vi.fn(async () => null);
            const inner = makeInner({ getBars, getTodayBar });

            await new CachedMarketDataProvider(inner).getBars(longOpts);
            // A new instance skips L1 and must be served from Redis.
            await new CachedMarketDataProvider(inner).getBars(longOpts);

            expect(getBars).toHaveBeenCalledTimes(1);
        });

        it('[fixed window] a from that falls on a weekend is a cache hit, not a refetch', async () => {
            // core asks for now − 1830d, which lands on a weekend every Tue/Wed;
            // FMP then starts at the next trading day, after `from`.
            const getBars = vi.fn(async () => [
                bar(utcSeconds(WINDOW_MONDAY)),
                bar(utcSeconds('2026-06-29')),
            ]);
            const inner = makeInner({
                getBars,
                getTodayBar: vi.fn(async () => null),
            });
            const weekendFrom = { ...longOpts, from: WINDOW_SATURDAY };

            await new CachedMarketDataProvider(inner).getBars(weekendFrom);
            await new CachedMarketDataProvider(inner).getBars(weekendFrom);

            expect(getBars).toHaveBeenCalledTimes(1);
        });

        it('[truncation fix] a from older than the window refetches from that from', async () => {
            const getBars = vi.fn(async () => [bar(utcSeconds(WINDOW_START))]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) })
            );

            await provider.getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(1);

            const olderFrom = addDays(WINDOW_START, -30);
            await provider.getBars({ ...longOpts, from: olderFrom });
            expect(getBars).toHaveBeenCalledTimes(2); // covers fail → refetch
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({ from: olderFrom })
            );
        });

        // ── today=null (delisted) → history only, no crash ───────────────────
        it('today=null (delisted) → returns history only, no crash', async () => {
            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({
                    getBars,
                    getTodayBar,
                    getQuote: vi.fn(async () => null),
                })
            );

            const result = await provider.getBars(longOpts);
            expect(result).toHaveLength(1);
            expect(result[0]!.time).toBe(histBar.time);
            // snapshot key is NOT written (shouldCache: 둘 다 null → false)
            expect(store.has('quote:snapshot:AAPL')).toBe(false);
        });

        // ── merge: today bar appears last; today wins on same-time overlap ────
        it('merge: today bar (time > history newest) appears last', async () => {
            const histTime = Math.floor(
                Date.parse('2026-06-29T00:00:00Z') / 1000
            );
            const todayTime = Math.floor(
                Date.parse('2026-06-30T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async () => [bar(histTime)]);
            const getTodayBar = vi.fn(async () => bar(todayTime));
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars(longOpts);
            expect(result.map(b => b.time)).toEqual([histTime, todayTime]);
        });

        it('merge: finalized EOD bar wins on same-time overlap (quote bar never overrides it)', async () => {
            const sharedTime = Math.floor(
                Date.parse('2026-06-30T00:00:00Z') / 1000
            );
            const histBar: Bar = {
                time: sharedTime,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: 1000,
            };
            const todayBarObj: Bar = {
                time: sharedTime,
                open: 0,
                high: 0,
                low: 0,
                close: 105,
                volume: 0,
            };
            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars(longOpts);
            expect(result).toEqual([histBar]);
        });

        it('[FMP lag] history ends before lastClosed; a quote bar dated <= lastClosed but after the history tail IS merged (fills the gap)', async () => {
            // System time: 2026-06-30T15:00Z → lastClosed = 2026-06-29 (Mon).
            // EOD history lags: newest bar is Fri 06-26. The quote bar is dated Mon 06-29
            // (== lastClosed, so NOT strictly after it) yet is strictly after the history
            // tail. The cutoff is the history tail, not lastClosed — a `> lastClosed`
            // cutoff would drop this bar and leave the series a session short.
            const histTail = Math.floor(
                Date.parse('2026-06-26T00:00:00Z') / 1000
            );
            const lastClosedTime = Math.floor(
                Date.parse('2026-06-29T00:00:00Z') / 1000
            );
            const quoteBar: Bar = {
                time: lastClosedTime,
                open: 7,
                high: 8,
                low: 6,
                close: 7.5,
                volume: 50,
            };
            const getBars = vi.fn(async () => [bar(histTail)]);
            const getTodayBar = vi.fn(async () => quoteBar);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars(longOpts);

            expect(result.map(b => b.time)).toEqual([histTail, lastClosedTime]);
            expect(result.at(-1)).toEqual(quoteBar);
        });

        it('merge: quote bar dated before the EOD tail is dropped, series stays at the EOD tail', async () => {
            const t1 = Math.floor(Date.parse('2026-06-26T00:00:00Z') / 1000);
            const t2 = Math.floor(Date.parse('2026-06-29T00:00:00Z') / 1000);
            const getBars = vi.fn(async () => [bar(t1), bar(t2)]);
            const getTodayBar = vi.fn(async () => bar(t1));
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars(longOpts);
            expect(result.map(b => b.time)).toEqual([t1, t2]);
        });

        // ── guard branches ────────────────────────────────────────────────────
        it('1Day with before set → single-key path (no eodhist/today keys)', async () => {
            const getBars = vi.fn(async () => [bar(1)]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
                before: '2026-06-20',
            });
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(
                [...store.keys()].some(k => k.startsWith('bars:eodhist'))
            ).toBe(false);
            expect(
                [...store.keys()].some(k => k.startsWith('quote:snapshot'))
            ).toBe(false);
            expect(store.has('bars:raw:AAPL:1Day:2024-01-01:2026-06-20:')).toBe(
                true
            );
        });

        it('short lookback (from within recent window) → single-key path', async () => {
            const getBars = vi.fn(async () => [bar(1)]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2026-06-27', // within recentFrom(2026-06-20)
            });
            expect(
                [...store.keys()].some(k => k.startsWith('bars:eodhist'))
            ).toBe(false);
            expect([...store.keys()].some(k => k.startsWith('bars:raw'))).toBe(
                true
            );
        });

        it('non-1Day stays on single-key path', async () => {
            const getBars = vi.fn(async () => [bar(1)]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '5Min',
                from: '2026-06-20',
            });
            expect(getBars).toHaveBeenCalledTimes(1);
            expect([...store.keys()].some(k => k.startsWith('bars:eod'))).toBe(
                false
            );
        });

        // ── sliceFrom boundary ────────────────────────────────────────────────
        it('sliceFrom keeps a bar exactly at options.from (inclusive boundary)', async () => {
            const boundary = Math.floor(
                Date.parse('2024-06-30T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async () => [bar(boundary)]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-06-30',
            });
            expect(result.map(b => b.time)).toContain(boundary);
        });

        // ── from=undefined → anchored split taken, unsliced ───────────────────
        it('from=undefined → split taken, merged result returned unsliced', async () => {
            const histT = Math.floor(Date.parse('2026-06-26T00:00:00Z') / 1000);
            const todayT = Math.floor(
                Date.parse('2026-06-30T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async () => [bar(histT)]);
            const getTodayBar = vi.fn(async () => bar(todayT));
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
            }); // no from
            expect(
                [...store.keys()].some(k =>
                    k.startsWith('bars:eodhist:v3:AAPL')
                )
            ).toBe(true);
            expect(store.has('quote:snapshot:AAPL')).toBe(true);
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(result.map(b => b.time)).toEqual([histT, todayT]);
        });

        // ── throw on split path → no cache poisoning ──────────────────────────
        it('inner.getBars throw on split path → rejects without caching anything', async () => {
            const getBars = vi.fn(async () => {
                throw new Error('FMP 503');
            });
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getQuote: vi.fn(async () => null) })
            );

            await expect(
                provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Day',
                    from: '2024-01-01',
                })
            ).rejects.toThrow('FMP 503');
            expect(store.size).toBe(0);
        });

        // ── Redis-down fallback on split path ─────────────────────────────────
        it('redisEnabled=false on split path → returns merged result, store empty', async () => {
            redisEnabled = false;
            const t1 = Math.floor(Date.parse('2024-06-01T00:00:00Z') / 1000);
            const t2 = Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000);
            const getBars = vi.fn(async () => [bar(t1)]);
            const getTodayBar = vi.fn(async () => bar(t2));
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });
            expect(result.map(b => b.time)).toEqual([t1, t2]);
            expect(store.size).toBe(0);
        });

        // ── empty history shouldCache guard ───────────────────────────────────
        it('history returns [] → bars:eodhist NOT written; quote:snapshot written if non-empty', async () => {
            const todayT = Math.floor(
                Date.parse('2026-06-30T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async () => []);
            const getTodayBar = vi.fn(async () => bar(todayT));
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });
            expect(
                [...store.keys()].some(k => k.startsWith('bars:eodhist'))
            ).toBe(false);
            expect(store.has('quote:snapshot:AAPL')).toBe(true);
            expect(result.map(b => b.time)).toEqual([todayT]);
        });

        // ── quote:snapshot (today bar) TTL: session-aware ─────────────────────
        it('quote:snapshot(today) TTL: market-open instant → 60s', async () => {
            // ET regular session open: Mon 2026-06-29 14:30 UTC = 10:30 EDT
            vi.setSystemTime(new Date('2026-06-29T14:30:00Z'));
            resetSharedState();

            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-29T00:00:00Z') / 1000)
            );
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            const todaySetCall = fakeRedis.set.mock.calls.find(
                ([key]) =>
                    typeof key === 'string' && key.startsWith('quote:snapshot')
            );
            expect(todaySetCall).toBeDefined();
            expect(todaySetCall![2]?.ex).toBe(60); // open-session TTL
        });

        // ── gap-free integration: buffer prevents incomplete-cache gap ────────
        it('[gap-free] buffer prevents stale EOD being served the next session', async () => {
            // Scenario:
            // (a) Fri 7/10 20:30 UTC = 16:30 EDT — after close but WITHIN 4h buffer.
            //     lastClosed = 2026-07-09 (Thu). A request caches the history as of 07-09.
            // (b) Mon 7/13 13:40 UTC = 09:40 EDT — during regular session.
            //     lastClosed = 2026-07-10 (Fri). The entry (asOf 07-09) is behind, so it is
            //     refreshed up to before='2026-07-10' — the stale 7/09 history is never served.
            //
            // Note: from='2025-06-01' is used to ensure isLongDailyWindow=true regardless of system time.

            const longFrom: GetBarsOptions = {
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2025-06-01', // >10 days before any test date → always long window
            };

            const friHistBar = bar(
                Math.floor(Date.parse('2026-07-09T00:00:00Z') / 1000)
            );
            const monHistBar = bar(
                Math.floor(Date.parse('2026-07-10T00:00:00Z') / 1000)
            );

            // (a) Within buffer after Fri close — lastClosed must be 2026-07-09 (Thu)
            vi.setSystemTime(new Date('2026-07-10T20:30:00Z')); // 16:30 EDT Fri — within buffer
            resetSharedState();

            const getBarsA = vi.fn(async (opts: GetBarsOptions) => {
                if (opts.before === '2026-07-09') return [friHistBar];
                if (opts.before === '2026-07-10')
                    return [friHistBar, monHistBar];
                return [friHistBar];
            });
            const providerA = new CachedMarketDataProvider(
                makeInner({
                    getBars: getBarsA,
                    getTodayBar: vi.fn(async () => null),
                })
            );

            await providerA.getBars(longFrom);
            // At 7/10 16:30 EDT (within buffer), lastClosed = 2026-07-09
            expect((await readEodEntry('AAPL'))?.asOf).toBe('2026-07-09');
            expect(getBarsA).toHaveBeenCalledWith(
                expect.objectContaining({ before: '2026-07-09' })
            );

            // (b) Mon 7/13 during session — lastClosed = 2026-07-10 (Fri, after buffer passed
            // overnight). The Redis entry from (a) is kept (no reset): it must be refreshed.
            vi.setSystemTime(new Date('2026-07-13T13:40:00Z')); // 09:40 EDT Mon

            const getBarsB = vi.fn(async () => [friHistBar, monHistBar]);
            const providerB = new CachedMarketDataProvider(
                makeInner({
                    getBars: getBarsB,
                    getTodayBar: vi.fn(async () => null),
                })
            );

            const result = await providerB.getBars(longFrom);
            expect((await readEodEntry('AAPL'))?.asOf).toBe('2026-07-10');
            // refreshed with before='2026-07-10', not '2026-07-09'
            expect(getBarsB).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: '2026-07-09',
                    before: '2026-07-10',
                })
            );
            // History includes monHistBar (7/10 data) — no 1-day gap
            expect(result.map(b => b.time)).toContain(monHistBar.time);
        });

        it('quote:snapshot(today) TTL: market-closed instant → > 60s', async () => {
            // Saturday 2026-06-27 12:00 UTC — US equity market closed
            vi.setSystemTime(new Date('2026-06-27T12:00:00Z'));
            resetSharedState();

            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-27T00:00:00Z') / 1000)
            );
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            const todaySetCall = fakeRedis.set.mock.calls.find(
                ([key]) =>
                    typeof key === 'string' && key.startsWith('quote:snapshot')
            );
            expect(todaySetCall).toBeDefined();
            expect(todaySetCall![2]?.ex).toBeGreaterThan(60); // closed-session TTL > 60s
        });

        // ── crypto: weekend gap-free (session-aware lastClosed) ───────────────
        it('[crypto] Sunday: before=yesterday(Saturday), NOT Friday — weekend bars retained', async () => {
            /**
             * System time: 2026-07-12 (Sunday) 12:00 UTC.
             * Crypto (always-open): lastClosed = yesterday = 2026-07-11 (Saturday).
             * US equity (scheduled): lastClosed = 2026-07-10 (Friday, weekend rewind).
             *
             * Proves: crypto keeps Saturday's completed EOD bar; equity would truncate it.
             */
            vi.setSystemTime(new Date('2026-07-12T12:00:00Z')); // Sunday
            resetSharedState();

            const cryptoOpts: GetBarsOptions = {
                symbol: 'BTC',
                timeframe: '1Day',
                from: '2024-01-01',
            };

            // Crypto provider: lastClosed must be 2026-07-11 (Saturday = yesterday UTC)
            const cryptoBars = vi.fn(async () => [
                bar(Math.floor(Date.parse('2024-01-01T00:00:00Z') / 1000)),
            ]);
            const cryptoProvider = new CachedMarketDataProvider(
                makeInner({
                    getBars: cryptoBars,
                    getTodayBar: vi.fn(async () => null),
                }),
                CRYPTO_SESSION
            );

            await cryptoProvider.getBars(cryptoOpts);

            // Crypto entry must be as of Saturday (yesterday UTC), not Friday
            expect((await readEodEntry('BTC'))?.asOf).toBe('2026-07-11');
            expect(cryptoBars).toHaveBeenCalledWith(
                expect.objectContaining({ before: '2026-07-11' })
            );

            // Contrast: equity provider on same Sunday uses Friday as lastClosed
            resetSharedState();
            const equityBars = vi.fn(async () => [
                bar(Math.floor(Date.parse('2024-01-01T00:00:00Z') / 1000)),
            ]);
            const equityProvider = new CachedMarketDataProvider(
                makeInner({
                    getBars: equityBars,
                    getTodayBar: vi.fn(async () => null),
                })
            );

            await equityProvider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            // Equity entry is as of Friday (weekend rewind)
            expect((await readEodEntry('AAPL'))?.asOf).toBe('2026-07-10');
        });

        // ── merge-under-lag: documents behavior when history lags behind today ─
        it('[merge-under-lag] history lags (newest < lastClosed) → cooldown-limited + result includes today bar', async () => {
            /**
             * Behavior-documenting test: FMP has not yet published day N's EOD.
             * History newest bar = day N-1 (lag). today bar = day N+1 (advanced quote).
             *
             * Expected:
             * (a) the lagged entry is stored as of lastClosed (the cooldown, not a short Redis
             *     TTL, bounds the retries): a repeat call inside the cooldown does not refetch.
             * (b) merged result still contains history bars + the today bar — the cooldown
             *     re-check picks up day N once FMP publishes it; until then the series has
             *     today via quote.
             *
             * System time: 2026-06-30 15:00 UTC (Tue 11:00 EDT, before close)
             * lastClosed = 2026-06-29 (Mon). History newest = 2026-06-28 (lag, N-1).
             * todayBar = 2026-07-01 (advanced, N+1).
             */
            vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
            resetSharedState();

            // history lags: newest bar = 2026-06-28, behind lastClosed 2026-06-29
            const laggedHistBar = bar(
                Math.floor(Date.parse('2026-06-28T00:00:00Z') / 1000)
            );
            // today is advanced: 2026-07-01
            const advancedTodayBar = bar(
                Math.floor(Date.parse('2026-07-01T00:00:00Z') / 1000)
            );

            const getBars = vi.fn(async () => [laggedHistBar]);
            const getTodayBar = vi.fn(async () => advancedTodayBar);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            // (a) stored as of lastClosed (2026-06-29) although newest (2026-06-28) is behind
            expect((await readEodEntry('AAPL'))?.asOf).toBe('2026-06-29');
            expect(getBars).toHaveBeenCalledTimes(1);

            // (b) merged result contains both lagged history and today bar
            const times = result.map(b => b.time);
            expect(times).toContain(laggedHistBar.time);
            expect(times).toContain(advancedTodayBar.time);
        });
    });

    describe('incremental EOD history refresh at a session roll', () => {
        let warnSpy: ReturnType<typeof vi.spyOn>;
        const overlapWarnings = (): unknown[][] =>
            warnSpy.mock.calls.filter(([message]: unknown[]) =>
                String(message).includes('eodhist overlap mismatch')
            );
        beforeEach(() => {
            warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            resetSharedState();
            vi.useFakeTimers();
            // Tue 2026-06-30 15:00Z = 11:00 EDT → lastClosed 2026-06-29 (Mon)
            vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
        });
        afterEach(() => {
            vi.useRealTimers();
            warnSpy.mockRestore();
        });

        // Roll: Wed 2026-07-01 00:30Z = Tue 20:30 EDT → lastClosed 2026-06-30
        const ROLL_AT = new Date('2026-07-01T00:30:00Z');
        const WINDOW_START_AFTER_ROLL = addDays(WINDOW_START, 1);
        const fullOpts: GetBarsOptions = { symbol: 'AAPL', timeframe: '1Day' };

        /** One bar per listed day; prices differ per day so a changed bar is detectable. */
        const barsOn = (days: string[], scale = 1): Bar[] =>
            days.map(day => {
                const t = utcSeconds(day);
                const base = 50 + ((t / 86_400) % 97);
                return {
                    time: t,
                    open: base * scale,
                    high: (base + 2) * scale,
                    low: (base - 2) * scale,
                    close: (base + 1) * scale,
                    volume: 1000,
                };
            });
        const daysBetween = (fromIso: string, toIso: string): string[] => {
            const out: string[] = [];
            for (let d = fromIso; d <= toIso; d = addDays(d, 1)) out.push(d);
            return out;
        };
        /** FMP-like upstream: bars in [from, before], inclusive, from the mutable `ledger`. */
        const makeUpstream = (
            ledger: () => Bar[],
            override?: (o: GetBarsOptions) => Bar[] | undefined
        ) =>
            vi.fn(async (o: GetBarsOptions) => {
                const overridden = override?.(o);
                if (overridden !== undefined) return overridden;
                const lo = utcSeconds(o.from!);
                const hi = utcSeconds(o.before!);
                return ledger().filter(b => b.time >= lo && b.time <= hi);
            });
        const providerOver = (
            getBars: SiglensMarketProvider['getBars'],
            session?: ConstructorParameters<typeof CachedMarketDataProvider>[1]
        ) =>
            new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar: vi.fn(async () => null) }),
                session
            );

        let ledger: Bar[];
        beforeEach(() => {
            ledger = barsOn(
                daysBetween(addDays(WINDOW_START, -10), '2026-06-29')
            );
        });
        const appendRollDay = () => {
            ledger = [...ledger, ...barsOn(['2026-06-30'])];
        };
        const expectedWindow = (toIso: string, fromIso: string): Bar[] =>
            ledger.filter(
                b =>
                    b.time >= utcSeconds(fromIso) && b.time <= utcSeconds(toIso)
            );

        it('rolls with upstream from = last cached bar date (overlap), not the window start; result equals a full fetch', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);
            expect(getBars).toHaveBeenCalledTimes(1);

            appendRollDay();
            vi.setSystemTime(ROLL_AT);
            const result = await providerOver(getBars).getBars(fullOpts);

            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    from: '2026-06-29',
                    before: '2026-06-30',
                })
            );
            expect(getBars).not.toHaveBeenLastCalledWith(
                expect.objectContaining({ from: WINDOW_START_AFTER_ROLL })
            );
            expect(result).toEqual(
                expectedWindow('2026-06-30', WINDOW_START_AFTER_ROLL)
            );
        });

        it('drops bars older than the new window start after the merge', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);
            // The cold entry still holds the bar on the old window start.
            expect((await readEodEntry('AAPL'))?.bars[0]?.time).toBe(
                utcSeconds(WINDOW_START)
            );

            appendRollDay();
            vi.setSystemTime(ROLL_AT);
            await providerOver(getBars).getBars(fullOpts);

            const entry = await readEodEntry('AAPL');
            expect(entry?.from).toBe(WINDOW_START_AFTER_ROLL);
            expect(entry?.bars[0]?.time).toBe(
                utcSeconds(WINDOW_START_AFTER_ROLL)
            );
            expect(entry?.bars.at(-1)?.time).toBe(utcSeconds('2026-06-30'));
        });

        it('a split (overlap bar differs) refetches the whole window and replaces the old bars', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);

            // 10:1 split overnight: every past bar now comes back split-adjusted.
            ledger = [
                ...barsOn(
                    daysBetween(addDays(WINDOW_START, -10), '2026-06-29'),
                    0.1
                ),
                ...barsOn(['2026-06-30'], 0.1),
            ];
            vi.setSystemTime(ROLL_AT);
            const result = await providerOver(getBars).getBars(fullOpts);

            // cold + overlap probe + full refetch of the new window
            expect(getBars).toHaveBeenCalledTimes(3);
            expect(getBars).toHaveBeenCalledWith(
                expect.objectContaining({ from: '2026-06-29' })
            );
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    from: WINDOW_START_AFTER_ROLL,
                    before: '2026-06-30',
                })
            );
            expect(result).toEqual(
                expectedWindow('2026-06-30', WINDOW_START_AFTER_ROLL)
            );
            // none of the pre-split prices survive
            expect(result.every(b => b.close < 20)).toBe(true);
        });

        it('a late split adjustment (overlap matches, new bar jumps) refetches now and again at the next roll', async () => {
            const gapWarnings = (): unknown[][] =>
                warnSpy.mock.calls.filter(([message]: unknown[]) =>
                    String(message).includes('eodhist price gap')
                );
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);

            // The provider publishes the post-split 06-30 bar but has not adjusted the past yet:
            // the overlap bar (06-29) is unchanged, so only the jump into 06-30 reveals it.
            ledger = [...ledger, ...barsOn(['2026-06-30'], 0.1)];
            vi.setSystemTime(ROLL_AT);
            await providerOver(getBars).getBars(fullOpts);

            // cold + overlap probe + immediate full refetch
            expect(getBars).toHaveBeenCalledTimes(3);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    from: WINDOW_START_AFTER_ROLL,
                    before: '2026-06-30',
                })
            );
            expect(gapWarnings()).toHaveLength(1);
            expect((await readEodEntry('AAPL'))?.fullAt).toBe(0);

            // A day later the provider has adjusted the whole history.
            ledger = barsOn(
                daysBetween(addDays(WINDOW_START, -10), '2026-07-01'),
                0.1
            );
            vi.setSystemTime(new Date('2026-07-02T00:30:00Z')); // lastClosed 07-01
            const healed = await providerOver(getBars).getBars(fullOpts);

            // fullAt 0 forces a full fetch at this roll instead of an incremental one
            expect(getBars).toHaveBeenCalledTimes(4);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    from: addDays(WINDOW_START, 2),
                    before: '2026-07-01',
                })
            );
            expect(healed.every(b => b.close < 20)).toBe(true);
            expect((await readEodEntry('AAPL'))?.fullAt).toBeGreaterThan(0);
        });

        it('a normal roll without a price jump stays incremental and logs no gap warning', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);

            appendRollDay();
            vi.setSystemTime(ROLL_AT);
            await providerOver(getBars).getBars(fullOpts);

            expect(getBars).toHaveBeenCalledTimes(2);
            expect(
                warnSpy.mock.calls.some(([message]: unknown[]) =>
                    String(message).includes('eodhist price gap')
                )
            ).toBe(false);
        });

        it('a missing overlap bar in the upstream response refetches the whole window', async () => {
            const getBars = makeUpstream(
                () => ledger,
                o =>
                    o.from === '2026-06-29'
                        ? ledger.filter(
                              b =>
                                  b.time > utcSeconds('2026-06-29') &&
                                  b.time <= utcSeconds(o.before!)
                          )
                        : undefined
            );
            await providerOver(getBars).getBars(fullOpts);

            appendRollDay();
            vi.setSystemTime(ROLL_AT);
            const result = await providerOver(getBars).getBars(fullOpts);

            expect(getBars).toHaveBeenCalledTimes(3);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({ from: WINDOW_START_AFTER_ROLL })
            );
            expect(result).toEqual(
                expectedWindow('2026-06-30', WINDOW_START_AFTER_ROLL)
            );
        });

        it('concurrent requests at the roll share one upstream refresh', async () => {
            const base = makeUpstream(() => ledger);
            await providerOver(base).getBars(fullOpts);

            // Hold the refresh until every caller is waiting on it: a caller whose (zstd) decode
            // finishes after the refresh completed would legitimately see the new entry instead.
            let release!: () => void;
            const gate = new Promise<void>(resolve => (release = resolve));
            const getBars = vi.fn(async (o: GetBarsOptions) => {
                if (o.from === '2026-06-29') await gate;
                return base(o);
            });
            const provider = providerOver(getBars);

            appendRollDay();
            vi.setSystemTime(ROLL_AT);
            const decodesBefore = eodDecodes.count;
            const pending = Promise.all([
                provider.getBars(fullOpts),
                provider.getBars({ ...fullOpts, from: '2025-06-01' }),
                providerOver(getBars).getBars(fullOpts),
                providerOver(getBars).getBars({
                    ...fullOpts,
                    from: '2024-06-30',
                }),
            ]);
            // every caller has read and decoded the stale entry → one owner, three waiters
            await waitForEodDecodes(decodesBefore, 4);
            release();
            const results = await pending;

            // exactly one refresh for the four concurrent callers
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(results[0]).toEqual(
                expectedWindow('2026-06-30', WINDOW_START_AFTER_ROLL)
            );
            expect(results[1]).toEqual(
                expectedWindow('2026-06-30', '2025-06-01')
            );
        });

        it('an upstream error during the refresh propagates and keeps the previous entry', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);

            vi.setSystemTime(ROLL_AT);
            const failing = vi.fn(async () => {
                throw new Error('FMP 503');
            });
            await expect(
                providerOver(failing).getBars(fullOpts)
            ).rejects.toThrow('FMP 503');
            expect((await readEodEntry('AAPL'))?.asOf).toBe('2026-06-29');
        });

        it('an empty upstream result at the roll is not cached (previous entry kept)', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);

            vi.setSystemTime(ROLL_AT);
            const empty = vi.fn(async () => []);
            const result = await providerOver(empty).getBars(fullOpts);

            expect(result).toEqual([]);
            // overlap probe (empty → unverifiable) then the full refetch (empty)
            expect(empty).toHaveBeenCalledTimes(2);
            expect((await readEodEntry('AAPL'))?.asOf).toBe('2026-06-29');
        });

        it('KR (yahoo session): an entry still in Redis at the next KRX session is extended from the last cached session (overlap)', async () => {
            vi.setSystemTime(new Date('2026-09-23T11:00:00Z')); // L = 09-23
            const krDays = [...daysBetween('2021-01-01', '2026-09-23')];
            ledger = barsOn(krDays);
            const getBars = makeUpstream(() => ledger);
            const opts: GetBarsOptions = {
                symbol: '005930.KS',
                timeframe: '1Day',
            };
            await providerOver(getBars, KR_EQUITY_SESSION).getBars(opts);

            // KRX closed 09-24..09-28; the next session is 09-29. (In production the 5-day TTL would
            // have expired this entry over a 6-day gap and the next read would fetch the full window;
            // the fake Redis does not expire, which isolates the yahoo-session overlap logic.)
            ledger = [...ledger, ...barsOn(['2026-09-29'])];
            vi.setSystemTime(new Date('2026-09-29T11:00:00Z')); // L = 09-29
            const result = await providerOver(
                getBars,
                KR_EQUITY_SESSION
            ).getBars(opts);

            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    symbol: '005930.KS',
                    from: '2026-09-23',
                    before: '2026-09-29',
                })
            );
            expect(result.at(-1)?.time).toBe(utcSeconds('2026-09-29'));
            expect((await readEodEntry('005930.KS'))?.asOf).toBe('2026-09-29');
        });

        it('crypto session: rolls the next UTC day with the overlap from the last cached day', async () => {
            vi.setSystemTime(new Date('2026-07-04T15:00:00Z')); // L = 07-03
            ledger = barsOn(daysBetween('2021-01-01', '2026-07-03'));
            const getBars = makeUpstream(() => ledger);
            const opts: GetBarsOptions = {
                symbol: 'BTCUSD',
                timeframe: '1Day',
            };
            await providerOver(getBars, CRYPTO_SESSION).getBars(opts);

            ledger = [...ledger, ...barsOn(['2026-07-04'])];
            vi.setSystemTime(new Date('2026-07-05T15:00:00Z')); // L = 07-04
            const result = await providerOver(getBars, CRYPTO_SESSION).getBars(
                opts
            );

            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    from: '2026-07-03',
                    before: '2026-07-04',
                })
            );
            expect(result.at(-1)?.time).toBe(utcSeconds('2026-07-04'));
        });

        it('a normal incremental merge neither warns nor resets fullAt', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);
            const coldFullAt = (await readEodEntry('AAPL'))?.fullAt;

            appendRollDay();
            vi.setSystemTime(ROLL_AT);
            await providerOver(getBars).getBars(fullOpts);

            expect(overlapWarnings()).toHaveLength(0);
            expect((await readEodEntry('AAPL'))?.fullAt).toBe(coldFullAt);
            expect((await readEodEntry('AAPL'))?.checkedAt).toBe(
                ROLL_AT.getTime()
            );
        });

        it('warns once with the symbol and "different" when the overlap bar differs (split)', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);
            ledger = [
                ...barsOn(
                    daysBetween(addDays(WINDOW_START, -10), '2026-06-29'),
                    0.1
                ),
                ...barsOn(['2026-06-30'], 0.1),
            ];
            vi.setSystemTime(ROLL_AT);
            await providerOver(getBars).getBars(fullOpts);

            expect(overlapWarnings()).toEqual([
                [
                    '[CachedMarketDataProvider] eodhist overlap mismatch, full refetch:',
                    'AAPL',
                    'different',
                ],
            ]);
        });

        it('warns with "missing" when the overlap bar is absent from the response', async () => {
            const getBars = makeUpstream(
                () => ledger,
                o =>
                    o.from === '2026-06-29'
                        ? ledger.filter(b => b.time > utcSeconds('2026-06-29'))
                        : undefined
            );
            await providerOver(getBars).getBars(fullOpts);
            appendRollDay();
            vi.setSystemTime(ROLL_AT);
            await providerOver(getBars).getBars(fullOpts);

            expect(overlapWarnings()).toEqual([
                [
                    '[CachedMarketDataProvider] eodhist overlap mismatch, full refetch:',
                    'AAPL',
                    'missing',
                ],
            ]);
        });

        // ── bounded self-heal: a full refetch at least weekly ─────────────────
        it('an entry older than the full-refresh interval refetches the whole window at the roll and resets fullAt', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts); // cold, fullAt = 06-30 15:00Z

            // 8 days later (Wed 07-08): L = 07-07. The ledger holds every day through then.
            ledger = [
                ...ledger,
                ...barsOn(daysBetween('2026-06-30', '2026-07-07')),
            ];
            const later = new Date('2026-07-08T15:00:00Z');
            vi.setSystemTime(later);
            const result = await providerOver(getBars).getBars(fullOpts);

            const windowStart = addDays(WINDOW_START, 8);
            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    from: windowStart,
                    before: '2026-07-07',
                })
            );
            expect(result).toEqual(expectedWindow('2026-07-07', windowStart));
            expect((await readEodEntry('AAPL'))?.fullAt).toBe(later.getTime());
            // routine, not a mismatch
            expect(overlapWarnings()).toHaveLength(0);
        });

        it('a younger entry rolls incrementally and keeps its fullAt across several rolls', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);
            const coldFullAt = Date.parse('2026-06-30T15:00:00Z');

            appendRollDay();
            vi.setSystemTime(ROLL_AT); // L = 06-30
            await providerOver(getBars).getBars(fullOpts);
            ledger = [...ledger, ...barsOn(['2026-07-01'])];
            vi.setSystemTime(new Date('2026-07-02T00:30:00Z')); // L = 07-01
            await providerOver(getBars).getBars(fullOpts);

            // cold + two incremental refreshes, no full refetch
            expect(getBars).toHaveBeenCalledTimes(3);
            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({ from: '2026-06-30' })
            );
            expect((await readEodEntry('AAPL'))?.fullAt).toBe(coldFullAt);
        });

        // ── single-flight with different contexts (closure-coupled isFresh) ───
        // The owner's overlap fetch is held on a gate so the second request arrives while it is
        // in flight. `getBars` captures `now` at call time, so the clock is moved between the two
        // calls. The waits are on events (upstream call started, eodhist decode finished), not time.
        it("a waiter at an EARLIER lastClosed than the owner never receives the owner's newer bars; it refetches its own window and writes nothing", async () => {
            // Entry cached on Fri 06-26 (L = 06-25). Redis then holds asOf 06-25 for both callers.
            vi.setSystemTime(new Date('2026-06-26T15:00:00Z'));
            ledger = barsOn(
                daysBetween(addDays(WINDOW_START, -10), '2026-06-30')
            );
            const base = makeUpstream(() => ledger);
            await providerOver(base).getBars(fullOpts);

            let release!: () => void;
            const gate = new Promise<void>(resolve => (release = resolve));
            const getBars = vi.fn(async (o: GetBarsOptions) => {
                if (o.from === '2026-06-25') await gate; // the owner's overlap fetch
                return base(o);
            });
            const provider = providerOver(getBars);

            vi.setSystemTime(ROLL_AT); // owner: L = 06-30
            const owner = provider.getBars(fullOpts);
            // The owner is in its fetcher (in-flight registered) once its upstream call starts.
            await vi.waitFor(() => expect(getBars).toHaveBeenCalledTimes(1));
            vi.setSystemTime(new Date('2026-06-30T15:00:00Z')); // waiter: L = 06-29
            const decodesBefore = eodDecodes.count;
            const waiter = provider.getBars(fullOpts);
            await waitForEodDecodes(decodesBefore, 1); // the waiter has joined the in-flight
            release();
            const [ownerBars, waiterBars] = await Promise.all([owner, waiter]);

            const ownerWindow = expectedWindow(
                '2026-06-30',
                addDays(WINDOW_START, 1)
            );
            const waiterWindow = expectedWindow('2026-06-29', WINDOW_START);
            expect(ownerBars).toEqual(ownerWindow);
            // the waiter's own lastClosed: nothing after 06-29, full window from its own start
            expect(waiterBars).toEqual(waiterWindow);
            // owner: one overlap fetch; waiter: one full fetch ending at its own lastClosed
            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: '2026-06-25',
                    before: '2026-06-30',
                })
            );
            expect(getBars).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: WINDOW_START,
                    before: '2026-06-29',
                })
            );
            // Redis keeps the owner's entry; the waiter's uncached result did not overwrite it.
            const entry = await readEodEntry('AAPL');
            expect(entry?.asOf).toBe('2026-06-30');
            expect(entry?.bars.at(-1)?.time).toBe(utcSeconds('2026-06-30'));
        });

        it("a waiter whose from is older than the owner's window gets its own wider fetch; the stored entry keeps the owner's window", async () => {
            const base = makeUpstream(() => ledger);
            await providerOver(base).getBars(fullOpts); // cold at 06-30 15:00Z, L = 06-29

            appendRollDay();
            let release!: () => void;
            const gate = new Promise<void>(resolve => (release = resolve));
            const getBars = vi.fn(async (o: GetBarsOptions) => {
                if (o.from === '2026-06-29') await gate; // the owner's overlap fetch
                return base(o);
            });
            const provider = providerOver(getBars);
            const older = addDays(WINDOW_START_AFTER_ROLL, -20);

            vi.setSystemTime(ROLL_AT);
            const owner = provider.getBars(fullOpts);
            await vi.waitFor(() => expect(getBars).toHaveBeenCalledTimes(1));
            const decodesBefore = eodDecodes.count;
            const waiter = provider.getBars({ ...fullOpts, from: older });
            await waitForEodDecodes(decodesBefore, 1);
            release();
            const [ownerBars, waiterBars] = await Promise.all([owner, waiter]);

            expect(ownerBars).toEqual(
                expectedWindow('2026-06-30', WINDOW_START_AFTER_ROLL)
            );
            // satisfies the waiter's own from, which the owner's value could not cover
            expect(waiterBars).toEqual(expectedWindow('2026-06-30', older));
            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenCalledWith(
                expect.objectContaining({ from: older, before: '2026-06-30' })
            );
            const entry = await readEodEntry('AAPL');
            expect(entry?.from).toBe(WINDOW_START_AFTER_ROLL);
        });

        it('a request older than the cached window refetches from that from instead of extending', async () => {
            const getBars = makeUpstream(() => ledger);
            await providerOver(getBars).getBars(fullOpts);

            appendRollDay();
            vi.setSystemTime(ROLL_AT);
            const older = addDays(WINDOW_START_AFTER_ROLL, -20);
            await providerOver(getBars).getBars({ ...fullOpts, from: older });

            expect(getBars).toHaveBeenLastCalledWith(
                expect.objectContaining({ from: older, before: '2026-06-30' })
            );
            expect((await readEodEntry('AAPL'))?.from).toBe(older);
        });
    });

    describe('session spec — TTL', () => {
        // computeBarsEffectiveTtl(.., new Date(), ..)이 실제 벽시계를 쓰므로, ET 정규장 중에는
        // US_EQUITY의 open-TTL이 60이 되어 CRYPTO(항상 60)와 구분되지 않아 테스트가 시각에 따라
        // 깨졌다. 장이 닫힌 시각(토요일)으로 고정해 US_EQUITY가 closed-TTL(≠60)을 쓰도록 결정화한다.
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-01-03T12:00:00Z')); // 토요일 — 미국 장 마감
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('CRYPTO_SESSION → computeBarsEffectiveTtl이 always-open(60초) TTL을 반환한다', async () => {
            const inner = makeInner();
            const p = new CachedMarketDataProvider(inner, CRYPTO_SESSION);
            await p.getBars(barsOpts());
            /**
             * 60 = siglens-core 내부 open-TTL 상수(BARS_OPEN_TTL_SECONDS 또는 동등값).
             * @y0ngha/siglens-core@0.26.0 는 해당 상수를 외부로 export하지 않으므로
             * 리터럴로 고정한다. core의 open-TTL 값이 변경되면 이 값도 함께 갱신해야 한다(드리프트 위험).
             */
            expect(lastSetTtl.value).toBe(60);
        });

        it('기본 session(US_EQUITY_SESSION) → computeBarsEffectiveTtl이 ET 기반 TTL을 사용한다', async () => {
            const inner = makeInner();
            // US_EQUITY_SESSION 기본값 — ET 세션 기반 TTL(60 이외의 값)을 반환한다.
            const p = new CachedMarketDataProvider(inner);
            await p.getBars(barsOpts());
            // CRYPTO_SESSION의 60과 다름을 보장 — 정확한 값은 computeBarsEffectiveTtl 구현에 종속.
            expect(lastSetTtl.value).not.toBe(60);
            expect(typeof lastSetTtl.value).toBe('number');
        });
    });
    describe('history L1 (instance memory)', () => {
        beforeEach(() => {
            resetSharedState();
            vi.useFakeTimers({ toFake: ['Date'] });
            // Tue 2026-06-30 15:00Z = 11:00 EDT, lastClosed = 2026-06-29
            vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
        });
        afterEach(() => vi.useRealTimers());

        const longOpts: GetBarsOptions = {
            symbol: 'AAPL',
            timeframe: '1Day',
            from: '2024-06-30',
        };
        const completeHistory = [
            bar(Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)),
            bar(Math.floor(Date.parse('2026-06-29T00:00:00Z') / 1000)),
        ];

        it('같은 인스턴스의 반복 호출은 eodhist를 Redis에서 다시 GET하지 않는다', async () => {
            const getBars = vi.fn(async () => completeHistory);
            const p = new CachedMarketDataProvider(makeInner({ getBars }));
            await p.getBars(longOpts);
            fakeRedis.get.mockClear();

            await p.getBars(longOpts);
            const keys = fakeRedis.get.mock.calls.map(([k]) => k);
            expect(keys).not.toContain('bars:eodhist:v3:AAPL');
            // 오늘 봉(작은 live 부분)은 여전히 Redis TTL을 따른다.
            expect(keys).toContain('quote:snapshot:AAPL');
            expect(getBars).toHaveBeenCalledTimes(1);
        });

        it('L1 값이 요청 from을 덮지 못하면(isFresh 실패) Redis/inner로 내려간다', async () => {
            const getBars = vi.fn(async () => completeHistory);
            const p = new CachedMarketDataProvider(makeInner({ getBars }));
            await p.getBars(longOpts);
            // 고정 창 시작(마감일 − FEAR_GREED_LOOKBACK_DAYS)보다 이른 from이라야 L1 값이 덮지 못한다 —
            // 상수가 커져 창이 이 날짜를 넘어가면 재조회가 안 일어나 이 테스트가 실패로 알린다.
            const older = [
                bar(Math.floor(Date.parse('2021-01-04T00:00:00Z') / 1000)),
                ...completeHistory,
            ];
            getBars.mockResolvedValueOnce(older);
            const r = await p.getBars({ ...longOpts, from: '2021-01-04' });
            expect(getBars).toHaveBeenCalledTimes(2);
            expect(r[0]!.time).toBe(older[0]!.time);
        });

        it('L1은 최대 30분만 쥔다 — 그 뒤엔 Redis를 다시 본다', async () => {
            const getBars = vi.fn(async () => completeHistory);
            const p = new CachedMarketDataProvider(makeInner({ getBars }));
            await p.getBars(longOpts);
            vi.setSystemTime(new Date('2026-06-30T15:31:00Z'));
            fakeRedis.get.mockClear();
            await p.getBars(longOpts);
            expect(fakeRedis.get.mock.calls.map(([k]) => k)).toContain(
                'bars:eodhist:v3:AAPL'
            );
            // Redis hit이라 inner는 다시 부르지 않는다.
            expect(getBars).toHaveBeenCalledTimes(1);
        });
    });

    describe('intraday history/tail split (intradayDateTimeZone)', () => {
        const ET = 'America/New_York';
        beforeEach(() => {
            resetSharedState();
            vi.useFakeTimers({ toFake: ['Date'] });
            // Tue 2026-06-30 15:00Z = 11:00 EDT — 정규장 중
            vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
        });
        afterEach(() => vi.useRealTimers());

        const utc = (iso: string) => Math.floor(Date.parse(iso) / 1000);
        // 월요일 15:55 EDT 봉과 화요일 09:30·10:55 EDT 봉
        const monBar = bar(utc('2026-06-29T19:55:00Z'));
        const tueOpen = bar(utc('2026-06-30T13:30:00Z'));
        const tueLate = { ...bar(utc('2026-06-30T14:55:00Z')), close: 9 };
        const intraOpts: GetBarsOptions = {
            symbol: 'aapl',
            timeframe: '5Min',
            from: '2026-06-20T00:00:00Z',
            limit: 288,
        };

        function splitInner() {
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? // FMP `to`가 포함이어도 결과가 같아야 한다 — 오늘 봉까지 돌려준다.
                      [monBar, tueOpen]
                    : [tueOpen, tueLate]
            );
            return { getBars, inner: makeInner({ getBars }) };
        }

        it('history(before=오늘)와 tail(from=오늘)을 따로 받아 병합한다', async () => {
            const { getBars, inner } = splitInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            const r = await p.getBars(intraOpts);

            expect(getBars).toHaveBeenCalledWith({
                ...intraOpts,
                from: '2026-06-20',
                before: '2026-06-30',
            });
            expect(getBars).toHaveBeenCalledWith({
                ...intraOpts,
                from: '2026-06-30',
            });
            expect(r).toEqual([monBar, tueOpen, tueLate]);
        });

        it('history 키에는 어제까지의 봉만 저장된다(오늘 봉은 tail 몫)', async () => {
            const { inner } = splitInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await p.getBars(intraOpts);
            const histKey =
                'bars:intrahist:AAPL:5Min:2026-06-20:2026-06-30:288';
            const histSet = fakeRedis.set.mock.calls.find(
                ([k]) => k === histKey
            );
            expect(histSet).toBeDefined();
            expect(histSet![1]).toEqual({ data: [monBar] });
            expect(histSet![2]?.ex).toBe(SECONDS_PER_HOUR * 24);
            const tailSet = fakeRedis.set.mock.calls.find(
                ([k]) => k === 'bars:raw:AAPL:5Min:2026-06-30::288'
            );
            expect(tailSet).toBeDefined();
            expect(tailSet![2]?.ex).toBe(60);
        });

        it('같은 날 재호출은 tail만 다시 받는다(tail TTL 만료 뒤)', async () => {
            const { getBars, inner } = splitInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await p.getBars(intraOpts);
            vi.setSystemTime(new Date('2026-06-30T15:02:00Z'));
            store.delete('bars:raw:AAPL:5Min:2026-06-30::288'); // TTL 만료 흉내
            await p.getBars(intraOpts);
            const historyCalls = getBars.mock.calls.filter(
                ([o]) => o.before !== undefined
            );
            const tailCalls = getBars.mock.calls.filter(
                ([o]) => o.before === undefined
            );
            expect(historyCalls).toHaveLength(1);
            expect(tailCalls).toHaveLength(2);
        });

        it('빈 tail(개장 전)은 짧게만 캐시한다', async () => {
            // 토요일 — 장외 TTL은 수십 시간이지만 빈 tail은 15분 상한
            vi.setSystemTime(new Date('2026-07-04T15:00:00Z'));
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined ? [monBar] : []
            );
            const p = new CachedMarketDataProvider(
                makeInner({ getBars }),
                undefined,
                { intradayDateTimeZone: ET }
            );
            await p.getBars(intraOpts);
            const tailSet = fakeRedis.set.mock.calls.find(
                ([k]) => k === 'bars:raw:AAPL:5Min:2026-07-04::288'
            );
            expect(tailSet![2]?.ex).toBe(15 * 60);
        });

        it('옵션이 없으면(Yahoo 등) 예전 단일 키 경로를 쓴다', async () => {
            const { getBars, inner } = splitInner();
            const p = new CachedMarketDataProvider(inner);
            await p.getBars(intraOpts);
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(getBars).toHaveBeenCalledWith(intraOpts);
        });

        it('before 지정(과거 페이지)·from이 오늘인 요청은 단일 키 경로', async () => {
            const { getBars, inner } = splitInner();
            const p = new CachedMarketDataProvider(inner, undefined, {
                intradayDateTimeZone: ET,
            });
            await p.getBars({ ...intraOpts, before: '2026-06-25' });
            await p.getBars({ ...intraOpts, from: '2026-06-30' });
            expect(getBars).toHaveBeenCalledTimes(2);
            expect(getBars).toHaveBeenNthCalledWith(1, {
                ...intraOpts,
                before: '2026-06-25',
            });
            expect(getBars).toHaveBeenNthCalledWith(2, {
                ...intraOpts,
                from: '2026-06-30',
            });
        });
    });
});

describe('CachedMarketDataProvider — quote 스냅샷 단일 업스트림 호출', () => {
    const TODAY_T = Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000);
    const HIST_T = Math.floor(Date.parse('2026-06-26T00:00:00Z') / 1000);
    const dailyOpts: GetBarsOptions = {
        symbol: 'AAPL',
        timeframe: '1Day',
        from: '2024-01-01',
    };

    /**
     * 업스트림 `quote` 호출 횟수를 하나의 스파이로 센다. raw provider처럼 `getQuote`·
     * `getTodayBar`·`getQuoteSnapshot`이 각각 업스트림을 한 번씩 부르므로, 캐시 계층이
     * 두 개별 메서드를 따로 부르면(옛 구조) 같은 종목에 2번이 세어진다.
     */
    function makeSnapshotInner(
        snapshot: QuoteSnapshot = {
            quote: SAMPLE_QUOTE,
            todayBar: bar(TODAY_T),
        }
    ) {
        const fetchQuote = vi.fn(async (_symbol: string) => snapshot);
        const inner = {
            getBars: vi.fn(async () => [bar(HIST_T)]),
            getQuote: vi.fn(async (s: string) => (await fetchQuote(s)).quote),
            getTodayBar: vi.fn(
                async (s: string) => (await fetchQuote(s)).todayBar
            ),
            getQuoteSnapshot: fetchQuote,
        } as unknown as SiglensMarketProvider;
        return { inner, fetchQuote };
    }

    beforeEach(() => {
        reset();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('getQuote 뒤 getBars(1Day): 업스트림 quote 호출은 1번', async () => {
        const { inner, fetchQuote } = makeSnapshotInner();
        const p = new CachedMarketDataProvider(inner);

        expect(await p.getQuote('AAPL')).toEqual(SAMPLE_QUOTE);
        const bars = await p.getBars(dailyOpts);

        expect(fetchQuote).toHaveBeenCalledTimes(1);
        expect(bars.map(b => b.time)).toEqual([HIST_T, TODAY_T]);
    });

    it('getBars(1Day) 뒤 getQuote: 업스트림 quote 호출은 1번', async () => {
        const { inner, fetchQuote } = makeSnapshotInner();
        const p = new CachedMarketDataProvider(inner);

        await p.getBars(dailyOpts);
        expect(await p.getQuote('AAPL')).toEqual(SAMPLE_QUOTE);

        expect(fetchQuote).toHaveBeenCalledTimes(1);
    });

    it('동시 호출(getQuote ∥ getBars)도 in-flight로 접혀 1번', async () => {
        const { inner, fetchQuote } = makeSnapshotInner();
        const p = new CachedMarketDataProvider(inner);

        await Promise.all([p.getQuote('aapl'), p.getBars(dailyOpts)]);

        expect(fetchQuote).toHaveBeenCalledTimes(1);
    });

    it('단일 키 quote:snapshot:<SYM>만 쓰고 옛 quote:<SYM>·bars:today:<SYM>는 쓰지 않는다', async () => {
        const { inner } = makeSnapshotInner();
        const p = new CachedMarketDataProvider(inner);

        await p.getQuote('AAPL');
        await p.getBars(dailyOpts);

        expect(store.has('quote:snapshot:AAPL')).toBe(true);
        expect(store.has('quote:AAPL')).toBe(false);
        expect(store.has('bars:today:AAPL')).toBe(false);
    });

    it('옛 키에 남은 엔트리는 스냅샷으로 읽히지 않는다', async () => {
        store.set('quote:AAPL', { data: { ...SAMPLE_QUOTE, price: 999 } });
        store.set('bars:today:AAPL', { data: [bar(TODAY_T + 86400)] });
        const { inner, fetchQuote } = makeSnapshotInner();
        const p = new CachedMarketDataProvider(inner);

        expect(await p.getQuote('AAPL')).toEqual(SAMPLE_QUOTE);
        expect(fetchQuote).toHaveBeenCalledTimes(1);
    });

    it('시세만 있고 오늘 봉이 없는 스냅샷은 캐싱한다 — TTL 동안 live tail 없이 재조회하지 않는다', async () => {
        // FMP에서 이 상태는 quote 행의 timestamp가 깨져 오늘 봉 매핑만 실패할 때뿐이다. 행
        // 단위로 지속되는 상태라 매 요청 다시 받아도 결과가 같다 — 예전 `bars:today`는 빈
        // 결과를 굳히지 않아 그 종목의 1Day 조회마다 FMP를 다시 불렀다.
        const { inner, fetchQuote } = makeSnapshotInner({
            quote: SAMPLE_QUOTE,
            todayBar: null,
        });
        const p = new CachedMarketDataProvider(inner);

        expect(await p.getQuote('AAPL')).toEqual(SAMPLE_QUOTE);
        expect(await p.getBars(dailyOpts)).toEqual([bar(HIST_T)]);
        expect(await p.getBars(dailyOpts)).toEqual([bar(HIST_T)]);

        expect(store.has('quote:snapshot:AAPL')).toBe(true);
        expect(fetchQuote).toHaveBeenCalledTimes(1);
    });

    it('둘 다 null인 스냅샷은 캐싱하지 않는다(getQuote null·빈 오늘 봉)', async () => {
        const { inner, fetchQuote } = makeSnapshotInner({
            quote: null,
            todayBar: null,
        });
        const p = new CachedMarketDataProvider(inner);

        expect(await p.getQuote('AAPL')).toBeNull();
        expect(await p.getBars(dailyOpts)).toEqual([bar(HIST_T)]);

        expect(store.has('quote:snapshot:AAPL')).toBe(false);
        expect(fetchQuote).toHaveBeenCalledTimes(2);
    });
});
