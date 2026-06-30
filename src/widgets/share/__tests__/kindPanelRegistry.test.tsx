/**
 * kindPanelRegistry exhaustiveness, function-shape, and render tests.
 *
 * We assert:
 *  1. All 8 ShareableKind keys are present in the registry.
 *  2. Each entry is a function.
 *  3. The registry key set exactly equals SHAREABLE_KIND_VALUES (no extras).
 *  4. Each kind actually RENDERS without throwing (catches undefined component bugs).
 *  5. The chart adapter passes the correct fixed props to AnalysisPanel.
 *
 * Mocks use deep paths that match the imports in kindPanelRegistry.tsx — so the
 * mock resolves at the same module boundary that the registry uses, preventing
 * undefined-component regressions.
 */

import { render } from '@testing-library/react';
import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { SHARE_KIND_PANEL_REGISTRY } from '@/widgets/share/ui/kindPanelRegistry';

// Mock every heavy widget so this test stays unit-level.
//
// IMPORTANT: mock paths MUST match the import paths in kindPanelRegistry.tsx.
// If the registry deep-imports a component but the mock targets the barrel (or
// vice-versa), the mock won't intercept and the component will be undefined.

const mockAnalysisPanel = vi.fn((_props: Record<string, unknown>) => null);

vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: (props: Record<string, unknown>) => mockAnalysisPanel(props),
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

    // T4: chart adapter passes correct props to AnalysisPanel
    describe('chart adapter (ChartSharePanel)', () => {
        beforeEach(() => {
            mockAnalysisPanel.mockClear();
        });

        it('renders AnalysisPanel with analysis=result, keyLevels={support:[],resistance:[]}, timeframe="1Day", symbol=""', () => {
            /**
             * ChartSharePanel passes these fixed adapter props to AnalysisPanel
             * so the read-only share view degrades gracefully without live data.
             * - symbol: '' (only used in copy-report util, unreachable in share view)
             * - keyLevels: {support:[], resistance:[]} (clustered shape, graceful empty)
             * - timeframe: '1Day' (non-triggering stale-banner default)
             * - isFreeUser: false
             * See kindPanelRegistry.tsx ChartSharePanel JSDoc for full rationale.
             */
            const fakeResult = { trend: 'bullish', summary: '상승 추세' };
            render(
                SHARE_KIND_PANEL_REGISTRY.chart({ result: fakeResult as never })
            );

            expect(mockAnalysisPanel).toHaveBeenCalledTimes(1);
            expect(mockAnalysisPanel).toHaveBeenCalledWith(
                expect.objectContaining({
                    analysis: fakeResult,
                    keyLevels: { support: [], resistance: [] },
                    timeframe: '1Day',
                    symbol: '',
                })
            );
        });
    });
});
