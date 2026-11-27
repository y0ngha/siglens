vi.mock('next/cache', () => ({
    unstable_cache: (fn: () => unknown, ...rest: unknown[]) =>
        unstableCache(fn, ...rest),
}));
vi.mock('@/shared/api/offlineBuild', () => ({
    isOfflineBuild: () => isOfflineBuild(),
}));
vi.mock('@/entities/sector-signal/api/sectorSignalsStaticCache', () => ({
    getSectorSignalsStatic: (...args: unknown[]) =>
        getSectorSignalsStatic(...args),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/ticker/server/koreanNameStore', () => ({
    lookupTickerDisplayNames: (...args: unknown[]) =>
        lookupTickerDisplayNames(...args),
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfDatabaseMissingAtBuild: () => shortenIfDbMissing(),
    shortenRevalidateForRuntimeDegrade: () => shortenForRuntimeDegrade(),
}));
vi.mock('@/entities/signal-history/api', () => ({
    SIGNAL_HISTORY_CACHE_TAG: 'signal-history',
    DrizzleSignalHistoryRepository: class {
        listLatestSessionEpisodes = listLatestSessionEpisodes;
    },
}));
vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: class {
        listSymbolsWithDetectedPatterns = listSymbolsWithDetectedPatterns;
    },
}));

import { defined } from '@/shared/test-utils/defined';
import { guideEntry } from '@/__tests__/fixtures/guideFixtures';

import { TWICE_WEEKLY_MAX_GAP_MS } from '@/entities/seo-snapshot/lib/freshness';
import { MS_PER_DAY } from '@/shared/config/time';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import { loadGuideLiveSymbols } from '../_lib/loadGuideLiveSymbols';

const getSectorSignalsStatic = vi.fn();
const listSymbolsWithDetectedPatterns = vi.fn();
const isOfflineBuild = vi.fn(() => false);
const lookupTickerDisplayNames = vi.fn();
const listLatestSessionEpisodes = vi.fn();
const shortenIfDbMissing = vi.fn(() => Promise.resolve());
const shortenForRuntimeDegrade = vi.fn(() => Promise.resolve());

const unstableCache = vi.fn((fn: () => unknown, ..._rest: unknown[]) => fn);

const rsi = guideEntry({ slug: 'rsi', signals: ['rsi_oversold'] });
const doubleBottom = guideEntry({
    slug: 'double-bottom',
    category: 'chart-patterns',
});
const plain = guideEntry({ slug: 'candle-basics', category: 'candlesticks' });
const catalog = [rsi, doubleBottom, plain];

const scan = (symbol: string) => ({
    computedAt: '2026-10-25T00:00:00.000Z',
    stocks: [
        {
            symbol,
            koreanName: symbol,
            sectorSymbol: 'XLK',
            price: 1,
            changePercent: 1,
            trend: 'uptrend',
            signals: [
                {
                    type: 'rsi_oversold',
                    direction: 'bullish',
                    phase: 'confirmed',
                    detectedAt: 1,
                },
            ],
        },
    ],
});

describe('loadGuideLiveSymbols', () => {
    beforeEach(() => {
        getSectorSignalsStatic.mockReset();
        listSymbolsWithDetectedPatterns.mockReset();
        lookupTickerDisplayNames.mockReset();
        listLatestSessionEpisodes.mockReset();
        shortenIfDbMissing.mockClear();
        shortenForRuntimeDegrade.mockClear();
        listLatestSessionEpisodes.mockResolvedValue([]);
        unstableCache.mockClear();
        lookupTickerDisplayNames.mockResolvedValue({});
        isOfflineBuild.mockReturnValue(false);
    });

    it('대상이 없는 항목은 데이터원을 부르지 않고 null', async () => {
        await expect(loadGuideLiveSymbols(plain, catalog)).resolves.toBeNull();
        expect(getSectorSignalsStatic).not.toHaveBeenCalled();
        expect(listSymbolsWithDetectedPatterns).not.toHaveBeenCalled();
    });

    it('신호형은 us·kr 스캐너를 읽고 그룹을 돌려준다', async () => {
        getSectorSignalsStatic.mockImplementation((scope: { id: string }) =>
            Promise.resolve(scan(scope.id === 'kr' ? '005930.KS' : 'AAPL'))
        );
        const groups = await loadGuideLiveSymbols(rsi, catalog);
        expect(getSectorSignalsStatic).toHaveBeenCalledTimes(2);
        expect(groups?.map(g => [g.market, g.rows[0]!.symbol])).toEqual([
            ['us', 'AAPL'],
            ['kr', '005930.KS'],
        ]);
        expect(listSymbolsWithDetectedPatterns).not.toHaveBeenCalled();
    });

    it('패턴형은 스냅샷만 읽고 generatedAt을 ISO로 넘긴다', async () => {
        listSymbolsWithDetectedPatterns.mockResolvedValue([
            {
                symbol: 'TSLA',
                generatedAt: new Date('2026-10-24T21:00:00.000Z'),
                detectedPatterns: ['double_bottom'],
            },
        ]);
        const groups = await loadGuideLiveSymbols(doubleBottom, catalog);
        expect(getSectorSignalsStatic).not.toHaveBeenCalled();
        expect(groups?.[0]?.rows[0]).toMatchObject({
            symbol: 'TSLA',
            basis: 'snapshot',
            detectedOn: '2026-10-24T21:00:00.000Z',
        });
    });

    it('스냅샷 캐시 키는 값 모양 버전(v2)을 담고, 이름 캐시는 하루 창과 가이드 태그를 쓴다', async () => {
        listSymbolsWithDetectedPatterns.mockResolvedValue([
            {
                symbol: 'TSLA',
                generatedAt: new Date('2026-10-24T21:00:00.000Z'),
                detectedPatterns: ['double_bottom'],
            },
        ]);
        await loadGuideLiveSymbols(doubleBottom, catalog);
        expect(unstableCache).toHaveBeenCalledWith(
            expect.any(Function),
            ['guide-live', 'patterns', 'v2', 'double_bottom'],
            expect.objectContaining({ tags: ['guide'] })
        );
        expect(unstableCache).toHaveBeenCalledWith(
            expect.any(Function),
            ['guide-live', 'names', 'TSLA'],
            { revalidate: 86400, tags: ['guide'] }
        );
    });

    it('고른 행의 한국어 이름을 심볼별로 한 번에 조회해 입힌다(정본 이름이 스캐너 이름보다 앞선다)', async () => {
        getSectorSignalsStatic.mockImplementation((scope: { id: string }) =>
            Promise.resolve(scan(scope.id === 'kr' ? '005930.KS' : 'AAPL'))
        );
        lookupTickerDisplayNames.mockResolvedValue({
            AAPL: { koreanName: '애플', name: 'Apple Inc.' },
            '005930.KS': { koreanName: '삼성전자', name: null },
        });
        const groups = await loadGuideLiveSymbols(rsi, catalog);
        expect(lookupTickerDisplayNames).toHaveBeenCalledWith([
            '005930.KS',
            'AAPL',
        ]);
        expect(groups?.map(g => g.rows[0]!.name)).toEqual(['애플', '삼성전자']);
    });

    it('이름 조회가 던지거나 null을 돌려줘도 모듈은 렌더되고 이름은 스캐너 값/null로 남는다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        getSectorSignalsStatic.mockImplementation((scope: { id: string }) =>
            Promise.resolve(scan(scope.id === 'kr' ? '005930.KS' : 'AAPL'))
        );
        lookupTickerDisplayNames.mockRejectedValueOnce(new Error('db down'));
        const thrown = await loadGuideLiveSymbols(rsi, catalog);
        expect(thrown?.map(g => [g.rows[0]!.symbol, g.rows[0]!.name])).toEqual([
            ['AAPL', 'AAPL'],
            ['005930.KS', '005930.KS'],
        ]);

        lookupTickerDisplayNames.mockResolvedValueOnce(null);
        const failed = await loadGuideLiveSymbols(rsi, catalog);
        expect(failed?.map(g => [g.rows[0]!.symbol, g.rows[0]!.name])).toEqual([
            ['AAPL', 'AAPL'],
            ['005930.KS', '005930.KS'],
        ]);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('names'),
            expect.any(Error)
        );

        listSymbolsWithDetectedPatterns.mockResolvedValue([
            {
                symbol: 'TSLA',
                generatedAt: new Date('2026-10-24T21:00:00.000Z'),
                detectedPatterns: ['double_bottom'],
            },
        ]);
        lookupTickerDisplayNames.mockRejectedValueOnce(new Error('db down'));
        const snapshotOnly = await loadGuideLiveSymbols(doubleBottom, catalog);
        expect(snapshotOnly?.[0]?.rows[0]).toMatchObject({
            symbol: 'TSLA',
            name: null,
        });
        warn.mockRestore();
    });

    it('스냅샷 행은 적중한 패턴 id를 그대로 받아 자기 패턴의 가이드로 라벨링된다', async () => {
        const at = new Date('2026-10-24T21:00:00.000Z');
        const both = guideEntry({
            slug: 'double-patterns',
            category: 'howto',
            about: ['double-bottom', 'double-top'],
        });
        const doubleTop = guideEntry({
            slug: 'double-top',
            category: 'chart-patterns',
        });
        listSymbolsWithDetectedPatterns.mockImplementation(
            (_names: string[], { market }: { market: string }) =>
                Promise.resolve(
                    market === 'us'
                        ? [
                              {
                                  symbol: 'TSLA',
                                  generatedAt: at,
                                  detectedPatterns: ['double_top'],
                              },
                              {
                                  symbol: 'AMD',
                                  generatedAt: at,
                                  detectedPatterns: ['double_bottom'],
                              },
                          ]
                        : []
                )
        );
        const groups = await loadGuideLiveSymbols(both, [
            both,
            doubleBottom,
            doubleTop,
        ]);
        const match = Object.fromEntries(
            groups![0]!.rows.map(row => [row.symbol, row.match])
        );
        expect(match.TSLA).toEqual({
            kind: 'pattern',
            guidePath: '/guide/chart-patterns/double-top',
        });
        expect(match.AMD).toEqual({
            kind: 'pattern',
            guidePath: '/guide/chart-patterns/double-bottom',
        });
    });

    it('모든 데이터원이 던지면 null(500 금지)', async () => {
        getSectorSignalsStatic.mockRejectedValue(new Error('fmp down'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(loadGuideLiveSymbols(rsi, catalog)).resolves.toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('[guide-live]'),
            expect.any(Error)
        );
        warn.mockRestore();
    });

    it('스캐너 한 시장이 던져도 다른 시장 행은 남고 실패한 시장을 로그에 적는다', async () => {
        getSectorSignalsStatic.mockImplementation((scope: { id: string }) =>
            scope.id === 'kr'
                ? Promise.reject(new Error('yahoo down'))
                : Promise.resolve(scan('AAPL'))
        );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const groups = await loadGuideLiveSymbols(rsi, catalog);
        expect(groups?.map(g => [g.market, g.rows[0]!.symbol])).toEqual([
            ['us', 'AAPL'],
        ]);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('kr scanner'),
            expect.any(Error)
        );
        warn.mockRestore();
    });

    it('스냅샷이 던지면 null이고 스냅샷 실패를 로그에 적는다', async () => {
        listSymbolsWithDetectedPatterns.mockRejectedValue(new Error('db down'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(
            loadGuideLiveSymbols(doubleBottom, catalog)
        ).resolves.toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('snapshot'),
            expect.any(Error)
        );
        warn.mockRestore();
    });

    it('스캐너가 던져도 패턴 항목의 스냅샷 행은 영향받지 않는다', async () => {
        const at = new Date('2026-10-24T21:00:00.000Z');
        listSymbolsWithDetectedPatterns.mockResolvedValue([
            {
                symbol: 'TSLA',
                generatedAt: at,
                detectedPatterns: ['double_bottom'],
            },
        ]);
        const both = guideEntry({
            slug: 'double-bottom',
            category: 'chart-patterns',
            signals: ['rsi_oversold'],
        });
        getSectorSignalsStatic.mockRejectedValue(new Error('fmp down'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const groups = await loadGuideLiveSymbols(both, [both]);
        expect(groups?.[0]?.rows[0]).toMatchObject({ symbol: 'TSLA' });
        warn.mockRestore();
    });

    it('스캐너는 /market과 같은 기본 타임프레임으로 읽는다', async () => {
        getSectorSignalsStatic.mockResolvedValue(scan('AAPL'));
        await loadGuideLiveSymbols(rsi, catalog);
        for (const call of getSectorSignalsStatic.mock.calls) {
            expect(call[1]).toBe(DEFAULT_DASHBOARD_TIMEFRAME);
        }
    });

    it('오프라인 빌드는 데이터원을 부르지 않고 null', async () => {
        getSectorSignalsStatic.mockImplementation((scope: { id: string }) =>
            Promise.resolve(scan(scope.id === 'kr' ? '005930.KS' : 'AAPL'))
        );
        listSymbolsWithDetectedPatterns.mockResolvedValue([]);
        isOfflineBuild.mockReturnValue(true);
        await expect(loadGuideLiveSymbols(rsi, catalog)).resolves.toBeNull();
        await expect(
            loadGuideLiveSymbols(doubleBottom, catalog)
        ).resolves.toBeNull();
        expect(getSectorSignalsStatic).not.toHaveBeenCalled();
        expect(listSymbolsWithDetectedPatterns).not.toHaveBeenCalled();
    });

    it('스냅샷은 시장마다 한 번씩, 시장당 limit·여유 배수로 읽는다', async () => {
        listSymbolsWithDetectedPatterns.mockResolvedValue([]);
        await loadGuideLiveSymbols(doubleBottom, catalog);
        expect(listSymbolsWithDetectedPatterns).toHaveBeenCalledTimes(2);
        const markets = listSymbolsWithDetectedPatterns.mock.calls
            .map(([, options]) => options.market)
            .toSorted();
        expect(markets).toEqual(['kr', 'us']);
        for (const [names, options] of listSymbolsWithDetectedPatterns.mock
            .calls) {
            expect(names).toEqual(['double_bottom']);
            expect(options.limit).toBe(10);
        }
    });

    it('한 시장이 많이 걸려도 시장별 호출이 독립이라 다른 시장 행이 남고 시장당 5개 상한이 적용된다', async () => {
        const at = new Date('2026-10-24T21:00:00.000Z');
        listSymbolsWithDetectedPatterns.mockImplementation(
            (_names: string[], { market }: { market: string }) =>
                Promise.resolve(
                    market === 'us'
                        ? Array.from({ length: 10 }, (_, i) => ({
                              symbol: `US${i}`,
                              generatedAt: at,
                              detectedPatterns: ['double_bottom'],
                          }))
                        : [
                              {
                                  symbol: '005930.KS',
                                  generatedAt: at,
                                  detectedPatterns: ['double_bottom'],
                              },
                          ]
                )
        );
        const groups = await loadGuideLiveSymbols(doubleBottom, catalog);
        expect(groups?.map(g => [g.market, g.rows.length])).toEqual([
            ['us', 5],
            ['kr', 1],
        ]);
    });
    describe('신호 대상의 신호 기록 읽기', () => {
        const episode = (
            symbol: string,
            sessionDate = '2026-11-20',
            signalType = 'rsi_oversold'
        ) => ({
            symbol,
            koreanName: null,
            signalType,
            sessionDate,
            changePercent: -2.5,
        });

        it('기록에 행이 있으면 스캐너를 부르지 않고 처음 잡힌 날을 담은 기록 행을 돌려준다', async () => {
            listLatestSessionEpisodes.mockImplementation(
                (_types: string[], market: string) =>
                    Promise.resolve(
                        market === 'kr'
                            ? [episode('005930.KS', '2026-11-19')]
                            : [episode('AAPL')]
                    )
            );
            const groups = await loadGuideLiveSymbols(rsi, catalog);
            expect(getSectorSignalsStatic).not.toHaveBeenCalled();
            expect(groups?.map(g => [g.market, g.rows[0]])).toEqual([
                [
                    'us',
                    expect.objectContaining({
                        symbol: 'AAPL',
                        basis: 'history',
                        firstSeenSession: '2026-11-20',
                    }),
                ],
                [
                    'kr',
                    expect.objectContaining({
                        symbol: '005930.KS',
                        firstSeenSession: '2026-11-19',
                    }),
                ],
            ]);
        });

        it('시장별 읽기 인자 — 신호 유형·시장·시장당 상한×여유 배수', async () => {
            getSectorSignalsStatic.mockResolvedValue(scan('AAPL'));
            await loadGuideLiveSymbols(rsi, catalog);
            expect(listLatestSessionEpisodes).toHaveBeenCalledWith(
                ['rsi_oversold'],
                'us',
                15
            );
            expect(listLatestSessionEpisodes).toHaveBeenCalledWith(
                ['rsi_oversold'],
                'kr',
                15
            );
        });

        it('캐시는 신호 기록 태그와 가이드 태그를 달고 한 시간 창이며, 키에 시장과 신호 유형이 든다', async () => {
            listLatestSessionEpisodes.mockResolvedValue([episode('AAPL')]);
            await loadGuideLiveSymbols(rsi, catalog);
            expect(unstableCache).toHaveBeenCalledWith(
                expect.any(Function),
                ['guide-live', 'history', 'v1', 'us', 'rsi_oversold'],
                {
                    revalidate: 3600,
                    tags: ['signal-history', 'guide'],
                }
            );
        });

        it('기록 읽기가 던지면 그 시장은 스캐너로 대신하고 실패를 로그에 적는다', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            listLatestSessionEpisodes.mockRejectedValue(new Error('db down'));
            getSectorSignalsStatic.mockImplementation((scope: { id: string }) =>
                Promise.resolve(scan(scope.id === 'kr' ? '005930.KS' : 'AAPL'))
            );
            const groups = await loadGuideLiveSymbols(rsi, catalog);
            expect(getSectorSignalsStatic).toHaveBeenCalledTimes(2);
            expect(groups?.map(g => defined(g.rows[0]).basis)).toEqual([
                'scanner',
                'scanner',
            ]);
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('us history'),
                expect.any(Error)
            );
            warn.mockRestore();
        });

        it('0064 표가 아직 없어(42P01) 던져도 스캐너로 대신한다', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            listLatestSessionEpisodes.mockRejectedValue(
                Object.assign(
                    new Error('relation "signal_scan_sessions" does not exist'),
                    { code: '42P01' }
                )
            );
            getSectorSignalsStatic.mockResolvedValue(scan('AAPL'));
            const groups = await loadGuideLiveSymbols(rsi, catalog);
            expect(getSectorSignalsStatic).toHaveBeenCalled();
            expect(groups?.[0]?.rows[0]).toMatchObject({
                symbol: 'AAPL',
                basis: 'scanner',
            });
            warn.mockRestore();
        });

        it('한 시장만 기록이 있으면 그 시장은 기록, 비어 있는 시장은 스캐너다', async () => {
            listLatestSessionEpisodes.mockImplementation(
                (_types: string[], market: string) =>
                    Promise.resolve(market === 'us' ? [episode('AAPL')] : [])
            );
            getSectorSignalsStatic.mockResolvedValue(scan('005930.KS'));
            const groups = await loadGuideLiveSymbols(rsi, catalog);
            expect(getSectorSignalsStatic).toHaveBeenCalledTimes(1);
            expect(
                getSectorSignalsStatic.mock.calls.map(([scope]) => scope.id)
            ).toEqual(['kr']);
            expect(
                groups?.map(g => [g.market, defined(g.rows[0]).basis])
            ).toEqual([
                ['us', 'history'],
                ['kr', 'scanner'],
            ]);
        });

        it('기록도 스캐너도 모두 실패하면 null', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            listLatestSessionEpisodes.mockRejectedValue(new Error('db down'));
            getSectorSignalsStatic.mockRejectedValue(new Error('fmp down'));
            await expect(
                loadGuideLiveSymbols(rsi, catalog)
            ).resolves.toBeNull();
            warn.mockRestore();
        });

        it('오프라인 빌드는 기록도 읽지 않는다', async () => {
            isOfflineBuild.mockReturnValue(true);
            await expect(
                loadGuideLiveSymbols(rsi, catalog)
            ).resolves.toBeNull();
            expect(listLatestSessionEpisodes).not.toHaveBeenCalled();
        });

        it('DB 부재 빌드의 revalidate 핀을 렌더 경로에서 부른다(굳지 않게)', async () => {
            getSectorSignalsStatic.mockResolvedValue(scan('AAPL'));
            await loadGuideLiveSymbols(rsi, catalog);
            expect(shortenIfDbMissing).toHaveBeenCalledTimes(1);
        });

        it('오프라인 빌드는 핀도 부르지 않는다', async () => {
            isOfflineBuild.mockReturnValue(true);
            await loadGuideLiveSymbols(rsi, catalog);
            expect(shortenIfDbMissing).not.toHaveBeenCalled();
        });

        it('기록 읽기가 실패해 스캐너로 대신한 렌더는 런타임 degrade 핀으로 낮추고, 정상 렌더는 낮추지 않는다', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            getSectorSignalsStatic.mockResolvedValue(scan('AAPL'));
            await loadGuideLiveSymbols(rsi, catalog);
            expect(shortenForRuntimeDegrade).not.toHaveBeenCalled();

            listLatestSessionEpisodes.mockRejectedValue(new Error('db down'));
            await loadGuideLiveSymbols(rsi, catalog);
            expect(shortenForRuntimeDegrade).toHaveBeenCalledTimes(1);
            warn.mockRestore();
        });

        it('패턴 항목은 기록을 읽지 않는다', async () => {
            listSymbolsWithDetectedPatterns.mockResolvedValue([]);
            await loadGuideLiveSymbols(doubleBottom, catalog);
            expect(listLatestSessionEpisodes).not.toHaveBeenCalled();
        });
    });

    it('스냅샷 창은 조용한 종목의 주기(주 2회 앵커의 가장 긴 간격)에 하루를 더한 값이다', async () => {
        listSymbolsWithDetectedPatterns.mockResolvedValue([]);
        const now = Date.parse('2026-11-22T00:00:00.000Z');
        vi.useFakeTimers({ now });
        try {
            await loadGuideLiveSymbols(doubleBottom, catalog);
        } finally {
            vi.useRealTimers();
        }
        const sinces = listSymbolsWithDetectedPatterns.mock.calls.map(
            ([, options]) => options.since.getTime()
        );
        expect(new Set(sinces)).toEqual(
            new Set([now - (TWICE_WEEKLY_MAX_GAP_MS + MS_PER_DAY)])
        );
    });
});
