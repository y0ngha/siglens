import { PRICE_ALERT_MAX_ACTIVE } from '@/entities/mail-alert/lib/priceAlertConstants';
import {
    fakes,
    listAsset,
    repos,
    world,
} from '@/features/agent-tools/server/__tests__/golden/boundary';
import {
    PORTFOLIO_ROWS,
    storedTechnicalAnalysis,
} from '@/features/agent-tools/server/__tests__/golden/fixtures';
import {
    CALLERS,
    CLOCKS,
    listCrypto,
    listKrStock,
    listSecondKrStock,
    listSecondUsStock,
    listThirdUsStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '@/features/agent-tools/server/__tests__/golden/goldenCase';
import { WATCHLIST_MAX_MEMBER } from '@/shared/config/watchlist';
import { addUtcIsoDays } from '@/shared/lib/isoDate';

/** 회원 계정 도구 — 보유 종목, 관심종목(가격대 알림 포함), 가격대 알림 제안. */

function listPortfolioUniverse(): void {
    listUsStock();
    listSecondUsStock();
    listThirdUsStock();
    listKrStock();
    listSecondKrStock();
}

export const portfolioCases: GoldenCase[] = [
    {
        tool: 'get_my_portfolio',
        name: 'mixed-currency-us-open',
        now: CLOCKS.usOpen,
        args: {},
        arrange: () => {
            listPortfolioUniverse();
            repos.portfolio.methods.findByUser.mockResolvedValue(
                PORTFOLIO_ROWS
            );
        },
    },
    {
        tool: 'get_my_portfolio',
        name: 'quote-failure-nulls-totals',
        now: CLOCKS.krSession,
        args: { userId: CALLERS.pro.userId },
        arrange: () => {
            listPortfolioUniverse();
            world.failing.add(SYMBOLS.kr2);
            repos.portfolio.methods.findByUser.mockResolvedValue(
                PORTFOLIO_ROWS
            );
        },
    },
    {
        tool: 'get_my_portfolio',
        name: 'empty-portfolio-weekend',
        now: CLOCKS.weekend,
        args: {},
    },
    {
        tool: 'get_my_portfolio',
        name: 'guest-login-required',
        now: CLOCKS.weekend,
        caller: 'guest',
        args: {},
    },
];

const watchRow = (symbol: string, companyName: string | null, day: number) => ({
    id: `00000000-0000-4000-8000-0000000002${String(day).padStart(2, '0')}`,
    userId: CALLERS.member.userId,
    symbol,
    companyName,
    createdAt: new Date(Date.UTC(2026, 9, day, 3, 14)),
});

const WATCH_ROWS = [
    watchRow(SYMBOLS.us, 'Goldenrod Systems Inc.', 2),
    watchRow(SYMBOLS.kr, '한빛정밀', 19),
    watchRow(SYMBOLS.crypto, 'Zeta Coin USD', 7),
    watchRow(
        SYMBOLS.us3,
        'Velmora Therapeutics — a clinical-stage company with a very long registered display name',
        11
    ),
    watchRow('NOPEQ', null, 23),
    watchRow(SYMBOLS.us2, 'Quartzline Holdings', 28),
];

const alertRow = (
    i: number,
    symbol: string,
    market: 'us' | 'kr',
    condition: Record<string, unknown>,
    over: Record<string, unknown> = {}
) => ({
    id: `00000000-0000-4000-8000-0000000003${String(i).padStart(2, '0')}`,
    subscriberId: '00000000-0000-4000-8000-00000000fe01',
    proposalId: `00000000-0000-4000-8000-0000000004${String(i).padStart(2, '0')}`,
    symbol,
    market,
    condition,
    basis: i % 2 === 0 ? 'price_level' : 'analysis_entry_zone',
    analysisAt: null,
    referenceClose: 240.17,
    startsAfterSession: '2026-11-10',
    expiresOn: addUtcIsoDays('2026-12-10', i),
    status: 'active',
    firedSession: null,
    firedClose: null,
    firedAt: null,
    createdAt: new Date(Date.UTC(2026, 10, 10, 1, i)),
    ...over,
});

export const watchlistCases: GoldenCase[] = [
    {
        tool: 'get_my_watchlist',
        name: 'mixed-markets-with-active-alerts',
        now: CLOCKS.usOpen,
        args: {},
        arrange: () => {
            listPortfolioUniverse();
            listCrypto();
            repos.watchlist.methods.findByUser.mockResolvedValue(WATCH_ROWS);
            repos.priceAlert.methods.listForSubscriber.mockResolvedValue([
                alertRow(0, SYMBOLS.us, 'us', {
                    kind: 'close_below',
                    level: 228.5,
                }),
                alertRow(1, SYMBOLS.kr, 'kr', {
                    kind: 'enter_zone',
                    approach: 'from_above',
                    low: 112_000,
                    high: 115_500,
                }),
                alertRow(2, SYMBOLS.us2, 'us', {
                    kind: 'close_above',
                    level: 171.25,
                }),
                alertRow(
                    3,
                    SYMBOLS.us,
                    'us',
                    { kind: 'close_above', level: 260 },
                    { status: 'fired' }
                ),
                alertRow(
                    4,
                    SYMBOLS.us3,
                    'us',
                    { kind: 'close_below', level: 9.5 },
                    { expiresOn: '2026-11-02' }
                ),
            ]);
        },
    },
    {
        tool: 'get_my_watchlist',
        name: 'weekend-stale-crypto-and-alert-read-failure',
        now: CLOCKS.weekend,
        args: {},
        arrange: () => {
            listPortfolioUniverse();
            listCrypto({ lastDate: '2026-10-20' });
            repos.watchlist.methods.findByUser.mockResolvedValue(WATCH_ROWS);
            repos.priceAlert.methods.listForSubscriber.mockRejectedValue(
                Object.assign(new Error('timeout: secret'), {
                    name: 'DrizzleQueryError',
                })
            );
        },
    },
    {
        tool: 'get_my_watchlist',
        name: 'alerts-not-launched-one-quote-failing',
        now: CLOCKS.krSession,
        args: {},
        arrange: () => {
            listPortfolioUniverse();
            world.priceAlertLaunched = false;
            world.failing.add(SYMBOLS.kr);
            repos.watchlist.methods.findByUser.mockResolvedValue(
                WATCH_ROWS.slice(0, 2)
            );
        },
    },
    {
        tool: 'get_my_watchlist',
        name: 'guest-login-required',
        now: CLOCKS.usOpen,
        caller: 'guest',
        args: {},
    },
    {
        tool: 'get_my_watchlist',
        name: 'empty-list',
        now: CLOCKS.usClosed,
        args: {},
    },
];

/** `analysis_*` 기준: 회원 일봉 technical 캐시 적중(저장된 실제 분석). */
function arrangeTechnicalHit(): void {
    fakes.peekAnalysisCache.mockResolvedValue({
        result: storedTechnicalAnalysis(0, '2026-11-17T21:40:00.000Z'),
        lockedInfoDepth: [],
    });
}

export const priceAlertCases: GoldenCase[] = [
    {
        tool: 'propose_price_alert',
        name: 'price-below-member-us-open',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, basis: 'price_below', price: 229.5 },
        arrange: listUsStock,
    },
    {
        tool: 'propose_price_alert',
        name: 'analysis-entry-zone-from-cached-technical',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us, basis: 'analysis_entry_zone' },
        arrange: () => {
            listUsStock();
            arrangeTechnicalHit();
        },
    },
    {
        tool: 'propose_price_alert',
        name: 'analysis-invalidation-kr-guest',
        now: CLOCKS.krSession,
        caller: 'guest',
        locale: 'en',
        args: { symbol: SYMBOLS.kr, basis: 'analysis_invalidation' },
        arrange: () => {
            listKrStock();
            fakes.peekAnalysisCache.mockResolvedValue({
                result: {
                    ...storedTechnicalAnalysis(1, '2026-11-18T07:10:00.000Z'),
                    actionRecommendation: {
                        positionAnalysis:
                            '보유자는 지지선 이탈 여부를 확인하세요.',
                        entry: '분할 매수',
                        exit: '저항 부근 일부 차익',
                        riskReward: '1:2',
                        entryPrices: [116_500, 118_000],
                        stopLoss: 109_800,
                        takeProfitPrices: [131_000],
                    },
                },
                lockedInfoDepth: [],
            });
        },
    },
    {
        tool: 'propose_price_alert',
        name: 'member-at-active-limit',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, basis: 'price_above', price: 268 },
        arrange: () => {
            listUsStock();
            repos.priceAlert.methods.listForSubscriber.mockResolvedValue(
                Array.from({ length: PRICE_ALERT_MAX_ACTIVE }, (_, i) =>
                    alertRow(i, SYMBOLS.us2, 'us', {
                        kind: 'close_above',
                        level: 170 + i,
                    })
                )
            );
        },
    },
    {
        tool: 'propose_price_alert',
        name: 'same-alert-exists',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, basis: 'price_below', price: 229.5 },
        arrange: () => {
            listUsStock();
            repos.priceAlert.methods.listForSubscriber.mockResolvedValue([
                alertRow(0, SYMBOLS.us, 'us', {
                    kind: 'close_below',
                    level: 229.5,
                }),
            ]);
        },
    },
    {
        tool: 'propose_price_alert',
        name: 'out-of-range-price',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, basis: 'price_above', price: 990 },
        arrange: listUsStock,
    },
    {
        tool: 'propose_price_alert',
        name: 'crypto-unsupported',
        now: CLOCKS.crypto,
        args: { symbol: SYMBOLS.crypto, basis: 'price_below', price: 90_000 },
        arrange: listCrypto,
    },
    {
        tool: 'propose_price_alert',
        name: 'no-cached-analysis',
        now: CLOCKS.weekend,
        args: { symbol: SYMBOLS.us, basis: 'analysis_entry_zone' },
        arrange: listUsStock,
    },
];

/**
 * 9자 한국 종목 코드 `n`개를 합성 시장에 올린다 — `isStale`인 종목은 한 달 전에 거래가 멈췄다(시세가 낡았다).
 * 가격은 네 자리(원)라 결과 크기가 도구 상한 주석의 최악 모양과 같다.
 */
function listKrBasket(
    prefix: '9101' | '9102',
    n: number,
    isStale: (i: number) => boolean
): string[] {
    return Array.from({ length: n }, (_, i) => {
        const symbol = `${prefix}${String(i).padStart(2, '0')}.KS`;
        listAsset(
            {
                symbol,
                name: `Basket Member ${i + 1} Industrial Holdings`,
                koreanName: `바스켓종목${i + 1}`,
                marketProfile: 'kr-equity',
            },
            {
                base: 3_100 + i * 97,
                drift: 0.0002,
                seed: 500 + i,
                volume: 410_000,
                decimals: 0,
                ...(isStale(i)
                    ? { lastDate: addUtcIsoDays('2026-10-20', -i) }
                    : {}),
            }
        );
        return symbol;
    });
}

const LONG_NAME_TAIL =
    ' — a holding company with a very long registered display name that runs past the tool cap';

export const watchlistMaxCases: GoldenCase[] = [
    {
        tool: 'get_my_watchlist',
        name: 'fifty-members-ten-alerts-full-size',
        now: CLOCKS.krSession,
        args: {},
        arrange: () => {
            const symbols = listKrBasket(
                '9101',
                WATCHLIST_MAX_MEMBER,
                i => i % 6 === 0
            );
            repos.watchlist.methods.findByUser.mockResolvedValue(
                symbols.map((symbol, i) => ({
                    id: `00000000-0000-4000-8000-0000000051${String(i).padStart(2, '0')}`,
                    userId: CALLERS.member.userId,
                    symbol,
                    companyName: `바스켓종목${i + 1}${LONG_NAME_TAIL}`,
                    createdAt: new Date(Date.UTC(2026, 8, 1 + i, 2, 30)),
                }))
            );
            repos.priceAlert.methods.listForSubscriber.mockResolvedValue(
                symbols.slice(0, PRICE_ALERT_MAX_ACTIVE).map((symbol, i) =>
                    alertRow(
                        i,
                        symbol,
                        'kr',
                        i % 2 === 0
                            ? { kind: 'close_below', level: 2_950 + i * 90 }
                            : {
                                  kind: 'enter_zone',
                                  approach: 'from_above',
                                  low: 3_000 + i * 80,
                                  high: 3_150 + i * 80,
                              }
                    )
                )
            );
        },
    },
];

export const portfolioMaxCases: GoldenCase[] = [
    {
        tool: 'get_my_portfolio',
        name: 'twenty-holdings-mostly-stale-truncation',
        now: CLOCKS.krSession,
        args: {},
        arrange: () => {
            // 셋에 하나만 시세가 살아 있다(나머지는 한 달 넘게 거래가 멈췄다).
            const symbols = listKrBasket('9102', 20, i => i % 3 !== 1);
            repos.portfolio.methods.findByUser.mockResolvedValue(
                symbols.map((symbol, i) => ({
                    id: `00000000-0000-4000-8000-0000000052${String(i).padStart(2, '0')}`,
                    userId: CALLERS.member.userId,
                    symbol,
                    companyName: `바스켓종목${i + 1}`,
                    fmpSymbol: null,
                    quantity: String(100 + i * 35),
                    averagePrice: String(3_050.5 + i * 101.25),
                    createdAt: new Date(Date.UTC(2026, 2, 1 + i)),
                    updatedAt: new Date(Date.UTC(2026, 9, 1 + i)),
                }))
            );
        },
    },
];
