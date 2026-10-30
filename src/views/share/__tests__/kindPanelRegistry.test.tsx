/**
 * kindPanelRegistry exhaustiveness, function-shape, and render tests.
 *
 * We assert:
 *  1. The registry key set exactly equals SHAREABLE_KIND_VALUES (no extras).
 *  2. Each entry is a distinct function.
 *  3. Each kind actually RENDERS without throwing (catches undefined component bugs).
 *  4. Panel widgets are loaded per kind (`next/dynamic`), never statically.
 *
 * The chart entry's own behaviour is covered by ChartSharePanel.test.tsx.
 *
 * Mock paths match the imports in kindPanelRegistry.tsx and ChartSharePanel.tsx
 * (the defining files), so each mock resolves at the same module boundary the
 * registry uses.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { SHARE_KIND_PANEL_REGISTRY } from '@/views/share/kindPanelRegistry';

vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: () => null,
}));
vi.mock('@/widgets/chart/ShareCandlestickChart', () => ({
    ShareCandlestickChart: () => null,
}));
vi.mock('@/widgets/overall/OverallView', () => ({
    OverallView: () => null,
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
    it('contains exactly the shareable kinds — no more, no less', () => {
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
        expect(new Set(fns).size).toBe(SHAREABLE_KIND_VALUES.length);
    });

    /**
     * Exercises the registry → component resolution for every kind. A component
     * import that resolves to `undefined` only fails at render time, not at a
     * typeof check: "Element type is invalid: ... but got: undefined".
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

    /**
     * 공유 링크는 kind 하나만 보여 주므로 패널 위젯을 정적으로 import하면 모든 패널과
     * `lightweight-charts`가 모든 공유 페이지 first-load에 실린다. 정적 import로 되돌려도
     * 동작은 그대로라 다른 테스트로는 잡히지 않는다.
     */
    describe('패널 위젯을 정적으로 import하지 않는다(kind별 next/dynamic)', () => {
        const readSource = (relativePath: string): string =>
            readFileSync(join(process.cwd(), relativePath), 'utf8');

        it.each([
            [
                'src/views/share/kindPanelRegistry.tsx',
                /import\('@\/widgets\/overall\/OverallView'\)/,
            ],
            [
                'src/views/share/ui/chart/ChartSharePanel.tsx',
                /import\('@\/widgets\/analysis\/AnalysisPanel'\)/,
            ],
        ])('%s', (relativePath, dynamicImport) => {
            const source = readSource(relativePath);
            expect(source).not.toMatch(/^import [^;]* from '@\/widgets\//m);
            expect(source).toMatch(dynamicImport);
        });
    });
});
