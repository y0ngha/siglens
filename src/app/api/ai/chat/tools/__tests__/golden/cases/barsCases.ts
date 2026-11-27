import { fakes, world } from '../boundary';
import {
    CLOCKS,
    listCrypto,
    listIndexLike,
    listKrStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '../goldenCase';

/**
 * `get_bars_indicators` — 실제 core 지표·신호·공포탐욕 계산이 합성 일봉(5년, 약 1,250봉)과 분봉 위에서 돈다.
 * 차트 블록(`onChart`)도 고정한다.
 */
export const barsCases: GoldenCase[] = [
    {
        tool: 'get_bars_indicators',
        name: 'us-open-1day-forming-default-30',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, timeframe: '1Day' },
        arrange: () => {
            listUsStock();
            fakes.listEarningsDates.mockResolvedValue([
                '2026-10-29',
                '2026-07-30',
            ]);
        },
    },
    {
        tool: 'get_bars_indicators',
        name: 'us-closed-1day-200-bars-truncation',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us, timeframe: '1Day', bars: 200 },
        arrange: listUsStock,
    },
    {
        tool: 'get_bars_indicators',
        name: 'us-dst-1hour-with-4hour-htf',
        now: CLOCKS.usDst,
        args: { symbol: SYMBOLS.us, timeframe: '1Hour', bars: 24 },
        arrange: listUsStock,
    },
    {
        tool: 'get_bars_indicators',
        name: 'weekend-1week',
        now: CLOCKS.weekend,
        args: { symbol: SYMBOLS.us, timeframe: '1Week', bars: 12 },
        arrange: listUsStock,
    },
    {
        tool: 'get_bars_indicators',
        name: 'kr-session-1month-suffix-corrected',
        now: CLOCKS.krSession,
        args: { symbol: '900110.KQ', timeframe: '1Month', bars: 6 },
        locale: 'ja',
        arrange: () => {
            listKrStock();
            world.krSuffix['900110.KQ'] = SYMBOLS.kr;
        },
    },
    {
        tool: 'get_bars_indicators',
        name: 'crypto-1day-sunday',
        now: CLOCKS.crypto,
        args: { symbol: SYMBOLS.crypto, timeframe: '1Day', bars: 10 },
        caller: 'guest',
        arrange: listCrypto,
    },
    {
        tool: 'get_bars_indicators',
        name: 'kr-stale-listing',
        now: CLOCKS.krSession,
        args: { symbol: SYMBOLS.kr, timeframe: '1Day' },
        arrange: () => listKrStock({ lastDate: '2026-09-30' }),
    },
    {
        tool: 'get_bars_indicators',
        name: 'index-like-resolved-symbol-15min',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.index, timeframe: '15Min', bars: 8 },
        arrange: listIndexLike,
    },
    {
        tool: 'get_bars_indicators',
        name: 'unknown-symbol-not-found',
        now: CLOCKS.usOpen,
        args: { symbol: 'NOPEQ', timeframe: '1Day' },
    },
];
