import { findAgentTheme } from '@y0ngha/siglens-core';
import { INDEX_SOURCES } from '@/entities/index-history/lib/indexSources';
import { fakes, listAsset, world } from '../boundary';
import { monthEnds } from '../fixtures';
import {
    CLOCKS,
    listCrypto,
    listKrStock,
    listSecondUsStock,
    listThirdUsStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '../goldenCase';

/** 지수·스윙·가격 통계·테마 — 긴 일봉/월말 이력을 읽는 도구들. */

/** `INDEX_SOURCES`의 공급자 심볼로 지수 일봉을 합성 시장에 올린다(`get_price_stats`의 `index` 인자). */
function listIndexSeries(
    index: keyof typeof INDEX_SOURCES,
    base: number
): void {
    const source = INDEX_SOURCES[index];
    world.series[source.symbol] = {
        base,
        drift: 0.0003,
        seed: 97,
        volume: 0,
        decimals: 2,
    };
}

function arrangeMonthEnds(
    usCycle: boolean,
    firstMonth: string,
    base: number
): void {
    fakes.loadIndexMonthEnds.mockImplementation(async () => ({
        monthEnds: monthEnds(firstMonth, '2026-11', base, 3),
        currentMonth: '2026-11',
        usCycle,
    }));
}

export const indexHistoryCases: GoldenCase[] = [
    {
        tool: 'get_index_history_stats',
        name: 'sp500-full-table-since-1950',
        now: CLOCKS.usClosed,
        args: { index: 'sp500' },
        arrange: () =>
            arrangeMonthEnds(true, INDEX_SOURCES.sp500.firstMonth, 17.05),
    },
    {
        tool: 'get_index_history_stats',
        name: 'kospi-no-us-cycle',
        now: CLOCKS.krSession,
        args: { index: 'kospi' },
        arrange: () =>
            arrangeMonthEnds(false, INDEX_SOURCES.kospi.firstMonth, 376.31),
    },
    {
        tool: 'get_index_history_stats',
        name: 'load-failure-provider-failed',
        now: CLOCKS.weekend,
        args: { index: 'nasdaq' },
        arrange: () => {
            fakes.loadIndexMonthEnds.mockRejectedValue(
                Object.assign(new Error('fmp 503'), { name: 'FmpHttpError' })
            );
        },
    },
    {
        tool: 'get_index_history_stats',
        name: 'unknown-index-invalid-args',
        now: CLOCKS.weekend,
        args: { index: 'dow' },
    },
];

export const swingHistoryCases: GoldenCase[] = [
    {
        tool: 'get_swing_history',
        name: 'us-default-ten-percent-full-history',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us },
        arrange: listUsStock,
    },
    {
        tool: 'get_swing_history',
        name: 'kr-session-fifteen-percent-three-years',
        now: CLOCKS.krSession,
        args: { symbol: SYMBOLS.kr, minSwingPct: 15, lookbackYears: 3 },
        arrange: () => listKrStock(),
    },
    {
        tool: 'get_swing_history',
        name: 'max-episodes-full-size',
        now: CLOCKS.weekend,
        args: { symbol: SYMBOLS.us2, minSwingPct: 3 },
        arrange: listSecondUsStock,
    },
    {
        tool: 'get_swing_history',
        name: 'invalid-min-swing',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, minSwingPct: 2 },
    },
    {
        tool: 'get_swing_history',
        name: 'asset-lookup-failed-unknown-history',
        now: CLOCKS.usOpen,
        args: { symbol: 'NOPEQ' },
        arrange: () => {
            world.failingAssets.add('NOPEQ');
        },
    },
];

export const priceStatsCases: GoldenCase[] = [
    {
        tool: 'get_price_stats',
        name: 'us-one-year-default-window',
        now: CLOCKS.usOpen,
        args: { symbols: [SYMBOLS.us] },
        arrange: listUsStock,
    },
    {
        tool: 'get_price_stats',
        name: 'three-subjects-five-dates-full-size',
        now: CLOCKS.usClosed,
        args: {
            symbols: [SYMBOLS.us, SYMBOLS.us3],
            index: 'sp500',
            period: '3y',
            dates: [
                '2024-08-05',
                '2025-04-08',
                '2025-12-24',
                '2026-03-15',
                '2026-11-18',
            ],
        },
        arrange: () => {
            listUsStock();
            listThirdUsStock();
            listIndexSeries('sp500', 3_230);
        },
    },
    {
        tool: 'get_price_stats',
        name: 'kr-year-window-and-stale-listing',
        now: CLOCKS.krSession,
        args: { symbols: [SYMBOLS.kr, SYMBOLS.kr2], year: 2025 },
        arrange: () => {
            listKrStock();
            listAsset(
                {
                    symbol: SYMBOLS.kr2,
                    name: 'Daon Bio',
                    koreanName: '다온바이오',
                    marketProfile: 'kr-equity',
                },
                {
                    base: 12_500,
                    drift: 0.0006,
                    seed: 61,
                    volume: 640_000,
                    decimals: 0,
                    lastDate: '2026-08-14',
                }
            );
        },
    },
    {
        tool: 'get_price_stats',
        name: 'crypto-range-and-unknown-symbol',
        now: CLOCKS.crypto,
        args: {
            symbols: [SYMBOLS.crypto, 'NOPEQ'],
            from: '2026-01-01',
            to: '2026-06-30',
        },
        arrange: listCrypto,
    },
    {
        tool: 'get_price_stats',
        name: 'future-year-invalid-args',
        now: CLOCKS.weekend,
        args: { symbols: [SYMBOLS.us], year: 2027 },
        arrange: listUsStock,
    },
];

/** 테마 구성 종목(심볼은 core 테마 정의가 정한다)을 합성 시장에 올린다 — 가격·이름은 합성이다. */
export function listThemeMembers(themeId: string, market: 'us' | 'kr'): void {
    const theme = findAgentTheme(themeId);
    theme?.symbols.forEach((symbol, i) =>
        listAsset(
            {
                symbol,
                name: `Theme Member ${i + 1} Corp`,
                ...(market === 'kr'
                    ? {
                          koreanName: `테마종목${i + 1}`,
                          marketProfile: 'kr-equity' as const,
                      }
                    : {}),
            },
            {
                base: market === 'kr' ? 52_000 + i * 9_000 : 14 + i * 6.5,
                drift: 0.0002 + i * 0.0001,
                seed: 200 + i,
                volume: 3_000_000,
                decimals: market === 'kr' ? 0 : 2,
            }
        )
    );
}

export const themeSnapshotCases: GoldenCase[] = [
    {
        tool: 'get_theme_snapshot',
        name: 'us-quantum-session-open',
        now: CLOCKS.usOpen,
        args: { theme: 'quantum' },
        arrange: () => listThemeMembers('quantum', 'us'),
    },
    {
        tool: 'get_theme_snapshot',
        name: 'kr-semis-one-member-failing',
        now: CLOCKS.krSession,
        args: { theme: 'kr_semis' },
        locale: 'en',
        arrange: () => {
            listThemeMembers('kr_semis', 'kr');
            const first = findAgentTheme('kr_semis')?.symbols[0];
            if (first !== undefined) world.failing.add(first);
        },
    },
    {
        tool: 'get_theme_snapshot',
        name: 'every-member-failing-provider-failed',
        now: CLOCKS.weekend,
        args: { theme: 'nuclear' },
    },
    {
        tool: 'get_theme_snapshot',
        name: 'unknown-theme-invalid-args',
        now: CLOCKS.weekend,
        args: { theme: 'robotaxi' },
    },
];
