const mocks = vi.hoisted(() => ({
    db: { marker: 'db' },
    findHoldings: vi.fn(),
    findWatchlist: vi.fn(),
    resolveMarketProfile: vi.fn(),
    loadBarsData: vi.fn(),
    fearGreedUs: vi.fn(),
    fearGreedKr: vi.fn(),
    fearGreedCrypto: vi.fn(),
    isMailAlertLaunched: vi.fn(),
    getAssetInfoStatic: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: mocks.db })),
}));
vi.mock('@/entities/mail-alert/api', () => ({
    DrizzleMailAlertSubscriberRepository: vi.fn(),
    DrizzleMailAlertDeliveryRepository: vi.fn(),
}));
vi.mock('@/entities/signal-history/api', () => ({
    DrizzleSignalHistoryRepository: vi.fn(),
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mocks.findHoldings };
    }),
}));
vi.mock('@/entities/watchlist/api', () => ({
    DrizzleWatchlistRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mocks.findWatchlist };
    }),
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: mocks.resolveMarketProfile,
}));
vi.mock('@/entities/ticker/server/getAssetInfoStatic', () => ({
    getAssetInfoStatic: mocks.getAssetInfoStatic,
}));
vi.mock('@/entities/bars/server/loadBarsData', () => ({
    loadBarsData: mocks.loadBarsData,
}));
vi.mock('@/entities/market-fear-greed/api/marketFearGreedCache', () => ({
    getCachedMarketFearGreed: mocks.fearGreedUs,
}));
vi.mock('@/entities/market-fear-greed/api/marketFearGreedKrCache', () => ({
    getCachedMarketFearGreedKr: mocks.fearGreedKr,
}));
vi.mock('@/entities/market-fear-greed/api/marketFearGreedCryptoCache', () => ({
    getCachedMarketFearGreedCrypto: mocks.fearGreedCrypto,
}));
vi.mock('@/entities/email-report/server', () => ({
    getReportSignalLabelResolver: vi.fn(),
}));
vi.mock('@/entities/mail-alert/server/mailAlertEmailI18n', () => ({
    getMailAlertEmailTranslator: vi.fn(),
    getMailAlertDisclaimer: vi.fn(),
}));
vi.mock(
    '@/entities/mail-alert/lib/mailAlertConstants',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/mail-alert/lib/mailAlertConstants')
        >()),
        isMailAlertLaunched: mocks.isMailAlertLaunched,
    })
);

import { createMailAlertBatchDeps } from '@/app/api/cron/mail-alert/createMailAlertDeps';
import type { KeyedEmailDispatcher } from '@/shared/email/types';

const dispatcher: KeyedEmailDispatcher = {
    sendEmail: async () => true,
    sendKeyedEmail: async () => 'accepted',
};

describe('createMailAlertBatchDeps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isMailAlertLaunched.mockReturnValue(false);
    });

    it('공개 스위치 값과 비밀·발송기를 그대로 싣는다', () => {
        mocks.isMailAlertLaunched.mockReturnValue(true);

        const deps = createMailAlertBatchDeps('the-secret', dispatcher);

        expect(deps.launched).toBe(true);
        expect(deps.secret).toBe('the-secret');
        expect(deps.dispatcher).toBe(dispatcher);
    });

    it('비밀이 없으면 null을 그대로 넘긴다(실행이 스스로 멈춘다)', () => {
        expect(createMailAlertBatchDeps(null, dispatcher).secret).toBeNull();
    });

    it('종목 이름은 메일 리포트와 같은 종목 정보 캐시에서 영문명과 한글명을 읽는다', async () => {
        mocks.getAssetInfoStatic.mockResolvedValueOnce({
            name: 'Samsung Electronics',
            koreanName: '삼성전자',
        });
        mocks.getAssetInfoStatic.mockResolvedValueOnce(null);
        const deps = createMailAlertBatchDeps('s', dispatcher);

        await expect(deps.getSymbolNames('005930.KS')).resolves.toEqual({
            name: 'Samsung Electronics',
            koreanName: '삼성전자',
        });
        await expect(deps.getSymbolNames('ZZZZ')).resolves.toBeNull();
        expect(mocks.getAssetInfoStatic).toHaveBeenCalledWith('005930.KS');
    });

    it('보유·관심종목 조회는 각 저장소에 회원 id로 연결한다', async () => {
        mocks.findHoldings.mockResolvedValue([{ symbol: 'MSFT' }]);
        mocks.findWatchlist.mockResolvedValue([{ symbol: 'TSLA' }]);
        const deps = createMailAlertBatchDeps('s', dispatcher);

        await expect(deps.findHoldings('u-1')).resolves.toEqual([
            { symbol: 'MSFT' },
        ]);
        await expect(deps.findWatchlist('u-1')).resolves.toEqual([
            { symbol: 'TSLA' },
        ]);
        expect(mocks.findHoldings).toHaveBeenCalledWith('u-1');
        expect(mocks.findWatchlist).toHaveBeenCalledWith('u-1');
    });

    it('시장 프로필을 알림 시장으로 옮긴다: 미국·한국 주식만, 크립토는 제외', async () => {
        const deps = createMailAlertBatchDeps('s', dispatcher);
        mocks.resolveMarketProfile
            .mockResolvedValueOnce('us-equity')
            .mockResolvedValueOnce('kr-equity')
            .mockResolvedValueOnce('crypto');

        await expect(deps.resolveMarket('AAPL')).resolves.toBe('us');
        await expect(deps.resolveMarket('005930.KS')).resolves.toBe('kr');
        await expect(deps.resolveMarket('BTCUSD')).resolves.toBeNull();
    });

    it('일봉은 종목 페이지와 같은 일봉 로더에서 봉만 꺼낸다', async () => {
        mocks.loadBarsData.mockResolvedValue({
            bars: [{ time: 1 }],
            indicators: {},
        });
        const deps = createMailAlertBatchDeps('s', dispatcher);

        await expect(deps.sources.loadDailyBars('PLTR')).resolves.toEqual([
            { time: 1 },
        ]);
        expect(mocks.loadBarsData).toHaveBeenCalledWith('PLTR', '1Day');
    });

    it('공포탐욕 판독은 시장별 허브 캐시의 기록을 읽는다', async () => {
        mocks.fearGreedUs.mockResolvedValue({ history: ['us'] });
        mocks.fearGreedKr.mockResolvedValue({ history: ['kr'] });
        mocks.fearGreedCrypto.mockResolvedValue({ history: ['crypto'] });
        const deps = createMailAlertBatchDeps('s', dispatcher);

        await expect(deps.sources.loadFearGreedHistory('us')).resolves.toEqual([
            'us',
        ]);
        await expect(deps.sources.loadFearGreedHistory('kr')).resolves.toEqual([
            'kr',
        ]);
        await expect(
            deps.sources.loadFearGreedHistory('crypto')
        ).resolves.toEqual(['crypto']);
    });
});
