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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildCompareBlock,
    COMPARE_POINTS_MAX,
    compareSeriesFrom,
} from '@/app/api/ai/chat/tools/visualBlocks/compare';
import type { VisualBuildEnv } from '@/app/api/ai/chat/tools/visualBlocks/types';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

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

/** 날짜(UTC 자정)와 종가만 있는 일봉. */
const dayBar = (date: string, close: number): Bar => ({
    time: Date.parse(`${date}T00:00:00Z`) / 1000,
    open: 1,
    high: 1,
    low: 1,
    close,
    volume: 1,
});

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

describe('compareSeriesFrom', () => {
    it('기간 시작일 직전 세션 종가를 기준(0%)으로 수익률을 잡고 점도 그 봉에서 시작한다', () => {
        // 마지막 봉 2026-05-21 − 1개월 = 04-21. 04-20(월)·04-21(화) 봉 가운데 시작일 당일 봉이 기준이다.
        const series = compareSeriesFrom(
            'NVDA',
            [
                dayBar('2026-04-20', 50),
                dayBar('2026-04-21', 100),
                dayBar('2026-05-20', 110),
                dayBar('2026-05-21', 90),
            ],
            1
        );
        expect(series).toEqual({
            symbol: 'NVDA',
            points: [
                [Date.UTC(2026, 3, 21) / 1000, 0],
                [Date.UTC(2026, 4, 20) / 1000, 10],
                [Date.UTC(2026, 4, 21) / 1000, -10],
            ],
        });
    });

    it('시작일에 봉이 없으면(주말) 그 직전 세션이 기준이다 — 시작일 이후 첫 봉이 아니다', () => {
        // 마지막 봉 2026-05-18(월) − 1개월 = 04-18(토). 직전 세션은 04-17(금).
        const series = compareSeriesFrom(
            'X',
            [
                dayBar('2026-04-16', 80),
                dayBar('2026-04-17', 100),
                dayBar('2026-04-20', 120),
                dayBar('2026-05-18', 150),
            ],
            1
        );
        expect(series?.points).toEqual([
            [Date.UTC(2026, 3, 17) / 1000, 0],
            [Date.UTC(2026, 3, 20) / 1000, 20],
            [Date.UTC(2026, 4, 18) / 1000, 50],
        ]);
    });

    it('이력이 시작일까지 거슬러 가지 않으면 첫 봉이 기준이다', () => {
        const series = compareSeriesFrom(
            'X',
            bars(3, i => 100 + i * 10),
            6
        );
        expect(series?.points).toEqual([
            [START, 0],
            [START + DAY, 10],
            [START + 2 * DAY, 20],
        ]);
    });

    it('종가가 유효하지 않은 봉은 건너뛰고, 쓸 봉이 없으면 null', () => {
        expect(
            compareSeriesFrom(
                'X',
                bars(2, i => [0, 100][i] ?? 0),
                6
            )?.points
        ).toEqual([[START + DAY, 0]]);
        expect(
            compareSeriesFrom(
                'X',
                bars(2, () => 0),
                6
            )
        ).toBeNull();
        expect(compareSeriesFrom('X', [], 6)).toBeNull();
    });

    it(`점은 종목당 ${COMPARE_POINTS_MAX}개로 솎되 처음과 끝은 남긴다`, () => {
        const series = compareSeriesFrom(
            'X',
            bars(1000, i => 100 + i),
            12
        );
        if (series === null) throw new Error('series expected');
        expect(series.points).toHaveLength(COMPARE_POINTS_MAX);
        // 마지막 봉(START + 999일) − 12개월 이전 세션부터다 — 첫 점은 그 봉이고 끝 점은 마지막 봉이다.
        expect(series.points.at(-1)?.[0]).toBe(START + 999 * DAY);
        expect(series.points[0]?.[1]).toBe(0);
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

    it('요약의 from은 기준 세션 날짜이고 note가 기준 규칙을 말한다', async () => {
        // 마지막 봉 2026-05-18 − 1개월 = 04-18(토) → 기준은 04-17(금).
        barsOf.mockResolvedValue({
            bars: [
                dayBar('2026-04-16', 80),
                dayBar('2026-04-17', 100),
                dayBar('2026-05-18', 150),
            ],
        });
        const out = await buildCompareBlock(['NVDA', 'AMD'], '1M', env);
        if ('error' in out) throw new Error(out.reason);
        expect(out.summary).toMatchObject({
            note: expect.stringContaining('last session on or before'),
            series: [
                {
                    symbol: 'NVDA',
                    from: '2026-04-17',
                    to: '2026-05-18',
                    returnPct: 50,
                },
                {
                    symbol: 'AMD',
                    from: '2026-04-17',
                    to: '2026-05-18',
                    returnPct: 50,
                },
            ],
        });
    });

    it('정규장 중에는 형성 중인 마지막 봉을 빼고 마감된 세션까지만 그린다', async () => {
        // 2026-11-19 11:00 ET(장중): 11-19 봉은 형성 중이라 끝점은 11-18 종가다.
        const open = { ...env, now: new Date('2026-11-19T16:00:00Z') };
        barsOf.mockResolvedValue({
            bars: [
                dayBar('2026-10-16', 100),
                dayBar('2026-11-18', 120),
                dayBar('2026-11-19', 999),
            ],
        });
        const out = await buildCompareBlock(['NVDA', 'AMD'], '1M', open);
        if ('error' in out) throw new Error(out.reason);
        expect(out.summary).toMatchObject({
            series: [
                {
                    symbol: 'NVDA',
                    from: '2026-10-16',
                    to: '2026-11-18',
                    returnPct: 20,
                },
                {
                    symbol: 'AMD',
                    from: '2026-10-16',
                    to: '2026-11-18',
                    returnPct: 20,
                },
            ],
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
