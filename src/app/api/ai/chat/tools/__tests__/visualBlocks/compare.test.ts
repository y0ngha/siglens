import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { barsOf, assetOf } = vi.hoisted(() => ({
    barsOf: vi.fn(),
    assetOf: vi.fn(),
}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: barsOf,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));
vi.mock('@/app/api/ai/chat/tools/resolveAssetInfo', () => ({
    resolveAssetInfoOrNull: assetOf,
}));

import type { Bar } from '@y0ngha/siglens-core';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import {
    buildCompareBlock,
    COMPARE_POINTS_MAX,
    compareSeriesFrom,
    compareStartSeconds,
} from '@/app/api/ai/chat/tools/visualBlocks/compare';
import type { VisualBuildEnv } from '@/app/api/ai/chat/tools/visualBlocks/types';

const NOW = new Date('2026-11-19T12:00:00Z');
const env: VisualBuildEnv = {
    locale: 'ko',
    userId: 'u',
    allowUnofficialSources: true,
    now: NOW,
};
const DAY = 86_400;
const START = Date.UTC(2026, 4, 19) / 1000;

/** `START`부터 n개의 일봉 — 종가는 close(i). */
const bars = (n: number, close: (i: number) => number, from = START): Bar[] =>
    Array.from({ length: n }, (_, i) => ({
        time: from + i * DAY,
        open: 1,
        high: 1,
        low: 1,
        close: close(i),
        volume: 1,
    }));

const asset = (marketProfile?: MarketProfileId) => ({
    symbol: 'X',
    name: 'X Inc',
    ...(marketProfile ? { marketProfile } : {}),
});

beforeEach(() => {
    barsOf.mockReset();
    assetOf.mockReset();
    assetOf.mockResolvedValue(asset('us-equity'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('compareStartSeconds', () => {
    it('달력 기준으로 기간만큼 거슬러 올라간 UTC 자정', () => {
        expect(compareStartSeconds('1M', NOW)).toBe(
            Date.UTC(2026, 9, 19) / 1000
        );
        expect(compareStartSeconds('3M', NOW)).toBe(
            Date.UTC(2026, 7, 19) / 1000
        );
        expect(compareStartSeconds('6M', NOW)).toBe(
            Date.UTC(2026, 4, 19) / 1000
        );
        expect(compareStartSeconds('1Y', NOW)).toBe(
            Date.UTC(2025, 10, 19) / 1000
        );
    });

    it('말일이 짧은 달로 거슬러 가면 넘치지 않고 그 달 말일로 눌린다', () => {
        expect(
            compareStartSeconds('1M', new Date('2026-03-31T10:00:00Z'))
        ).toBe(Date.UTC(2026, 1, 28) / 1000);
        expect(
            compareStartSeconds('1M', new Date('2028-03-31T10:00:00Z'))
        ).toBe(Date.UTC(2028, 1, 29) / 1000);
        expect(
            compareStartSeconds('6M', new Date('2026-08-31T10:00:00Z'))
        ).toBe(Date.UTC(2026, 1, 28) / 1000);
    });
});

describe('compareSeriesFrom', () => {
    it('기간 시작 이후 첫 봉 종가를 기준(0%)으로 수익률을 잡는다', () => {
        const series = compareSeriesFrom(
            'NVDA',
            [
                {
                    time: START - DAY,
                    open: 1,
                    high: 1,
                    low: 1,
                    close: 50,
                    volume: 1,
                },
                ...bars(3, i => [100, 110, 90][i] ?? 0),
            ],
            START
        );
        expect(series).toEqual({
            symbol: 'NVDA',
            points: [
                [START, 0],
                [START + DAY, 10],
                [START + 2 * DAY, -10],
            ],
        });
    });

    it('종가가 유효하지 않은 봉은 건너뛰고, 쓸 봉이 없으면 null', () => {
        expect(
            compareSeriesFrom(
                'X',
                bars(2, i => [0, 100][i] ?? 0),
                START
            )?.points
        ).toEqual([[START + DAY, 0]]);
        expect(
            compareSeriesFrom(
                'X',
                bars(2, () => 100, START - 9 * DAY),
                START
            )
        ).toBeNull();
        expect(compareSeriesFrom('X', [], START)).toBeNull();
    });

    it(`점은 종목당 ${COMPARE_POINTS_MAX}개로 솎되 처음과 끝은 남긴다`, () => {
        const series = compareSeriesFrom(
            'X',
            bars(1000, i => 100 + i),
            START
        );
        if (series === null) throw new Error('series expected');
        expect(series.points).toHaveLength(COMPARE_POINTS_MAX);
        expect(series.points[0]?.[0]).toBe(START);
        expect(series.points.at(-1)?.[0]).toBe(START + 999 * DAY);
    });
});

describe('buildCompareBlock', () => {
    it('종목별 선과 요약(수익률)을 만든다', async () => {
        barsOf.mockImplementation(async (_p: unknown, symbol: string) => ({
            bars: bars(3, i =>
                symbol === 'NVDA'
                    ? ([100, 120, 130][i] ?? 0)
                    : ([100, 90, 95][i] ?? 0)
            ),
        }));
        const out = await buildCompareBlock(['NVDA', 'AMD'], '6M', env);
        if ('error' in out) throw new Error(out.reason);
        expect(out.block).toMatchObject({
            version: 1,
            kind: 'compare',
            period: '6M',
            asOf: NOW.toISOString(),
        });
        expect(out.summary).toMatchObject({
            series: [
                { symbol: 'NVDA', returnPct: 30 },
                { symbol: 'AMD', returnPct: -5 },
            ],
            missing: [],
        });
    });

    it('데이터를 못 읽은 종목은 빼고 summary.missing에 싣는다(둘 이상 남을 때)', async () => {
        barsOf.mockImplementation(async (_p: unknown, symbol: string) => {
            if (symbol === 'BAD') throw new Error('provider down');
            return { bars: bars(3, i => 100 + i) };
        });
        const out = await buildCompareBlock(['AAPL', 'BAD', 'MSFT'], '6M', env);
        if ('error' in out) throw new Error(out.reason);
        expect(
            out.block.kind === 'compare' && out.block.series.map(s => s.symbol)
        ).toEqual(['AAPL', 'MSFT']);
        expect(out.summary.missing).toEqual(['BAD']);
    });

    it('자산 조회가 null인 종목도 기본 시장 프로필로 선을 남긴다', async () => {
        assetOf.mockImplementation(async (s: string) =>
            s === 'MSFT' ? null : asset('us-equity')
        );
        barsOf.mockResolvedValue({ bars: bars(3, i => 100 + i) });
        const out = await buildCompareBlock(['AAPL', 'MSFT'], '6M', env);
        if ('error' in out) throw new Error(out.reason);
        expect(
            out.block.kind === 'compare' && out.block.series.map(s => s.symbol)
        ).toEqual(['AAPL', 'MSFT']);
        expect(out.summary.missing).toEqual([]);
    });

    it('남은 종목이 둘 미만이면 no_data', async () => {
        barsOf.mockImplementation(async (_p: unknown, symbol: string) =>
            symbol === 'AAPL' ? { bars: bars(3, i => 100 + i) } : { bars: [] }
        );
        expect(await buildCompareBlock(['AAPL', 'ZZZZ'], '6M', env)).toEqual({
            error: 'no_data',
            reason: 'not_enough_symbols_with_data',
        });
    });

    it('한국 죽은 리스팅(마지막 거래가 오래됨)은 수익률에 쓰지 않는다', async () => {
        assetOf.mockImplementation(async (s: string) =>
            asset(s.endsWith('.KS') ? 'kr-equity' : 'us-equity')
        );
        barsOf.mockImplementation(async (_p: unknown, symbol: string) => ({
            // 한국 종목은 마지막 봉이 한 달 전이다.
            bars: symbol.endsWith('.KS')
                ? bars(3, i => 100 + i, START)
                : bars(3, i => 100 + i, NOW.getTime() / 1000 - 3 * DAY),
        }));
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        try {
            expect(
                await buildCompareBlock(['005930.KS', 'AAPL'], '6M', env)
            ).toMatchObject({ error: 'no_data' });
        } finally {
            vi.useRealTimers();
        }
    });
});
