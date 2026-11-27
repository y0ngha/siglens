vi.mock('server-only', () => ({}));

import {
    calculateIndicators,
    type Bar,
    type BarsData,
} from '@y0ngha/siglens-core';
import {
    loadSymbolDrawings,
    type SymbolDrawingsSources,
} from '@/app/api/cron/email-report/loadSymbolDrawings';
import type { ShareableAnalysisRow } from '@/entities/analysis/analysisHistoryRepository';
import { SNAPSHOT_MAX_AGE_MS } from '@/entities/seo-snapshot/model';
import { MS_PER_DAY } from '@/shared/config/time';

const NOW = new Date('2026-11-26T00:00:00.000Z');
const DAY = 86_400;
const T0 = 1_790_000_000;
/** 인덱스 `i` 봉이 속한 UTC 날짜 — 메일 기준일로 쓴다. */
const dateOf = (i: number) =>
    new Date((T0 + i * DAY) * 1_000).toISOString().slice(0, 10);
const LAST_DATE = dateOf(99);

function barsData(count: number): BarsData {
    const bars: Bar[] = Array.from({ length: count }, (_, i) => ({
        time: T0 + i * DAY,
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1,
    }));
    return { bars, indicators: calculateIndicators(bars) };
}

function resultWithTrendline(fromIndex: number, toIndex: number) {
    return {
        chartOverlays: [
            {
                id: 'tl',
                kind: 'trendline',
                skill: 'trendline',
                sourceRef: 'trendlines',
                variant: 'primary',
                segments: [
                    {
                        from: { time: T0 + fromIndex * DAY, price: 95 },
                        to: { time: T0 + toIndex * DAY, price: 105 },
                        role: 'support',
                        style: 'solid',
                        pane: 'price',
                    },
                ],
                levels: [],
                labels: [],
            },
        ],
    };
}

function row(symbol: string, result: unknown): ShareableAnalysisRow {
    return {
        symbol,
        generatedAt: new Date('2026-11-25T01:00:00.123Z'),
        tier: 'member',
        result,
    };
}

function sources(
    rows: ShareableAnalysisRow[],
    overrides: Partial<SymbolDrawingsSources> = {}
): SymbolDrawingsSources {
    return {
        findLatest: vi.fn(async () => new Map(rows.map(r => [r.symbol, r]))),
        getDailyBars: vi.fn(async () => barsData(100)),
        ...overrides,
    };
}

describe('loadSymbolDrawings', () => {
    it('분석 조회는 한 번, 7일 이내 기준으로 하고 그려지는 작도의 시각과 범례를 돌려준다', async () => {
        const src = sources([row('AAPL', resultWithTrendline(60, 90))]);

        const found = await loadSymbolDrawings(
            ['AAPL', 'MSFT'],
            LAST_DATE,
            NOW,
            src
        );

        expect(src.findLatest).toHaveBeenCalledTimes(1);
        expect(src.findLatest).toHaveBeenCalledWith(
            ['AAPL', 'MSFT'],
            new Date(NOW.getTime() - SNAPSHOT_MAX_AGE_MS)
        );
        expect(SNAPSHOT_MAX_AGE_MS).toBe(7 * MS_PER_DAY);
        expect([...found.keys()]).toEqual(['AAPL']);
        expect(found.get('AAPL')).toEqual({
            analysisAt: new Date('2026-11-25T01:00:00.123Z'),
            legend: [{ kind: 'trendUp', color: expect.any(String) }],
        });
    });

    it('작도가 없는 결과·창에 안 맞는 작도·읽을 수 없는 결과는 결과에 없다', async () => {
        const src = sources([
            row('A', { summary: '작도 없음' }),
            row('B', resultWithTrendline(1, 5)),
            row('C', 'broken'),
        ]);

        const found = await loadSymbolDrawings(
            ['A', 'B', 'C'],
            dateOf(299),
            NOW,
            {
                ...src,
                getDailyBars: vi.fn(async () => barsData(300)),
            }
        );

        expect(found.size).toBe(0);
    });

    it('분석 조회가 던지면 빈 결과(작도 없는 메일)로 끝난다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const src = sources([], {
            findLatest: vi.fn().mockRejectedValue(new Error('db down')),
        });

        await expect(
            loadSymbolDrawings(['AAPL'], LAST_DATE, NOW, src)
        ).resolves.toEqual(new Map());
    });

    it('한 종목의 일봉 조회 실패는 그 종목만 뺀다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const src = sources(
            [
                row('AAPL', resultWithTrendline(60, 90)),
                row('MSFT', resultWithTrendline(60, 90)),
            ],
            {
                getDailyBars: vi.fn(async (symbol: string) => {
                    if (symbol === 'MSFT') throw new Error('fmp down');
                    return barsData(100);
                }),
            }
        );

        const found = await loadSymbolDrawings(
            ['AAPL', 'MSFT'],
            LAST_DATE,
            NOW,
            src
        );

        expect([...found.keys()]).toEqual(['AAPL']);
    });

    it('이미지와 같은 날짜 자름으로 계산한다 — 기준일 뒤 봉에 기대는 작도는 범례에 오르지 않는다', async () => {
        const src = sources([row('AAPL', resultWithTrendline(60, 90))]);

        const early = await loadSymbolDrawings(['AAPL'], dateOf(80), NOW, src);
        const late = await loadSymbolDrawings(['AAPL'], dateOf(95), NOW, src);

        expect(early.size).toBe(0);
        expect(late.size).toBe(1);
    });

    it('종목이 없으면 조회하지 않는다', async () => {
        const src = sources([]);

        expect((await loadSymbolDrawings([], LAST_DATE, NOW, src)).size).toBe(
            0
        );
        expect(src.findLatest).not.toHaveBeenCalled();
    });
});
