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
import { ShareKindPanel } from '@/views/share/ShareKindPanel';

// Mock heavy widget deps so the test stays unit-level.
// Paths MUST match the imports in kindPanelRegistry.tsx (deep paths, not barrels).

const mockAnalysisPanel = vi.fn((_props: Record<string, unknown>) => null);
vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: (props: Record<string, unknown>) => mockAnalysisPanel(props),
}));

const mockOverallView = vi.fn((_props: Record<string, unknown>) => null);
vi.mock('@/widgets/overall/OverallView', () => ({
    OverallView: (props: Record<string, unknown>) => mockOverallView(props),
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

        it('forwards plain to AnalysisPanel for the chart kind (no double switch)', () => {
            render(
                <ShareKindPanel
                    kind="chart"
                    result={stubResults.chart as never}
                    symbol="AAPL"
                    plain="차트를 쉬운 말로 풀어 쓴 설명입니다."
                />
            );
            expect(mockAnalysisPanel).toHaveBeenCalledWith(
                expect.objectContaining({
                    plain: '차트를 쉬운 말로 풀어 쓴 설명입니다.',
                })
            );
        });
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

    /**
     * Regression guard for Blocker A — assetClass must flow from ShareKindPanel
     * down to OverallView so crypto shares suppress equity-only sections.
     *
     * Without the fix, `overall` registry entry ignored assetClass and
     * OverallView always received its default ('equity'), causing
     * Options/Fundamental/Financials sections to appear on crypto overall shares.
     */
    describe('overall panel: assetClass forwarded to OverallView', () => {
        beforeEach(() => {
            mockOverallView.mockClear();
        });

        it('passes assetClass="crypto" to OverallView when specified', () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="crypto"
                />
            );
            expect(mockOverallView).toHaveBeenCalledTimes(1);
            expect(mockOverallView).toHaveBeenCalledWith(
                expect.objectContaining({ assetClass: 'crypto' })
            );
        });

        it('passes assetClass="equity" to OverallView when specified', () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="equity"
                />
            );
            expect(mockOverallView).toHaveBeenCalledWith(
                expect.objectContaining({ assetClass: 'equity' })
            );
        });

        it('passes assetClass=undefined to OverallView when omitted', () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                />
            );
            expect(mockOverallView).toHaveBeenCalledWith(
                expect.objectContaining({ assetClass: undefined })
            );
        });
    });

    /**
     * Regression guard (SEO audit finding 2, 2026-08-18) — this is the second
     * call site of the same defect the assetClass tests above cover: the
     * `overall` registry entry rendered `<OverallView>` with no `hasOptions`,
     * so a shared kr-equity overall analysis (assetClass 'equity', no options
     * tab) fell through to the default `true` and rendered a bogus "옵션 시장"
     * section. `OverallView.hasOptions` is now required, so the registry must
     * derive it from the `symbol` already threaded through this dispatcher
     * (same prop the `chart` entry uses). 파생은 `isKrEquitySymbol`을 직접
     * 부르지 않고 `profileIdForSymbol` → `getDescriptor(...).tabs`를 탄다 —
     * 여기서 형상 판정을 다시 쓰면 "옵션 탭이 있는가"의 세 번째 독립 파생이
     * 되어 프로필 설정과 조용히 갈라진다(kindPanelRegistry.tsx JSDoc 참고).
     */
    describe('overall panel: hasOptions derived from symbol (SEO audit finding 2)', () => {
        beforeEach(() => {
            mockOverallView.mockClear();
        });

        it('passes hasOptions=false to OverallView for a kr-equity symbol', () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="equity"
                    symbol="005930.KS"
                />
            );
            expect(mockOverallView).toHaveBeenCalledWith(
                expect.objectContaining({ hasOptions: false })
            );
        });

        it('passes hasOptions=true to OverallView for a us-equity symbol', () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="equity"
                    symbol="AAPL"
                />
            );
            expect(mockOverallView).toHaveBeenCalledWith(
                expect.objectContaining({ hasOptions: true })
            );
        });

        // 모르는 상태를 `true`로 열면 존재하지 않는 옵션 섹션이 뜬다 — 이 감사가
        // 두 라운드 연속 잡아낸 실패 방향이다. 숨기는 쪽이 틀려도 대가가 작다.
        it('symbol이 없으면 hasOptions=false — 모를 때는 숨긴다', () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="equity"
                />
            );
            expect(mockOverallView).toHaveBeenCalledWith(
                expect.objectContaining({ hasOptions: false })
            );
        });

        // 뮤테이션 감사(2026-08-18) — `symbol !== undefined` 하나로만 게이트하면
        // `symbol=''`은 undefined가 아니므로 게이트를 통과해
        // `profileIdForSymbol('')`(us-equity로 폴백)까지 흘러 hasOptions=true로
        // 열린다. 빈 문자열은 "심볼 없음"과 같은 실패 형태(모르는 상태)이므로
        // undefined와 동일하게 숨겨야 한다 — 위 "symbol이 없으면" 케이스와 같은
        // 결론을 빈 문자열에도 고정한다.
        it('symbol이 빈 문자열이면 hasOptions=false — undefined와 동일하게 숨긴다', () => {
            render(
                <ShareKindPanel
                    kind="overall"
                    result={stubResults.overall as never}
                    assetClass="equity"
                    symbol=""
                />
            );
            expect(mockOverallView).toHaveBeenCalledWith(
                expect.objectContaining({ hasOptions: false })
            );
        });
    });
});
