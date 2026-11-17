import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const deps = vi.hoisted(() => ({
    peek: vi.fn(),
    getBars: vi.fn(),
    profile: vi.fn(async () => 'us-equity'),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<object>()),
    peekAnalysisCache: deps.peek,
}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: deps.getBars,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: deps.profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));

import { TIER_CONFIG, type Bar, type ChartOverlay } from '@y0ngha/siglens-core';
import {
    chartBlockFrom,
    loadAnalysisChartBlock,
    peekChartDrawings,
    type ChartAnalysisSource,
} from '@/app/api/ai/chat/tools/chartBlock';

const DAY = 86_400;
/** n개의 일봉(시각은 0, DAY, 2·DAY …). */
function bars(n: number): Bar[] {
    return Array.from({ length: n }, (_, i) => ({
        time: i * DAY,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1,
    }));
}

/** `from`봉에서 `to`봉까지 잇는 추세선 작도. */
function trendline(id: string, from: number, to: number): ChartOverlay {
    return {
        id,
        kind: 'trendline',
        skill: 'trend',
        sourceRef: id,
        variant: 'primary',
        segments: [
            {
                from: { time: from * DAY, price: 100 },
                to: { time: to * DAY, price: 110 },
                role: 'support',
                style: 'solid',
                pane: 'price',
            },
        ],
        levels: [],
        labels: [],
    } as unknown as ChartOverlay;
}

const source = (n: number) => ({
    symbol: 'QQQ',
    timeframe: '1Day' as const,
    marketProfile: 'us-equity' as const,
    bars: bars(n),
});

describe('chartBlockFrom', () => {
    it('작도가 없으면 최근 봉 120개를 싣는다', () => {
        const block = chartBlockFrom(source(500));
        expect(block?.bars).toHaveLength(120);
        expect(block?.bars[0]?.time).toBe((500 - 120) * DAY);
        expect(block).toMatchObject({
            version: 1,
            symbol: 'QQQ',
            overlays: [],
            analyzedAt: null,
        });
    });

    it('작도가 기본 창보다 이르면 그 시각까지 창을 넓힌다', () => {
        const block = chartBlockFrom(source(500), {
            chartOverlays: [trendline('t1', 300, 450)],
        });
        expect(block?.bars[0]?.time).toBe(300 * DAY);
        expect(block?.overlays.map(o => o.id)).toEqual(['t1']);
    });

    it('창은 400봉까지만 넓히고, 그보다 이른 작도는 뺀다', () => {
        const block = chartBlockFrom(source(1000), {
            chartOverlays: [
                trendline('old', 10, 990),
                trendline('t2', 900, 990),
            ],
        });
        expect(block?.bars).toHaveLength(400);
        expect(block?.overlays.map(o => o.id)).toEqual(['t2']);
    });

    it('봉 시각에 맞지 않는 작도는 뺀다', () => {
        const misaligned = trendline('m', 450, 480);
        const shifted = {
            ...misaligned,
            segments: misaligned.segments.map(s => ({
                ...s,
                to: { ...s.to, time: s.to.time + 1 },
            })),
        } as ChartOverlay;
        const block = chartBlockFrom(source(500), { chartOverlays: [shifted] });
        expect(block?.overlays).toEqual([]);
    });

    it('스킬 색·이름과 분석 시각을 싣는다', () => {
        const block = chartBlockFrom(source(200), {
            chartOverlays: [],
            patternSummaries: [
                {
                    id: 'p1',
                    skillName: '이중바닥',
                    renderConfig: { color: '#ff0000' },
                },
                { id: 'p2', skillName: '삼각수렴' },
            ] as never,
            strategyResults: [{ id: 's1', strategyName: '돌파' }] as never,
            analyzedAt: '2026-11-16T00:00:00.000Z',
        });
        expect(block).toMatchObject({
            overlayColors: { p1: '#ff0000' },
            overlayLabels: { p1: '이중바닥', p2: '삼각수렴', s1: '돌파' },
            analyzedAt: '2026-11-16T00:00:00.000Z',
        });
    });

    it('봉이 없으면 null', () => {
        expect(chartBlockFrom(source(0))).toBeNull();
    });
});

describe('chartBlockFrom — 봉 필드', () => {
    it('차트가 그리는 필드만 싣는다(VWAP 같은 부가 필드는 뺀다)', () => {
        const block = chartBlockFrom({
            ...source(2),
            bars: bars(2).map(b => ({ ...b, vwap: 1 }) as Bar),
        });
        expect(block?.bars[0]).toEqual({
            time: 0,
            open: 100,
            high: 101,
            low: 99,
            close: 100,
            volume: 1,
        });
    });
});

describe('peekChartDrawings', () => {
    afterEach(() => deps.peek.mockReset());
    const key = {
        symbol: 'QQQ',
        timeframe: '1Day' as const,
        modelId: 'deepseek-v4.1-flash' as const,
        reasoning: true,
        tier: 'free' as const,
        positionBucket: 'profit' as const,
        locale: 'ko' as const,
    };
    const received = { analyzedAt: 'a1', chartOverlays: [] };

    it('같은 키로, 정보 깊이 제한만 끈 티어 설정으로 다시 꺼낸다', async () => {
        deps.peek.mockResolvedValue(null);
        await peekChartDrawings(key, received);
        expect(deps.peek).toHaveBeenCalledWith(
            'QQQ',
            '1Day',
            undefined,
            'deepseek-v4.1-flash',
            true,
            'free',
            {
                ...TIER_CONFIG,
                featureFlags: {
                    ...TIER_CONFIG.featureFlags,
                    enableInfoDepthRestrictions: false,
                },
            },
            'profit',
            'ko'
        );
    });

    it('꺼낸 분석이 받은 분석과 같은 생성 시각이면 그것을 쓴다', async () => {
        const full = {
            analyzedAt: 'a1',
            chartOverlays: [trendline('t1', 1, 2)],
        };
        deps.peek.mockResolvedValue({ result: full });
        await expect(peekChartDrawings(key, received)).resolves.toBe(full);
    });

    it('생성 시각이 다르거나 못 꺼내면 받은 분석을 쓴다', async () => {
        deps.peek.mockResolvedValue({ result: { analyzedAt: 'a2' } });
        await expect(peekChartDrawings(key, received)).resolves.toBe(received);
        deps.peek.mockResolvedValue(null);
        await expect(peekChartDrawings(key, received)).resolves.toBe(received);
    });
});

describe('loadAnalysisChartBlock', () => {
    afterEach(() => {
        vi.useRealTimers();
        deps.getBars.mockReset();
    });
    const input = (loadAnalysis: () => Promise<ChartAnalysisSource>) => ({
        symbol: 'QQQ',
        timeframe: '1Day' as const,
        fmpSymbol: undefined,
        loadAnalysis,
    });

    it('다시 꺼낸 분석의 작도로 블록을 만든다', async () => {
        deps.getBars.mockResolvedValue({ bars: bars(500) });
        await expect(
            loadAnalysisChartBlock(
                input(async () => ({
                    chartOverlays: [trendline('t1', 450, 480)],
                }))
            )
        ).resolves.toMatchObject({ overlays: [{ id: 't1' }] });
    });

    it('봉 조회가 실패하면 던지지 않고 null', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        deps.getBars.mockRejectedValue(new Error('fmp down'));
        await expect(
            loadAnalysisChartBlock(input(async () => ({ chartOverlays: [] })))
        ).resolves.toBeNull();
    });

    it('8초를 넘으면 차트 없이(null) 끝난다', async () => {
        vi.useFakeTimers();
        deps.getBars.mockReturnValue(new Promise(() => {}));
        const pending = loadAnalysisChartBlock(
            input(async () => ({ chartOverlays: [] }))
        );
        await vi.advanceTimersByTimeAsync(8_000);
        await expect(pending).resolves.toBeNull();
    });
});
