import { fakes, world } from '../boundary';
import {
    CLOCKS,
    listCrypto,
    listIndexLike,
    listKrStock,
    listSecondUsStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '../goldenCase';

/** `search_ticker`·`get_quote` — 종목 해석과 시세. */
const searchResult = (
    symbol: string,
    name: string,
    exchange: string,
    extra: Record<string, unknown> = {}
) => ({ symbol, name, exchange, ...extra });

const SEARCH_ROWS = [
    searchResult(SYMBOLS.us, 'Goldenrod Systems Inc.', 'NASDAQ', {
        koreanName: '골든로드 시스템즈',
    }),
    searchResult('GLDN.W', 'Goldenrod Systems Warrants', 'NASDAQ'),
    searchResult(SYMBOLS.kr, 'Hanbit Precision', 'KSC', {
        koreanName: '한빛정밀',
        marketProfile: 'kr-equity',
    }),
    searchResult(SYMBOLS.crypto, 'Zeta Coin USD', 'CRYPTO', {
        koreanName: '제타코인',
        marketProfile: 'crypto',
    }),
    ...Array.from({ length: 8 }, (_, i) =>
        searchResult(
            `GLD${String.fromCharCode(65 + i)}Q`,
            `Golden Peer ${i + 1} Corp`,
            'NYSE'
        )
    ),
];

export const searchTickerCases: GoldenCase[] = [
    {
        tool: 'search_ticker',
        name: 'mixed-markets-capped-at-eight',
        now: CLOCKS.usOpen,
        args: { query: 'golden' },
        arrange: () => {
            fakes.searchTicker.mockResolvedValue(SEARCH_ROWS);
        },
    },
    {
        tool: 'search_ticker',
        name: 'no-match-retry-hint',
        now: CLOCKS.weekend,
        args: { query: '골든로드' },
    },
    {
        tool: 'search_ticker',
        name: 'korean-name-single-hit',
        now: CLOCKS.krSession,
        args: { query: '한빛정밀' },
        locale: 'en',
        arrange: () => {
            fakes.searchTicker.mockResolvedValue([SEARCH_ROWS[2]]);
        },
    },
];

export const quoteCases: GoldenCase[] = [
    {
        tool: 'get_quote',
        name: 'us-open-three-symbols-with-index-mapping',
        now: CLOCKS.usOpen,
        args: { symbols: [SYMBOLS.us, SYMBOLS.us2, SYMBOLS.index, 'NOPEQ'] },
        arrange: () => {
            listUsStock();
            listSecondUsStock();
            listIndexLike();
        },
    },
    {
        tool: 'get_quote',
        name: 'us-closed-unknown-and-failing-symbol',
        now: CLOCKS.usClosed,
        args: { symbols: [SYMBOLS.us, 'NOPEQ', SYMBOLS.us2] },
        arrange: () => {
            listUsStock();
            listSecondUsStock();
            world.failing.add(SYMBOLS.us2);
        },
    },
    {
        tool: 'get_quote',
        name: 'weekend-last-close-quote',
        now: CLOCKS.weekend,
        args: { symbols: [SYMBOLS.us] },
        arrange: listUsStock,
    },
    {
        tool: 'get_quote',
        name: 'kr-session-suffix-corrected',
        now: CLOCKS.krSession,
        args: { symbols: ['900110.KQ'] },
        arrange: () => {
            listKrStock();
            world.krSuffix['900110.KQ'] = SYMBOLS.kr;
        },
    },
    {
        tool: 'get_quote',
        name: 'kr-stale-listing',
        now: CLOCKS.krSession,
        args: { symbols: [SYMBOLS.kr] },
        arrange: () => listKrStock({ lastDate: '2026-09-30' }),
    },
    {
        tool: 'get_quote',
        name: 'crypto-sunday',
        now: CLOCKS.crypto,
        args: { symbols: [SYMBOLS.crypto] },
        caller: 'guest',
        arrange: listCrypto,
    },
];
