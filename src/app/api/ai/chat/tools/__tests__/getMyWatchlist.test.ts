const { findByUser, listForSubscriber, getQuote, asset, launched } = vi.hoisted(
    () => ({
        findByUser: vi.fn(),
        listForSubscriber: vi.fn(),
        getQuote: vi.fn(),
        asset: vi.fn(),
        launched: { on: false },
    })
);
vi.mock('@/entities/watchlist/api', () => ({
    DrizzleWatchlistRepository: vi.fn(function () {
        return { findByUser };
    }),
}));
vi.mock('@/entities/mail-alert/api', () => ({
    DrizzlePriceAlertRepository: vi.fn(function () {
        return { listForSubscriber };
    }),
}));
vi.mock('@/entities/mail-alert/lib/priceAlertConstants', () => ({
    isPriceAlertLaunched: () => launched.on,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    marketProfileForAssetInfo: (info: { marketProfile?: string } | null) =>
        info?.marketProfile ?? 'us-equity',
}));
vi.mock('@/app/api/ai/chat/tools/resolveAssetInfo', () => ({
    resolveAssetInfoOrNull: asset,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/market/sessionSpecFor')
    >()),
    sessionSpecFor: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getMyWatchlistTool,
    loadMyWatchlist,
    WATCHLIST_TOOL_NAME_MAX_CHARS,
} from '@/app/api/ai/chat/tools/getMyWatchlist';
import { WATCHLIST_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';
import { WATCHLIST_MAX_MEMBER } from '@/shared/config/watchlist';

const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};
const ctxFor = (userId: string) => ({
    userId,
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
});

const row = (symbol: string, companyName: string | null, day: number) => ({
    id: symbol,
    userId: 'u1',
    symbol,
    companyName,
    createdAt: new Date(Date.UTC(2026, 10, day, 1, 2, 3)),
});

describe('getMyWatchlistTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        launched.on = false;
        asset.mockResolvedValue(null);
        listForSubscriber.mockResolvedValue([]);
    });

    it('ctx.userId로만 조회하고 args의 다른 userId는 무시한다', async () => {
        findByUser.mockResolvedValue([]);

        await getMyWatchlistTool({ userId: 'someone-else' }, ctxFor('u1'), rt);

        expect(findByUser).toHaveBeenCalledWith('u1');
        expect(findByUser).not.toHaveBeenCalledWith('someone-else');
    });

    it('최근에 담은 순으로, 이름·담은 날·시세·등락률을 싣는다', async () => {
        findByUser.mockResolvedValue([
            row('AAPL', 'Apple', 3),
            row('NVDA', null, 20),
            row('MSFT', 'Microsoft', 10),
        ]);
        getQuote.mockImplementation(async (symbol: string) => ({
            price: symbol === 'NVDA' ? 140.123 : 200,
            changesPercentage: 1.2345,
        }));

        const result = await loadMyWatchlist('u1');

        expect(result.items.map(i => i.symbol)).toEqual([
            'NVDA',
            'MSFT',
            'AAPL',
        ]);
        expect(result.items[0]).toEqual({
            symbol: 'NVDA',
            name: null,
            addedAt: '2026-11-20',
            currency: 'USD',
            price: 140.123,
            dayChangePct: expect.closeTo(1.23, 1),
        });
        expect(result).toMatchObject({
            source: 'SIGLENS watchlist',
            count: 3,
        });
    });

    it('시세를 못 읽은 종목은 가격만 null로 두고 목록에 남긴다', async () => {
        findByUser.mockResolvedValue([row('AAPL', 'Apple', 3)]);
        getQuote.mockResolvedValue(null);

        const result = await loadMyWatchlist('u1');

        expect(result.items).toEqual([
            expect.objectContaining({
                symbol: 'AAPL',
                price: null,
                dayChangePct: null,
            }),
        ]);
    });

    it('시세 공급자가 던져도 다른 종목은 그대로 나온다', async () => {
        findByUser.mockResolvedValue([
            row('AAPL', 'Apple', 3),
            row('MSFT', 'Microsoft', 4),
        ]);
        getQuote.mockImplementation(async (symbol: string) => {
            if (symbol === 'AAPL') throw new Error('provider down');
            return { price: 300, changesPercentage: 0.5 };
        });
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const result = await loadMyWatchlist('u1');

        expect(result.items.map(i => [i.symbol, i.price])).toEqual([
            ['MSFT', 300],
            ['AAPL', null],
        ]);
    });

    it('한국 종목은 자산 정보의 시장·시세 심볼로 읽고 원화로 보인다', async () => {
        findByUser.mockResolvedValue([row('005930.KS', '삼성전자', 5)]);
        asset.mockResolvedValue({
            symbol: '005930.KS',
            name: 'Samsung',
            marketProfile: 'kr-equity',
            fmpSymbol: '005930.KS',
        });
        getQuote.mockResolvedValue({ price: 70_000, changesPercentage: -0.4 });

        const result = await loadMyWatchlist('u1');

        expect(getQuote).toHaveBeenCalledWith('005930.KS');
        expect(result.items[0]).toMatchObject({
            symbol: '005930.KS',
            currency: 'KRW',
            price: 70_000,
        });
    });

    it('낡은 시세는 상세 나이와 stalePriceCount를 싣고, 정상 시세에는 붙이지 않는다', async () => {
        findByUser.mockResolvedValue([
            row('AAPL', 'Apple', 3),
            row('OLD', 'Old Co', 4),
        ]);
        const nowSec = Math.floor(Date.now() / 1000);
        getQuote.mockImplementation(async (symbol: string) => ({
            price: 10,
            changesPercentage: 0,
            timestamp: symbol === 'OLD' ? nowSec - 30 * 86_400 : nowSec,
        }));

        const result = await loadMyWatchlist('u1');

        expect(result.stalePriceCount).toBe(1);
        const old = result.items.find(i => i.symbol === 'OLD');
        const fresh = result.items.find(i => i.symbol === 'AAPL');
        expect(old?.priceFreshness).toMatchObject({ stale: true });
        expect(fresh).not.toHaveProperty('priceFreshness');
    });

    it('관심종목이 없으면 빈 목록이다', async () => {
        findByUser.mockResolvedValue([]);

        const result = await loadMyWatchlist('u1');

        expect(result).toMatchObject({ count: 0, items: [] });
        expect(result).not.toHaveProperty('stalePriceCount');
    });

    it('가격대 알림이 공개되기 전에는 priceAlerts 키도, 저장소 읽기도 없다', async () => {
        findByUser.mockResolvedValue([]);

        const result = await loadMyWatchlist('u1');

        expect(result).not.toHaveProperty('priceAlerts');
        expect(listForSubscriber).not.toHaveBeenCalled();
    });

    it('공개된 뒤에는 살아 있는 알림만 조건·가격·끝나는 날과 함께 싣는다(회원 소유자로 읽는다)', async () => {
        launched.on = true;
        findByUser.mockResolvedValue([]);
        listForSubscriber.mockResolvedValue([
            {
                symbol: 'AAPL',
                market: 'us',
                status: 'active',
                basis: 'analysis_entry_zone',
                expiresOn: '2026-12-24',
                condition: {
                    kind: 'enter_zone',
                    low: 178,
                    high: 181.5,
                    approach: 'from_above',
                },
            },
            {
                symbol: 'MSFT',
                market: 'us',
                status: 'active',
                basis: 'price_level',
                expiresOn: '2026-12-24',
                condition: { kind: 'close_below', level: 400 },
            },
            {
                symbol: 'NVDA',
                market: 'us',
                status: 'fired',
                basis: 'price_level',
                expiresOn: '2026-12-24',
                condition: { kind: 'close_above', level: 150 },
            },
        ]);

        const result = await loadMyWatchlist('u1');

        expect(listForSubscriber).toHaveBeenCalledWith({
            kind: 'member',
            userId: 'u1',
        });
        expect(result.priceAlerts).toEqual([
            {
                symbol: 'AAPL',
                condition: 'enter_zone',
                low: 178,
                high: 181.5,
                basis: 'analysis_entry_zone',
                expiresOn: '2026-12-24',
            },
            {
                symbol: 'MSFT',
                condition: 'close_below',
                level: 400,
                basis: 'price_level',
                expiresOn: '2026-12-24',
            },
        ]);
    });

    it('알림을 읽지 못하면 관심종목은 그대로 주고 priceAlerts만 null이다(없다고 말하지 않는다)', async () => {
        launched.on = true;
        findByUser.mockResolvedValue([row('AAPL', 'Apple', 3)]);
        getQuote.mockResolvedValue({ price: 1, changesPercentage: 0 });
        listForSubscriber.mockRejectedValue(new Error('db down'));
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const result = await loadMyWatchlist('u1');

        expect(result.count).toBe(1);
        expect(result.priceAlerts).toBeNull();
    });

    it('만료 세션이 기대 세션보다 앞선 알림은 싣지 않는다(정리 전 행, 발송기와 같은 규칙)', async () => {
        launched.on = true;
        findByUser.mockResolvedValue([]);
        const alert = (symbol: string, market: string, expiresOn: string) => ({
            symbol,
            market,
            status: 'active',
            basis: 'price_level',
            expiresOn,
            condition: { kind: 'close_below', level: 100 },
        });
        listForSubscriber.mockResolvedValue([
            alert('OLDUS', 'us', '2000-01-03'),
            alert('OLDKR', 'kr', '2000-01-03'),
            alert('LIVE', 'us', '2999-01-01'),
        ]);

        const result = await loadMyWatchlist('u1');

        expect(result.priceAlerts?.map(a => a.symbol)).toEqual(['LIVE']);
    });

    it('긴 종목명은 상한 길이로 잘리고 말줄임표로 끝나며, 상한 안의 이름은 그대로다', async () => {
        const long = `${'가'.repeat(WATCHLIST_TOOL_NAME_MAX_CHARS)}😀`;
        const exact = 'A'.repeat(WATCHLIST_TOOL_NAME_MAX_CHARS);
        findByUser.mockResolvedValue([
            row('LONG', long, 2),
            row('EXACT', exact, 1),
        ]);

        const result = await loadMyWatchlist('u1');
        const nameOf = (symbol: string) =>
            result.items.find(item => item.symbol === symbol)?.name ?? '';

        expect(Array.from(nameOf('LONG'))).toHaveLength(
            WATCHLIST_TOOL_NAME_MAX_CHARS
        );
        expect(nameOf('LONG')).toBe(
            `${'가'.repeat(WATCHLIST_TOOL_NAME_MAX_CHARS - 1)}…`
        );
        expect(nameOf('EXACT')).toBe(exact);
    });

    it('최악 모양(종목 상한 50 × 9자 코드·긴 이름·낡은 시세 상세 5건, 알림 상한 10건)이 결과 상한 안에 든다', async () => {
        launched.on = true;
        // 한 칸이 가장 길어지는 쪽만 모았다: 9자 코드(`005930.KS` 모양), 이름 상한을 넘는 이름(잘려서 상한 길이로 실린다),
        // 네 자리 가격(소수 둘)과 두 자리 등락률.
        const rows = Array.from({ length: WATCHLIST_MAX_MEMBER }, (_, i) =>
            row(
                `${String(100_000 + i)}.KS`.slice(-9),
                'N'.repeat(WATCHLIST_TOOL_NAME_MAX_CHARS * 3),
                1 + (i % 28)
            )
        );
        findByUser.mockResolvedValue(rows);
        const staleSymbols = new Set(rows.slice(0, 5).map(r => r.symbol));
        const nowSec = Math.floor(Date.now() / 1000);
        getQuote.mockImplementation(async (symbol: string) => ({
            price: 1234.56,
            changesPercentage: -12.34,
            timestamp: staleSymbols.has(symbol)
                ? nowSec - 400 * 86_400
                : nowSec,
        }));
        listForSubscriber.mockResolvedValue(
            Array.from({ length: 10 }, (_, i) => ({
                symbol: rows[i]?.symbol,
                market: 'kr',
                status: 'active',
                basis: 'analysis_entry_zone',
                expiresOn: '2999-01-01',
                condition: {
                    kind: 'enter_zone',
                    low: 1234.56,
                    high: 1299.99,
                    approach: 'from_above',
                },
            }))
        );

        const result = await loadMyWatchlist('u1');
        const size = JSON.stringify(result).length;

        expect(result.items).toHaveLength(WATCHLIST_MAX_MEMBER);
        expect(result.stalePriceCount).toBe(5);
        expect(
            result.items.filter(item => item.priceFreshness !== undefined)
        ).toHaveLength(5);
        expect(result.priceAlerts).toHaveLength(10);
        // 측정값은 상한에 닿을 만큼 크되 넘지 않는다.
        expect(size).toBeGreaterThan(WATCHLIST_RESULT_MAX_CHARS - 700);
        expect(size).toBeLessThanOrEqual(WATCHLIST_RESULT_MAX_CHARS);
    });
});
