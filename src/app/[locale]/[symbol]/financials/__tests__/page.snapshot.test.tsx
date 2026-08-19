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
vi.mock('@/app/[locale]/[symbol]/fundamental/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/financials/financialData', () => ({
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
vi.mock('@/app/[locale]/[symbol]/financials/FinancialsDegraded', () => ({
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
import FinancialsPage from '@/app/[locale]/[symbol]/financials/page';
import { FinancialsSnapshotProse } from '@/views/symbol/snapshot/renderers/FinancialsSnapshotProse';
import { FinancialsAiSummary } from '@/widgets/financials/FinancialsAiSummary';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[locale]/[symbol]/fundamental/getProfileResilient';
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

const KR_ASSET_INFO = {
    assetInfo: {
        symbol: '005930.KS',
        name: 'Samsung Electronics',
        koreanName: '삼성전자',
        fmpSymbol: undefined,
        marketProfile: 'kr-equity' as const,
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

    it('스냅샷 있으면 FinancialsSnapshotProse를 렌더하고, 중복되는 AI 위젯(FinancialsAiSummary)은 hideView로 UI만 끈다 (audit fix FIX 2)', async () => {
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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
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
        const widget = findElementByType(tree, FinancialsAiSummary);
        expect(widget).not.toBeNull();
        expect(widget?.props).toMatchObject({ hideView: true });
    });

    it('스냅샷 없으면(빈 배열) FinancialsSnapshotProse 대신 FinancialsAiSummary(AI 위젯)를 렌더한다 (audit fix FIX 2)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const tree = await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findElementByType(tree, FinancialsSnapshotProse)).toBeNull();
        expect(findElementByType(tree, FinancialsAiSummary)).not.toBeNull();
    });

    it('getSeoSnapshotsStatic은 페이지의 revalidate 리터럴(86400)로 호출된다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const degradedEl = tree as unknown as {
            props: { snapshotContent: unknown };
        };
        expect(degradedEl.props.snapshotContent).toEqual(SNAPSHOT_CONTENT);
    });
});

/**
 * 회귀 가드(SEO 감사 finding 4, 2026-08-18): `CrossLinkCards`는 `marketProfile`을
 * 안 받으면 `'us-equity'` 기본값으로 떨어져, 한국 종목 페이지에도 존재하지 않는
 * `/options`·`/congress` 링크(soft-404: notFound()가 Suspense 안이라 200 반환 —
 * `e2e/specs/kr-equity-seo.spec.ts`)를 노출했다. 페이지가 계산한 marketProfile이
 * 정상 분기와 두 degrade 분기(profileDegraded/all-empty) 모두
 * `CrossLinkCards`/`FinancialsDegraded`에 그대로 전달되는지 pin한다 — hrefs
 * 자체는 `CrossLinkCards.test.tsx`의 tabs whitelist 테스트가 이미 검증한다.
 */
describe('FinancialsPage — marketProfile 전달 (SEO 감사 finding 4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        mockIsEmptyFinancialsSnapshot.mockReturnValue(false);
    });

    it('한국 종목은 CrossLinkCards에 marketProfile="kr-equity"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);

        const tree = await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: '005930.ks' }),
        });

        const links = findElementByType(tree, CrossLinkCards);
        expect((links?.props as { marketProfile?: string }).marketProfile).toBe(
            'kr-equity'
        );
    });

    it('미국 종목은 CrossLinkCards에 marketProfile="us-equity"를 전달한다 (회귀 아님 확인)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);

        const tree = await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const links = findElementByType(tree, CrossLinkCards);
        expect((links?.props as { marketProfile?: string }).marketProfile).toBe(
            'us-equity'
        );
    });

    it('profile degraded 분기에서도 한국 종목은 FinancialsDegraded에 marketProfile="kr-equity"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_DEGRADED);

        const tree = await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: '005930.ks' }),
        });

        const degradedEl = tree as unknown as {
            props: { marketProfile?: string };
        };
        expect(degradedEl.props.marketProfile).toBe('kr-equity');
    });

    it('all-empty financials snapshot 분기에서도 한국 종목은 FinancialsDegraded에 marketProfile="kr-equity"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);
        mockIsEmptyFinancialsSnapshot.mockReturnValue(true);

        const tree = await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: '005930.ks' }),
        });

        const degradedEl = tree as unknown as {
            props: { marketProfile?: string };
        };
        expect(degradedEl.props.marketProfile).toBe('kr-equity');
    });
});
