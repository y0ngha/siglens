import { guideEntry } from '@/__tests__/fixtures/guideFixtures';

const getSectorSignalsStatic = vi.fn();
const listSymbolsWithDetectedPatterns = vi.fn();
const isOfflineBuild = vi.fn(() => false);

vi.mock('next/cache', () => ({
    unstable_cache: (fn: () => unknown) => fn,
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
vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: class {
        listSymbolsWithDetectedPatterns = listSymbolsWithDetectedPatterns;
    },
}));

import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import { loadGuideLiveSymbols } from '../_lib/loadGuideLiveSymbols';

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
            { symbol: 'TSLA', generatedAt: at },
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
                          }))
                        : [{ symbol: '005930.KS', generatedAt: at }]
                )
        );
        const groups = await loadGuideLiveSymbols(doubleBottom, catalog);
        expect(groups?.map(g => [g.market, g.rows.length])).toEqual([
            ['us', 5],
            ['kr', 1],
        ]);
    });
});
