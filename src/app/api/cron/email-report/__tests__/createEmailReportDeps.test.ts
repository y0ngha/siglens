const mocks = vi.hoisted(() => ({
    db: { marker: 'db' },
    findExcluded: vi.fn(),
    findHoldings: vi.fn(),
    findWatchlist: vi.fn(),
    exclusionCtor: vi.fn(),
    welcomeCtor: vi.fn(),
    portfolioCtor: vi.fn(),
    watchlistCtor: vi.fn(),
    loadBarsData: vi.fn(),
    findLatestShareable: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: mocks.db })),
}));
vi.mock('@/entities/email-report/api', () => ({
    DrizzleEmailReportDeliveryRepository: vi.fn(),
    DrizzleEmailReportSubscriptionRepository: vi.fn(),
    DrizzleEmailReportWelcomeRepository: vi.fn().mockImplementation(function (
        db: unknown
    ) {
        mocks.welcomeCtor(db);
        return { marker: 'welcomes' };
    }),
    DrizzleEmailReportExclusionRepository: vi.fn().mockImplementation(function (
        db: unknown
    ) {
        mocks.exclusionCtor(db);
        return { findExcludedSymbols: mocks.findExcluded };
    }),
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function (
        db: unknown
    ) {
        mocks.portfolioCtor(db);
        return { findByUser: mocks.findHoldings };
    }),
}));
vi.mock('@/entities/watchlist/api', () => ({
    DrizzleWatchlistRepository: vi.fn().mockImplementation(function (
        db: unknown
    ) {
        mocks.watchlistCtor(db);
        return { findByUser: mocks.findWatchlist };
    }),
}));
vi.mock('@/entities/bars/server/loadBarsData', () => ({
    loadBarsData: mocks.loadBarsData,
}));
vi.mock('@/entities/ticker/server/getAssetInfoStatic', () => ({
    getAssetInfoStatic: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn().mockImplementation(function () {
        return { findLatestShareable: mocks.findLatestShareable };
    }),
}));
import { calculateIndicators, type Bar } from '@y0ngha/siglens-core';
import {
    createEmailReportDeps,
    DAILY_BARS_MEMO_MAX,
} from '@/app/api/cron/email-report/createEmailReportDeps';

const dispatcher = { sendEmail: vi.fn(), sendKeyedEmail: vi.fn() };

describe('createEmailReportDeps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findExcluded.mockResolvedValue(['AAPL']);
        mocks.findHoldings.mockResolvedValue([{ symbol: 'MSFT' }]);
        mocks.findWatchlist.mockResolvedValue([{ symbol: 'TSLA' }]);
    });

    it('제외 종목 조회를 제외 저장소의 findExcludedSymbols에 회원 id로 연결한다', async () => {
        const deps = createEmailReportDeps('secret', new Date(), dispatcher);

        await expect(deps.findExcludedSymbols('u-1')).resolves.toEqual([
            'AAPL',
        ]);
        expect(mocks.findExcluded).toHaveBeenCalledWith('u-1');
        expect(mocks.exclusionCtor).toHaveBeenCalledWith(mocks.db);
    });

    it('보유·관심종목 조회도 각 저장소에 회원 id로 연결한다', async () => {
        const deps = createEmailReportDeps('secret', new Date(), dispatcher);

        await expect(deps.findHoldings('u-1')).resolves.toEqual([
            { symbol: 'MSFT' },
        ]);
        await expect(deps.findWatchlist('u-1')).resolves.toEqual([
            { symbol: 'TSLA' },
        ]);
        expect(mocks.findHoldings).toHaveBeenCalledWith('u-1');
        expect(mocks.findWatchlist).toHaveBeenCalledWith('u-1');
        expect(mocks.portfolioCtor).toHaveBeenCalledWith(mocks.db);
        expect(mocks.watchlistCtor).toHaveBeenCalledWith(mocks.db);
    });

    it('호출자가 넘긴 발송기를 그대로 쓴다(알림 메일 패스와 한 인스턴스를 공유한다)', () => {
        const deps = createEmailReportDeps('secret', new Date(), dispatcher);

        expect(deps.dispatcher).toBe(dispatcher);
    });

    it('첫 리포트 저장소를 같은 DB 클라이언트로 만들어 연결한다', () => {
        const deps = createEmailReportDeps('secret', new Date(), dispatcher);

        expect(deps.welcomes).toEqual({ marker: 'welcomes' });
        expect(mocks.welcomeCtor).toHaveBeenCalledWith(mocks.db);
    });

    describe('일봉 메모', () => {
        const DAY = 86_400;
        const T0 = 1_790_000_000;
        const bars: Bar[] = Array.from({ length: 100 }, (_, i) => ({
            time: T0 + i * DAY,
            open: 100,
            high: 110,
            low: 90,
            close: 100 + (i % 5),
            volume: 1,
        }));
        const lastDate = new Date((T0 + 99 * DAY) * 1_000)
            .toISOString()
            .slice(0, 10);

        beforeEach(() => {
            mocks.loadBarsData.mockResolvedValue({
                bars,
                indicators: calculateIndicators(bars),
            });
            mocks.findLatestShareable.mockResolvedValue(new Map());
        });

        it('같은 종목의 요약과 작도는 일봉을 한 번만 받는다', async () => {
            const deps = createEmailReportDeps(
                'secret',
                new Date(),
                dispatcher
            );

            await deps.loadBrief('AAPL');
            await deps.loadDrawings(['AAPL'], lastDate);

            expect(mocks.loadBarsData).toHaveBeenCalledTimes(1);
            expect(mocks.loadBarsData).toHaveBeenCalledWith('AAPL', '1Day');
        });

        it('작도 쪽이 먼저 읽어도 요약이 같은 일봉을 쓴다', async () => {
            mocks.findLatestShareable.mockResolvedValue(
                new Map([
                    [
                        'AAPL',
                        {
                            symbol: 'AAPL',
                            generatedAt: new Date(),
                            tier: 'member',
                            result: {},
                        },
                    ],
                ])
            );
            const deps = createEmailReportDeps(
                'secret',
                new Date(),
                dispatcher
            );

            await deps.loadDrawings(['AAPL'], lastDate);
            await deps.loadBrief('AAPL');

            expect(mocks.loadBarsData).toHaveBeenCalledTimes(1);
        });

        it('일봉 조회가 실패하면 그 실패를 기억하지 않고 다음 호출이 다시 받는다', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            mocks.loadBarsData.mockRejectedValueOnce(new Error('fmp down'));
            const deps = createEmailReportDeps(
                'secret',
                new Date(),
                dispatcher
            );

            const failed = await deps.loadBrief('AAPL');
            const retried = await deps.loadBrief('AAPL');

            expect(failed.close).toBeNull();
            expect(retried.close).not.toBeNull();
            expect(mocks.loadBarsData).toHaveBeenCalledTimes(2);
        });

        it('기억하는 종목 수에는 상한이 있어 넘치면 가장 오래된 종목부터 다시 받는다', async () => {
            const deps = createEmailReportDeps(
                'secret',
                new Date(),
                dispatcher
            );
            const symbols = Array.from(
                { length: DAILY_BARS_MEMO_MAX + 1 },
                (_, i) => `S${i}`
            );
            for (const symbol of symbols) await deps.loadBrief(symbol);
            expect(mocks.loadBarsData).toHaveBeenCalledTimes(symbols.length);

            await deps.loadBrief('S1');
            expect(mocks.loadBarsData).toHaveBeenCalledTimes(symbols.length);
            await deps.loadBrief('S0');
            expect(mocks.loadBarsData).toHaveBeenCalledTimes(
                symbols.length + 1
            );
        });
    });
});
