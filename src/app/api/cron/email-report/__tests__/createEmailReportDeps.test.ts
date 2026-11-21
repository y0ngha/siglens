const mocks = vi.hoisted(() => ({
    db: { marker: 'db' },
    findExcluded: vi.fn(),
    findHoldings: vi.fn(),
    findWatchlist: vi.fn(),
    exclusionCtor: vi.fn(),
    portfolioCtor: vi.fn(),
    watchlistCtor: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: mocks.db })),
}));
vi.mock('@/entities/email-report/api', () => ({
    DrizzleEmailReportDeliveryRepository: vi.fn(),
    DrizzleEmailReportSubscriptionRepository: vi.fn(),
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
import { createEmailReportDeps } from '@/app/api/cron/email-report/createEmailReportDeps';

const dispatcher = { sendEmail: vi.fn() };

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
});
