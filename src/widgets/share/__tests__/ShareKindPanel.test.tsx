/**
 * ShareKindPanel — RSC boundary dispatcher.
 *
 * Verifies that `<ShareKindPanel kind={k} result={r} />` renders without
 * throwing for all 8 ShareableKind values.
 *
 * Why this test matters:
 *   The previous architecture had `page.tsx` (server component) extract
 *   an arrow function from `SHARE_KIND_PANEL_REGISTRY` (a 'use client' plain
 *   object) and render it as JSX. Next.js RSC only creates client references
 *   for **named exports** of 'use client' modules — anonymous functions inside
 *   a plain object resolve to `undefined` at the RSC boundary, causing:
 *     "Element type is invalid: ... but got: undefined"
 *
 *   `ShareKindPanel` is a *named* 'use client' component, so it IS properly
 *   registered as an RSC client reference. The dispatch (`SHARE_KIND_PANEL_REGISTRY[kind]`)
 *   happens *inside* the client boundary where module init order is normal.
 *
 * This test exercises the full registry → panel dispatch path to catch
 * any future regression where a panel import resolves to `undefined`.
 */

import { render } from '@testing-library/react';
import type { ShareableKind } from '@/entities/shared-analysis';
import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { ShareKindPanel } from '@/widgets/share/ui/ShareKindPanel';

// ─── mock heavy widget deps so the test stays unit-level ─────────────────────
//
// Paths MUST match the imports in kindPanelRegistry.tsx (deep paths, not barrels).

vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: () => null,
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
// ShareCandlestickChart uses lightweight-charts which requires a DOM canvas;
// mock it at the widget path so kindPanelRegistry.tsx can resolve it.
vi.mock('@/widgets/chart/ShareCandlestickChart', () => ({
    ShareCandlestickChart: () => null,
}));

// ─── minimal stub results per kind ───────────────────────────────────────────

const stubResults: Record<ShareableKind, unknown> = {
    chart: { trend: 'bullish', summary: '차트 분석' },
    overall: { score: 70 },
    news: { articles: [] },
    fundamental: { metrics: {} },
    financials: { statements: {} },
    congress: { trades: [] },
    options: { chain: [] },
    'fear-greed': { value: 50 },
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('ShareKindPanel (RSC boundary dispatcher)', () => {
    /**
     * The primary regression guard:
     * Rendering `<ShareKindPanel kind={k} result={r} />` must not throw
     * "Element type is invalid" for any of the 8 kinds.
     */
    describe('renders each kind without throwing (RSC undefined-component guard)', () => {
        for (const kind of SHAREABLE_KIND_VALUES) {
            it(`<ShareKindPanel kind="${kind}" /> renders without error`, () => {
                expect(() =>
                    render(
                        <ShareKindPanel
                            kind={kind as ShareableKind}
                            result={stubResults[kind] as never}
                        />
                    )
                ).not.toThrow();
            });
        }
    });

    it('renders chart kind with chartBars prop without throwing', () => {
        const stubBars = [
            {
                time: 1700000000,
                open: 150,
                high: 155,
                low: 148,
                close: 153,
                volume: 1000000,
            },
        ];
        expect(() =>
            render(
                <ShareKindPanel
                    kind="chart"
                    result={stubResults.chart as never}
                    chartBars={stubBars}
                />
            )
        ).not.toThrow();
    });
});
