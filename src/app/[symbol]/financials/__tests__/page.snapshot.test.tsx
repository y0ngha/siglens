/**
 * SEO snapshot prose integration tests for the financials page — Task 7b.
 *
 * FinancialsAiSummary is a client component that fetches its analysis via a
 * client-side hook, so during ISR generation it bakes its loading skeleton
 * into the static HTML (no crawlable AI text). This suite verifies that
 * `FinancialsSnapshotProse` is mounted as a plain SSR sibling, reads the
 * snapshot with the page's exact revalidate literal (86400), and stays wired
 * through both FMP-profile-degraded and all-empty-snapshot degraded branches
 * (spec 2026-07-24 §7).
 *
 * Strategy: invoke the RSC directly (no render) and traverse the returned
 * element tree with findElementByType.
 */

// MISTAKES §17: all vi.mock + vi.hoisted above imports.
const { mockGetSeoSnapshotsStatic } = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));
vi.mock('@/app/[symbol]/fundamental/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[symbol]/financials/financialData', () => ({
    getFinancialsPageData: vi.fn().mockResolvedValue({
        snapshot: {
            income: [{}],
            balance: [],
            cashFlow: [],
            incomeGrowth: [],
            financialGrowth: [],
            cashFlowGrowth: [],
        },
        scorecard: null,
    }),
}));
vi.mock('@/app/[symbol]/financials/FinancialsDegraded', () => ({
    FinancialsDegraded: (props: { snapshotContent?: unknown }) => (
        // Render-detectable stub — the test asserts on the mock call args, not DOM.
        <div data-testid="financials-degraded" {...props} />
    ),
}));
vi.mock('@/entities/financials-statements', () => ({
    getFinancialsSnapshot: vi.fn(),
    isEmptyFinancialsSnapshot: vi.fn().mockReturnValue(false),
}));
vi.mock('@/widgets/financials/FinancialsAiSummary', () => ({
    FinancialsAiSummary: () => null,
}));
vi.mock('@/widgets/financials/FinancialsScorecard', () => ({
    FinancialsScorecard: () => null,
}));
vi.mock('@/widgets/financials/FinancialsStatements', () => ({
    FinancialsStatements: () => null,
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    buildSymbolFinancialsSeoContent: vi.fn().mockReturnValue({
        title: '',
        fullTitle: '',
        description: '',
        url: '',
        keywords: [],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import FinancialsPage from '@/app/[symbol]/financials/page';
import { FinancialsSnapshotProse } from '@/views/symbol/snapshot/renderers/FinancialsSnapshotProse';
import { FinancialsAiSummary } from '@/widgets/financials/FinancialsAiSummary';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import { isEmptyFinancialsSnapshot } from '@/entities/financials-statements';
import { findElementByType } from '@/__tests__/utils/findElementByType';

const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);
const mockGetProfileResilient = vi.mocked(getProfileResilient);
const mockIsEmptyFinancialsSnapshot = vi.mocked(isEmptyFinancialsSnapshot);

const EQUITY_ASSET_INFO = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

const PROFILE_OK = {
    profile: { sector: 'Technology', description: 'A tech company.' },
    degraded: false,
} as Awaited<ReturnType<typeof getProfileResilient>>;

const PROFILE_DEGRADED = {
    profile: null,
    degraded: true,
} as Awaited<ReturnType<typeof getProfileResilient>>;

const SNAPSHOT_CONTENT = {
    overallConclusionKo: '현금창출력이 견조합니다.',
    overallSentiment: 'bullish',
    axisAssessments: [],
    riskFactorsKo: [],
};

describe('FinancialsPage — SEO snapshot prose (Task 7b)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);
        mockIsEmptyFinancialsSnapshot.mockReturnValue(false);
    });

    it('스냅샷 있으면 FinancialsSnapshotProse를 렌더하고, 중복되는 AI 위젯(FinancialsAiSummary)은 렌더하지 않는다 (audit fix FIX 2)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'financials',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await FinancialsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const prose = findElementByType(tree, FinancialsSnapshotProse);
        expect(prose).not.toBeNull();
        expect((prose?.props as { content: unknown }).content).toEqual(
            SNAPSHOT_CONTENT
        );
        // C3(감사): content만 확인하고 generatedAt은 확인하지 않았다 —
        // 페이지에서 `generatedAt={…}` prop을 통째로 지워도 이 테스트는
        // 여전히 그린이었다.
        expect((prose?.props as { generatedAt?: Date }).generatedAt).toEqual(
            new Date('2026-07-24')
        );
        expect(findElementByType(tree, FinancialsAiSummary)).toBeNull();
    });

    it('스냅샷 없으면(빈 배열) FinancialsSnapshotProse 대신 FinancialsAiSummary(AI 위젯)를 렌더한다 (audit fix FIX 2)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const tree = await FinancialsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(findElementByType(tree, FinancialsSnapshotProse)).toBeNull();
        expect(findElementByType(tree, FinancialsAiSummary)).not.toBeNull();
    });

    it('getSeoSnapshotsStatic은 페이지의 revalidate 리터럴(86400)로 호출된다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        await FinancialsPage({ params: Promise.resolve({ symbol: 'aapl' }) });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith('AAPL', 86400);
    });

    it('profile degraded 분기에서도 스냅샷 콘텐츠가 FinancialsDegraded에 전달된다(spec §7)', async () => {
        mockGetProfileResilient.mockResolvedValue(PROFILE_DEGRADED);
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'financials',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await FinancialsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const degradedEl = tree as unknown as {
            props: { snapshotContent: unknown };
        };
        expect(degradedEl.props.snapshotContent).toEqual(SNAPSHOT_CONTENT);
    });

    it('all-empty financials snapshot 분기에서도 스냅샷 콘텐츠가 FinancialsDegraded에 전달된다(spec §7)', async () => {
        mockIsEmptyFinancialsSnapshot.mockReturnValue(true);
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'financials',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await FinancialsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const degradedEl = tree as unknown as {
            props: { snapshotContent: unknown };
        };
        expect(degradedEl.props.snapshotContent).toEqual(SNAPSHOT_CONTENT);
    });
});
