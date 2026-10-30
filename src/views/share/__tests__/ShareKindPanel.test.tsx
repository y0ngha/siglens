/**
 * ShareKindPanel — RSC boundary dispatcher.
 *
 * Verifies that `<ShareKindPanel kind={k} result={r} />` renders without
 * throwing for every ShareableKind value, and that snapshot fields reach the
 * kind panel.
 *
 * Why this test matters:
 *   Next.js RSC only creates client references for **named exports** of
 *   'use client' modules — an arrow function pulled out of the
 *   `SHARE_KIND_PANEL_REGISTRY` plain object by a server component resolves to
 *   `undefined` ("Element type is invalid: ... but got: undefined").
 *   `ShareKindPanel` is a named 'use client' component, so the dispatch
 *   (`SHARE_KIND_PANEL_REGISTRY[kind]`) happens inside the client boundary.
 */

import { render, waitFor } from '@testing-library/react';
import type { ShareableKind } from '@/shared/db/constants';
import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { ShareKindPanel } from '@/views/share/ShareKindPanel';

// Mock heavy widget deps so the test stays unit-level.
// Paths MUST match the imports in kindPanelRegistry.tsx / ChartSharePanel.tsx
// (the defining files).

const mockAnalysisPanel = vi.fn((_props: Record<string, unknown>) => null);
vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: (props: Record<string, unknown>) => mockAnalysisPanel(props),
}));

const mockOverallView = vi.fn((_props: Record<string, unknown>) => null);
vi.mock('@/widgets/overall/OverallView', () => ({
    OverallView: (props: Record<string, unknown>) => mockOverallView(props),
}));
vi.mock('@/widgets/news/ui/ai-summary/NewsAiSummaryView', () => ({
    NewsAiSummaryView: () => null,
}));
vi.mock('@/widgets/fundamental/ui/ai-summary/FundamentalAiSummaryView', () => ({
    FundamentalAiSummaryView: () => null,
}));
vi.mock('@/widgets/financials/ui/ai-summary/FinancialsAiSummaryView', () => ({
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
// mock it at the widget path so ChartSharePanel.tsx can resolve it.
vi.mock('@/widgets/chart/ShareCandlestickChart', () => ({
    ShareCandlestickChart: () => null,
}));

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

describe('ShareKindPanel (RSC boundary dispatcher)', () => {
    /**
     * The primary regression guard:
     * Rendering `<ShareKindPanel kind={k} result={r} />` must not throw
     * "Element type is invalid" for any kind.
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

    /**
     * 공유 링크의 쉽게보기 — 스냅샷에 `plain`이 실려 있으면 뷰어도 토글을 쓴다.
     *
     * 공유를 받은 사람은 SSE 라우트를 타지 않아 평이화를 새로 만들 수 없다.
     * 그래서 스냅샷의 산문이 화면까지 닿는지가 이 기능의 전부다.
     */
    describe('plain(쉽게보기) prose from the snapshot', () => {
        it('renders the plain prose and the view toggle when plain exists', () => {
            const { getByRole, getByText } = render(
                <ShareKindPanel
                    kind="news"
                    result={stubResults.news as never}
                    plain="주가가 오르는 흐름입니다."
                />
            );
            expect(getByText('주가가 오르는 흐름입니다.')).toBeInTheDocument();
            expect(getByRole('radiogroup')).toBeInTheDocument();
        });

        it('renders no toggle when the snapshot has no plain prose', () => {
            // 이 필드 이전에 만들어진 공유 링크. 아무것도 하지 않는 토글이
            // 뜨면 사용자는 고장으로 읽는다.
            const { queryByRole } = render(
                <ShareKindPanel
                    kind="news"
                    result={stubResults.news as never}
                />
            );
            expect(queryByRole('radiogroup')).toBeNull();
        });

        it('forwards plain to AnalysisPanel for the chart kind (no double switch)', async () => {
            render(
                <ShareKindPanel
                    kind="chart"
                    result={stubResults.chart as never}
                    symbol="AAPL"
                    plain="차트를 쉬운 말로 풀어 쓴 설명입니다."
                />
            );
            await waitFor(() =>
                expect(mockAnalysisPanel).toHaveBeenCalledWith(
                    expect.objectContaining({
                        plain: '차트를 쉬운 말로 풀어 쓴 설명입니다.',
                    })
                )
            );
        });
    });

    it('renders chart kind with chartBars prop without throwing', async () => {
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

    /**
     * assetClass must flow from ShareKindPanel down to OverallView so crypto
     * shares suppress the equity-only Options/Fundamental/Financials sections.
     */
    describe('overall panel: assetClass forwarded to OverallView', () => {
        beforeEach(() => {
            mockOverallView.mockClear();
        });

        it('passes assetClass="crypto" to OverallView when specified', async () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="crypto"
                />
            );
            await waitFor(() =>
                expect(mockOverallView).toHaveBeenCalledTimes(1)
            );
            await waitFor(() =>
                expect(mockOverallView).toHaveBeenCalledWith(
                    expect.objectContaining({ assetClass: 'crypto' })
                )
            );
        });

        it('passes assetClass="equity" to OverallView when specified', async () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="equity"
                />
            );
            await waitFor(() =>
                expect(mockOverallView).toHaveBeenCalledWith(
                    expect.objectContaining({ assetClass: 'equity' })
                )
            );
        });

        it('passes assetClass=undefined to OverallView when omitted', async () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                />
            );
            await waitFor(() =>
                expect(mockOverallView).toHaveBeenCalledWith(
                    expect.objectContaining({ assetClass: undefined })
                )
            );
        });
    });

    /**
     * The `overall` entry derives `OverallView.hasOptions` from the threaded
     * `symbol` (`shareHasOptionsTab`) — a kr-equity overall share must not render
     * an options section. Edge cases (missing/empty symbol) live in
     * shareHasOptionsTab.test.ts; this pins the wiring.
     */
    describe('overall panel: hasOptions derived from symbol', () => {
        beforeEach(() => {
            mockOverallView.mockClear();
        });

        it('passes hasOptions=false to OverallView for a kr-equity symbol', async () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="equity"
                    symbol="005930.KS"
                />
            );
            await waitFor(() =>
                expect(mockOverallView).toHaveBeenCalledWith(
                    expect.objectContaining({ hasOptions: false })
                )
            );
        });

        it('passes hasOptions=true to OverallView for a us-equity symbol', async () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="equity"
                    symbol="AAPL"
                />
            );
            await waitFor(() =>
                expect(mockOverallView).toHaveBeenCalledWith(
                    expect.objectContaining({ hasOptions: true })
                )
            );
        });
    });
});
