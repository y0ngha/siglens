/**
 * kindPanelRegistry exhaustiveness, function-shape, and render tests.
 *
 * We assert:
 *  1. All 8 ShareableKind keys are present in the registry.
 *  2. Each entry is a function.
 *  3. The registry key set exactly equals SHAREABLE_KIND_VALUES (no extras).
 *  4. Each kind actually RENDERS without throwing (catches undefined component bugs).
 *  5. The chart adapter derives ClusteredKeyLevels from result.keyLevels via
 *     validateKeyLevels + clusterKeyLevels and passes them to AnalysisPanel.
 *  6. The chart adapter renders ShareCandlestickChart when chartBars is provided,
 *     and omits it when chartBars is absent (graceful degradation for old snapshots).
 *
 * Mocks use deep paths that match the imports in kindPanelRegistry.tsx — so the
 * mock resolves at the same module boundary that the registry uses, preventing
 * undefined-component regressions.
 */

import { render } from '@testing-library/react';
import type { Bar, ClusteredKeyLevels } from '@y0ngha/siglens-core';
import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { SHARE_KIND_PANEL_REGISTRY } from '@/views/share/kindPanelRegistry';

// Mock every heavy widget so this test stays unit-level.
//
// IMPORTANT: mock paths MUST match the import paths in kindPanelRegistry.tsx.
// If the registry deep-imports a component but the mock targets the barrel (or
// vice-versa), the mock won't intercept and the component will be undefined.

const mockAnalysisPanel = vi.fn((_props: Record<string, unknown>) => null);
const mockShareCandlestickChart = vi.fn(
    (_props: Record<string, unknown>) => null
);

// Stub clusterKeyLevels / validateKeyLevels so the chart adapter test is
// deterministic without depending on core implementation details.
const STUB_CLUSTERED: ClusteredKeyLevels = {
    support: [{ price: 100, reason: 'stub', count: 1, sources: [] }],
    resistance: [{ price: 200, reason: 'stub', count: 1, sources: [] }],
};
const mockClusterKeyLevels = vi.fn(
    (_kl: unknown, _price: number) => STUB_CLUSTERED
);
const mockValidateKeyLevels = vi.fn((kl: unknown) => kl);

vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const original =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...original,
        clusterKeyLevels: (kl: unknown, price: number) =>
            mockClusterKeyLevels(kl, price),
        validateKeyLevels: (kl: unknown) => mockValidateKeyLevels(kl),
    };
});

vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: (props: Record<string, unknown>) => mockAnalysisPanel(props),
}));
vi.mock('@/widgets/chart/ShareCandlestickChart', () => ({
    ShareCandlestickChart: (props: Record<string, unknown>) =>
        mockShareCandlestickChart(props),
}));
vi.mock('@/widgets/overall/OverallView', () => ({
    OverallView: () => null,
}));
vi.mock('@/widgets/news/NewsAiSummary', () => ({
    NewsAiSummaryView: () => null,
}));
vi.mock('@/widgets/fundamental/FundamentalAiSummary', () => ({
    FundamentalAiSummaryView: () => null,
}));
vi.mock('@/widgets/financials/FinancialsAiSummary', () => ({
    FinancialsAiSummaryView: () => null,
}));
vi.mock('@/widgets/congress/CongressTrendSummaryView', () => ({
    CongressTrendSummaryView: () => null,
}));
vi.mock('@/widgets/options/OptionsAiAnalysis', () => ({
    OptionsAiAnalysisView: () => null,
}));
vi.mock('@/widgets/fear-greed/FearGreedShareView', () => ({
    FearGreedShareView: () => null,
}));

// Minimal stub results (cast to never — mocks ignore props anyway).

const stubResults = {
    chart: { trend: 'bullish', summary: '차트 분석' },
    overall: { score: 70 },
    news: { articles: [] },
    fundamental: { metrics: {} },
    financials: { statements: {} },
    congress: { trades: [] },
    options: { chain: [] },
    'fear-greed': { value: 50 },
} as const;

describe('SHARE_KIND_PANEL_REGISTRY', () => {
    it('contains exactly the 8 shareable kinds — no more, no less', () => {
        const registryKeys = new Set(Object.keys(SHARE_KIND_PANEL_REGISTRY));
        const expectedKeys = new Set(SHAREABLE_KIND_VALUES);
        expect(registryKeys).toEqual(expectedKeys);
    });

    it('every entry is a function', () => {
        for (const kind of SHAREABLE_KIND_VALUES) {
            expect(typeof SHARE_KIND_PANEL_REGISTRY[kind]).toBe('function');
        }
    });

    it('each kind maps to its own distinct function', () => {
        const fns = SHAREABLE_KIND_VALUES.map(
            k => SHARE_KIND_PANEL_REGISTRY[k]
        );
        const uniqueFns = new Set(fns);
        // Every entry should be a separate function reference
        expect(uniqueFns.size).toBe(SHAREABLE_KIND_VALUES.length);
    });

    /**
     * Render test: exercises the registry → component resolution for every kind.
     *
     * This catches the class of bug where a component import resolves to
     * `undefined` (e.g. due to a deep-import circular dependency) — which only
     * manifests at render time, not at typeof-check time. Each render must not
     * throw "Element type is invalid: expected a string ... but got: undefined".
     */
    describe('each kind renders without throwing (undefined-component guard)', () => {
        for (const kind of SHAREABLE_KIND_VALUES) {
            it(`renders "${kind}" panel without error`, () => {
                const Panel = SHARE_KIND_PANEL_REGISTRY[kind];
                expect(() =>
                    render(
                        Panel({
                            result: stubResults[kind] as never,
                        })
                    )
                ).not.toThrow();
            });
        }
    });

    // T4: chart adapter derives ClusteredKeyLevels from result.keyLevels and passes to AnalysisPanel
    describe('chart adapter (ChartSharePanel)', () => {
        beforeEach(() => {
            mockAnalysisPanel.mockClear();
            mockClusterKeyLevels.mockClear();
            mockValidateKeyLevels.mockClear();
        });

        it('derives ClusteredKeyLevels from result.keyLevels via validateKeyLevels + clusterKeyLevels and passes to AnalysisPanel', () => {
            /**
             * ChartSharePanel derives keyLevels from the snapshot result:
             * - validateKeyLevels filters invalid entries from result.keyLevels
             * - clusterKeyLevels clusters the validated levels (currentPrice=0 since
             *   no live bar data is available; epsilon=0 means no merging but all
             *   valid levels still flow through)
             * - The ClusteredKeyLevels output is passed to AnalysisPanel
             * - symbol: forwarded from the snapshot so the copy-report utility
             *   uses the real ticker (e.g. `AAPL 기술적 분석 리포트`, `siglens.io/AAPL`)
             * - timeframe: '1Day' (non-triggering stale-banner default)
             * - isFreeUser: false
             * See kindPanelRegistry.tsx ChartSharePanel JSDoc for full rationale.
             */
            const rawKeyLevels = {
                support: [{ price: 100, reason: '지지선' }],
                resistance: [{ price: 200, reason: '저항선' }],
            };
            const fakeResult = {
                trend: 'bullish',
                summary: '상승 추세',
                keyLevels: rawKeyLevels,
            };
            render(
                SHARE_KIND_PANEL_REGISTRY.chart({
                    result: fakeResult as never,
                    symbol: 'AAPL',
                })
            );

            // validateKeyLevels called with the raw keyLevels from result
            expect(mockValidateKeyLevels).toHaveBeenCalledWith(rawKeyLevels);
            // clusterKeyLevels called with currentPrice=0 (no live bar data)
            expect(mockClusterKeyLevels).toHaveBeenCalledWith(
                expect.anything(),
                0
            );
            // AnalysisPanel receives the clustered output and the real ticker
            expect(mockAnalysisPanel).toHaveBeenCalledTimes(1);
            expect(mockAnalysisPanel).toHaveBeenCalledWith(
                expect.objectContaining({
                    analysis: fakeResult,
                    keyLevels: STUB_CLUSTERED,
                    timeframe: '1Day',
                    symbol: 'AAPL',
                })
            );
        });

        it('uses empty string when symbol is omitted (backwards compat for callers that omit symbol)', () => {
            const fakeResult = { trend: 'bullish', summary: '상승 추세' };
            render(
                SHARE_KIND_PANEL_REGISTRY.chart({ result: fakeResult as never })
            );
            expect(mockAnalysisPanel).toHaveBeenCalledWith(
                expect.objectContaining({ symbol: '' })
            );
        });

        it('falls back to empty clustered structure when result.keyLevels is absent', () => {
            const fakeResult = { trend: 'bullish', summary: '상승 추세' };
            render(
                SHARE_KIND_PANEL_REGISTRY.chart({ result: fakeResult as never })
            );

            // validateKeyLevels called with the empty fallback
            expect(mockValidateKeyLevels).toHaveBeenCalledWith({
                support: [],
                resistance: [],
            });
            expect(mockAnalysisPanel).toHaveBeenCalledTimes(1);
            // The clustered output (mocked as STUB_CLUSTERED) is still passed through
            expect(mockAnalysisPanel).toHaveBeenCalledWith(
                expect.objectContaining({
                    analysis: fakeResult,
                    keyLevels: STUB_CLUSTERED,
                })
            );
        });

        // T6: snapshot-time chart rendering via ShareCandlestickChart

        it('renders ShareCandlestickChart when chartBars is provided, forwarding ticker for aria-label (S2)', () => {
            mockShareCandlestickChart.mockClear();
            const fakeResult = { trend: 'bullish', summary: '차트 분석' };
            const stubBars: Bar[] = [
                {
                    time: 1700000000,
                    open: 150,
                    high: 155,
                    low: 148,
                    close: 153,
                    volume: 1000000,
                },
            ];
            render(
                SHARE_KIND_PANEL_REGISTRY.chart({
                    result: fakeResult as never,
                    chartBars: stubBars,
                    symbol: 'TSLA',
                })
            );
            expect(mockShareCandlestickChart).toHaveBeenCalledTimes(1);
            // ticker must be forwarded so aria-label reads "TSLA 스냅샷 캔들 차트"
            expect(mockShareCandlestickChart).toHaveBeenCalledWith(
                expect.objectContaining({ bars: stubBars, ticker: 'TSLA' })
            );
        });

        it('does not render ShareCandlestickChart when chartBars is absent (old snapshot graceful degradation)', () => {
            mockShareCandlestickChart.mockClear();
            const fakeResult = { trend: 'bullish', summary: '차트 분석' };
            render(
                SHARE_KIND_PANEL_REGISTRY.chart({ result: fakeResult as never })
            );
            expect(mockShareCandlestickChart).not.toHaveBeenCalled();
            // AnalysisPanel still renders without the chart
            expect(mockAnalysisPanel).toHaveBeenCalledTimes(1);
        });

        it('does not render ShareCandlestickChart when chartBars is an empty array', () => {
            mockShareCandlestickChart.mockClear();
            const fakeResult = { trend: 'bullish', summary: '차트 분석' };
            render(
                SHARE_KIND_PANEL_REGISTRY.chart({
                    result: fakeResult as never,
                    chartBars: [],
                })
            );
            expect(mockShareCandlestickChart).not.toHaveBeenCalled();
        });
    });
});
