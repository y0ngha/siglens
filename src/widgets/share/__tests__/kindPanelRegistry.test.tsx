/**
 * kindPanelRegistry exhaustiveness and function-shape tests.
 *
 * We assert:
 *  1. All 8 ShareableKind keys are present in the registry.
 *  2. Each entry is a function.
 *  3. The registry key set exactly equals SHAREABLE_KIND_VALUES (no extras).
 */

import { render } from '@testing-library/react';
import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { SHARE_KIND_PANEL_REGISTRY } from '@/widgets/share/ui/kindPanelRegistry';

// ─── mock every heavy widget so this test stays unit-level ───────────────────

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

// ─── tests ───────────────────────────────────────────────────────────────────

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

    // ── T4: chart adapter passes correct props to AnalysisPanel ──────────────

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
