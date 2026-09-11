import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    TOOL_RESULT_MAX_CHARS,
    truncateToolResult,
} from '@/app/api/ai/chat/tools/truncate';

const { profile, fetchBars, classify, detect, spec } = vi.hoisted(() => ({
    profile: vi.fn(),
    fetchBars: vi.fn(),
    classify: vi.fn(),
    detect: vi.fn(),
    spec: vi.fn(),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        fetchBarsWithIndicators: fetchBars,
        classifyTrend: classify,
        detectSignals: detect,
    };
});
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({ sessionSpecFor: spec }));
vi.mock('@/shared/config/marketProfile', () => ({
    getDescriptor: () => ({ priceFormat: { currency: 'USD' } }),
}));

import { getBarsIndicatorsTool } from '@/app/api/ai/chat/tools/getBarsIndicators';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

const bar = (time: number, close: number) => ({
    time,
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
});
const indicators = {
    rsi: [1, 2],
    macd: [],
    bollinger: [],
    atr: [null, 3],
    ma: { 20: [1, 2] },
    ema: { 20: [1, 2] },
};

describe('getBarsIndicatorsTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('봉이 없으면 found:false', async () => {
        profile.mockResolvedValue('us-equity');
        fetchBars.mockResolvedValue({ bars: [], indicators });
        const r = await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        );
        expect(r).toEqual({ symbol: 'AAPL', timeframe: '1Day', found: false });
    });

    it('N봉 절단 + trend/signals 포함', async () => {
        profile.mockResolvedValue('us-equity');
        const bars = Array.from({ length: 50 }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        fetchBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([
            {
                type: 'golden_cross',
                direction: 'bullish',
                phase: 'confirmed',
                detectedAt: 0,
            },
        ]);

        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day', bars: 10 },
            ctx,
            rt
        )) as {
            bars: unknown[];
            trend: string;
            signals: Array<{ type: string }>;
            latest: { rsi: number | null };
        };
        expect(r.bars).toHaveLength(10);
        expect(r.trend).toBe('uptrend');
        expect(r.signals).toEqual([
            { type: 'golden_cross', direction: 'bullish', phase: 'confirmed' },
        ]);
        expect(r.latest.rsi).toBe(2);
    });

    it('bars:200 처럼 예산을 초과하면 가장 오래된 봉부터 잘라 최신 봉을 보존한다 (item 4)', async () => {
        profile.mockResolvedValue('us-equity');
        const SOURCE_BARS = 250;
        const bars = Array.from({ length: SOURCE_BARS }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        fetchBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue(
            Array.from({ length: 5 }, (_, i) => ({
                type: `signal_${i}`,
                direction: 'bullish',
                phase: 'confirmed',
                detectedAt: 0,
            }))
        );

        const raw = await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day', bars: 200 },
            ctx,
            rt
        );
        const registryOutput = truncateToolResult(raw);
        const serialized = JSON.stringify(registryOutput);

        expect(serialized.length).toBeLessThanOrEqual(TOOL_RESULT_MAX_CHARS);

        const r = raw as {
            barsReturned: number;
            barsTrimmed: number;
            bars: Array<{ c: number }>;
        };
        expect(r.barsTrimmed).toBeGreaterThan(0);
        // The newest bar (close = 100 + SOURCE_BARS - 1) must survive the trim —
        // it's the last element of the source array (oldest-first).
        const newestClose = 100 + SOURCE_BARS - 1;
        expect(r.bars.at(-1)?.c).toBe(newestClose);
        expect(serialized).toContain(String(newestClose));
    });

    it('모델이 준 bars는 1..200으로 제한된다(0은 slice(-0) 전체 반환 함정)', async () => {
        profile.mockResolvedValue('us-equity');
        const bars = Array.from({ length: 50 }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        fetchBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);
        const barsFor = async (requested: unknown) =>
            (
                (await getBarsIndicatorsTool(
                    { symbol: 'AAPL', timeframe: '1Day', bars: requested },
                    ctx,
                    rt
                )) as { bars: unknown[] }
            ).bars.length;
        // `slice(-0)` returns the WHOLE array, so 0 must clamp to 1, not 50.
        expect(await barsFor(0)).toBe(1);
        expect(await barsFor(-5)).toBe(1);
        expect(await barsFor(Number.NaN)).toBe(30);
    });
});
