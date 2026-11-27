import { fakes } from '@/features/agent-tools/server/__tests__/golden/boundary';
import {
    analystViews,
    companyFilings,
    congressTrades,
    filingBody,
    guideCatalog,
    macroDaily,
    macroQuote,
    optionsSnapshot,
    xAccounts,
    xPosts,
} from '@/features/agent-tools/server/__tests__/golden/fixtures';
import {
    CLOCKS,
    listCrypto,
    listKrStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '@/features/agent-tools/server/__tests__/golden/goldenCase';

/** 외부 출처 하나를 투영하는 도구들 — 의회 거래, X, 매크로 시세, 공시, 가이드, 애널리스트, 옵션. */

export const congressCases: GoldenCase[] = [
    {
        tool: 'get_congress_trades',
        name: 'us-twenty-two-trades-capped',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            listUsStock();
            fakes.getCongressTradesResilient.mockResolvedValue({
                trades: congressTrades(22),
                degraded: false,
            });
        },
    },
    {
        tool: 'get_congress_trades',
        name: 'kr-tab-not-available',
        now: CLOCKS.krSession,
        args: { symbol: SYMBOLS.kr },
        arrange: () => listKrStock(),
    },
    {
        tool: 'get_congress_trades',
        name: 'provider-degraded',
        now: CLOCKS.weekend,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            listUsStock();
            fakes.getCongressTradesResilient.mockResolvedValue({
                trades: [],
                degraded: true,
            });
        },
    },
    {
        tool: 'get_congress_trades',
        name: 'zero-trades-available',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us },
        arrange: listUsStock,
    },
];

export const xPostsCases: GoldenCase[] = [
    {
        tool: 'get_x_posts',
        name: 'twelve-long-posts-full-size',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            fakes.getXPosts.mockResolvedValue({
                status: 'ok',
                asOf: '2026-11-18T15:12:00.000Z',
                accounts: xAccounts(),
                posts: xPosts(12, 600),
            });
        },
    },
    {
        tool: 'get_x_posts',
        name: 'guest-short-posts',
        now: CLOCKS.weekend,
        caller: 'guest',
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            fakes.getXPosts.mockResolvedValue({
                status: 'ok',
                asOf: '2026-11-21T15:40:00.000Z',
                accounts: xAccounts(),
                posts: xPosts(4, 140),
            });
        },
    },
    {
        tool: 'get_x_posts',
        name: 'global-day-quota',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            fakes.getXPosts.mockResolvedValue({ status: 'quota' });
        },
    },
    {
        tool: 'get_x_posts',
        name: 'no-known-account',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us3 },
    },
];

const MACRO_SYMBOLS: Record<
    string,
    {
        name: string;
        price: number;
        currency: string;
        type: string;
        expiry: string | null;
        base: number;
    }
> = {
    'CL=F': {
        name: 'Crude Oil Jan 27',
        price: 71.84,
        currency: 'USD',
        type: 'FUTURE',
        expiry: '2026-12-21',
        base: 74,
    },
    'BZ=F': {
        name: 'Brent Crude Oil Last Day Financ',
        price: 75.62,
        currency: 'USD',
        type: 'FUTURE',
        expiry: '2026-12-30',
        base: 78,
    },
    'GC=F': {
        name: 'Gold Dec 26',
        price: 2_712.3,
        currency: 'USD',
        type: 'FUTURE',
        expiry: '2026-12-29',
        base: 2_480,
    },
    'SI=F': {
        name: 'Silver Dec 26',
        price: 31.245,
        currency: 'USD',
        type: 'FUTURE',
        expiry: '2026-12-29',
        base: 29,
    },
    'HG=F': {
        name: 'Copper Mar 27',
        price: 4.4185,
        currency: 'USD',
        type: 'FUTURE',
        expiry: '2027-03-29',
        base: 4.2,
    },
    'NG=F': {
        name: 'Natural Gas Jan 27',
        price: 3.512,
        currency: 'USD',
        type: 'FUTURE',
        expiry: '2026-12-29',
        base: 2.9,
    },
    'ES=F': {
        name: 'E-Mini S&P 500 Dec 26',
        price: 6_942.25,
        currency: 'USD',
        type: 'FUTURE',
        expiry: '2026-12-18',
        base: 6_400,
    },
    'KRW=X': {
        name: 'USD/KRW',
        price: 1_398.420044,
        currency: 'KRW',
        type: 'CURRENCY',
        expiry: null,
        base: 1_380,
    },
    'DX-Y.NYB': {
        name: 'US Dollar Index',
        price: 104.187,
        currency: 'USD',
        type: 'INDEX',
        expiry: null,
        base: 103,
    },
};

function arrangeMacro(failingDaily: readonly string[] = []): void {
    fakes.getYahooMacroQuotes.mockImplementation(
        async (symbols: readonly string[]) =>
            new Map(
                symbols.map(symbol => {
                    const spec = MACRO_SYMBOLS[symbol];
                    return [
                        symbol,
                        spec === undefined
                            ? null
                            : macroQuote({
                                  name: spec.name,
                                  price: spec.price,
                                  changePct: Number(
                                      (
                                          (spec.price / spec.base - 1) *
                                          3.1
                                      ).toFixed(6)
                                  ),
                                  currency: spec.currency,
                                  quoteType: spec.type,
                                  contractExpiryIso:
                                      spec.expiry === null
                                          ? null
                                          : `${spec.expiry}T00:00:00.000Z`,
                                  delayMinutes: spec.type === 'FUTURE' ? 10 : 0,
                              }),
                    ] as const;
                })
            )
    );
    fakes.getYahooMacroDailyCloses.mockImplementation(
        async (symbol: string) => {
            const spec = MACRO_SYMBOLS[symbol];
            if (failingDaily.includes(symbol))
                throw new Error('yahoo chart 429');
            return spec === undefined
                ? null
                : {
                      timeZone: 'America/New_York',
                      rows: macroDaily('2026-11-17', spec.base, symbol.length),
                  };
        }
    );
}

export const macroQuotesCases: GoldenCase[] = [
    {
        tool: 'get_macro_quotes',
        name: 'eight-instruments-full-size',
        now: CLOCKS.usOpen,
        args: {
            instruments: [
                'wti',
                'brent',
                'gold',
                'silver',
                'copper',
                'natural_gas',
                'sp500_futures',
                'usd_krw',
            ],
        },
        arrange: () => arrangeMacro(),
    },
    {
        tool: 'get_macro_quotes',
        name: 'missing-quote-and-daily-failure',
        now: CLOCKS.weekend,
        args: { instruments: ['gold', 'dollar_index', 'eur_usd', 'gold'] },
        arrange: () => arrangeMacro(['DX-Y.NYB']),
    },
    {
        tool: 'get_macro_quotes',
        name: 'too-many-instruments',
        now: CLOCKS.usOpen,
        args: {
            instruments: [
                'wti',
                'brent',
                'gold',
                'silver',
                'copper',
                'natural_gas',
                'sp500_futures',
                'usd_krw',
                'usd_jpy',
            ],
        },
    },
    {
        tool: 'get_macro_quotes',
        name: 'no-valid-instruments',
        now: CLOCKS.usOpen,
        args: { instruments: ['bitcoin'] },
    },
];

const FILINGS = companyFilings(10);

export const companyFilingsCases: GoldenCase[] = [
    {
        tool: 'get_company_filings',
        name: 'list-ten-recent',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            fakes.listCompanyFilings.mockResolvedValue({
                status: 'ok',
                filings: FILINGS,
            });
        },
    },
    {
        tool: 'get_company_filings',
        name: 'read-long-press-release-truncation',
        now: CLOCKS.usClosed,
        args: {
            symbol: SYMBOLS.us,
            accession: ` ${FILINGS[0]?.accession.replaceAll('-', '')} `,
        },
        arrange: () => {
            fakes.readCompanyFiling.mockImplementation(
                async (_symbol: string, accession: string) =>
                    accession === FILINGS[0]?.accession &&
                    FILINGS[0] !== undefined
                        ? { status: 'ok', filing: filingBody(FILINGS[0], 34) }
                        : { status: 'unknown_filing' }
            );
        },
    },
    {
        tool: 'get_company_filings',
        name: 'unknown-accession',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, accession: 'not-an-accession' },
    },
    {
        tool: 'get_company_filings',
        name: 'no-sec-filer',
        now: CLOCKS.krSession,
        args: { symbol: SYMBOLS.kr },
    },
];

export const guideCases: GoldenCase[] = [
    {
        tool: 'get_guide',
        name: 'alias-match-long-body-cut',
        now: CLOCKS.usOpen,
        args: { query: '상대강도지수' },
        arrange: () => fakes.loadGuideCatalog.mockResolvedValue(guideCatalog()),
    },
    {
        tool: 'get_guide',
        name: 'howto-suffix-fallback-en',
        now: CLOCKS.weekend,
        locale: 'en',
        args: { query: 'how to read stochastic' },
        arrange: () => fakes.loadGuideCatalog.mockResolvedValue(guideCatalog()),
    },
    {
        tool: 'get_guide',
        name: 'no-match',
        now: CLOCKS.weekend,
        args: { query: '피보나치 되돌림' },
        arrange: () => fakes.loadGuideCatalog.mockResolvedValue(guideCatalog()),
    },
    {
        tool: 'get_guide',
        name: 'catalog-unavailable',
        now: CLOCKS.weekend,
        args: { query: 'RSI' },
    },
];

export const analystViewsCases: GoldenCase[] = [
    {
        tool: 'get_analyst_views',
        name: 'us-forty-actions-truncation',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            listUsStock();
            fakes.getAnalystViews.mockResolvedValue(
                analystViews(SYMBOLS.us, 40)
            );
        },
    },
    {
        tool: 'get_analyst_views',
        name: 'kr-yahoo-only-quote-failed',
        now: CLOCKS.krSession,
        args: { symbol: SYMBOLS.kr },
        arrange: () => {
            listKrStock();
            fakes.getCachedMarketDataProvider.mockImplementation(() => ({
                getBars: async () => [],
                getQuote: async () => {
                    throw new Error('yahoo quote timeout');
                },
            }));
            fakes.getAnalystViews.mockResolvedValue(
                analystViews(SYMBOLS.kr, 0, {
                    targets: {
                        yahoo: {
                            mean: 131_250,
                            median: 130_000,
                            low: 98_000,
                            high: 160_000,
                            analysts: 17,
                        },
                        fmp: null,
                        gapPct: null,
                        sourcesDisagree: false,
                    },
                    ratings: null,
                    actions: { available: false, rows: [], tally: null },
                    estimates: null,
                    degraded: ['fmp'],
                })
            );
        },
    },
    {
        tool: 'get_analyst_views',
        name: 'crypto-not-a-stock',
        now: CLOCKS.crypto,
        args: { symbol: SYMBOLS.crypto },
        arrange: listCrypto,
    },
    {
        tool: 'get_analyst_views',
        name: 'empty-sources-provider-failed',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            listUsStock();
            fakes.getAnalystViews.mockResolvedValue(
                analystViews(SYMBOLS.us, 0, {
                    targets: {
                        yahoo: null,
                        fmp: null,
                        gapPct: null,
                        sourcesDisagree: false,
                    },
                    ratings: null,
                    actions: { available: false, rows: [], tally: null },
                    estimates: null,
                    degraded: ['yahoo'],
                })
            );
        },
    },
];

export const OPTION_EXPIRIES = [
    { date: '2026-11-18', days: 0 },
    { date: '2026-11-20', days: 2 },
    { date: '2026-11-27', days: 9 },
    { date: '2026-12-18', days: 30 },
    { date: '2027-01-15', days: 58 },
];

export const optionsCases: GoldenCase[] = [
    {
        tool: 'get_options_summary',
        name: 'us-chain-skips-same-day-expiry',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            listUsStock();
            fakes.hasOptionsMarket.mockResolvedValue(true);
            fakes.fetchOptionsSnapshot.mockResolvedValue(
                optionsSnapshot(
                    SYMBOLS.us,
                    244.85,
                    '2026-11-18T15:25:00.000Z',
                    OPTION_EXPIRIES
                )
            );
        },
    },
    {
        tool: 'get_options_summary',
        name: 'kr-tab-not-available',
        now: CLOCKS.krSession,
        args: { symbol: SYMBOLS.kr },
        arrange: () => listKrStock(),
    },
    {
        tool: 'get_options_summary',
        name: 'no-options-market',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us3 },
    },
    {
        tool: 'get_options_summary',
        name: 'no-snapshot',
        now: CLOCKS.weekend,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            fakes.hasOptionsMarket.mockResolvedValue(true);
        },
    },
];
