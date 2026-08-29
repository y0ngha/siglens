/**
 * SEO snapshot prose integration tests for the fundamental page — Task 7b.
 *
 * FundamentalAiSummary is a client component that fetches its analysis via a
 * client-side hook, so during ISR generation it bakes its loading skeleton
 * into the static HTML (no crawlable AI text). This suite verifies that
 * `FundamentalSnapshotProse` is mounted as a plain SSR sibling, reads the
 * snapshot with the page's exact revalidate literal (86400), and stays wired
 * through the FMP-profile-degraded branch (spec 2026-07-24 §7).
 *
 * Strategy: invoke the RSC directly (no render) and traverse the returned
 * element tree with findElementByType, mirroring page.factlayer.test.tsx /
 * overall/page.body.test.tsx.
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
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/fundamental/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/fundamental/fundamentalData', () => ({
    getAnalystEstimates: vi.fn().mockResolvedValue(null),
    getCashFlowStatement: vi.fn().mockResolvedValue(null),
    getFinancialScores: vi.fn().mockResolvedValue(null),
    getGradesConsensus: vi.fn().mockResolvedValue(null),
    getIncomeStatementGrowth: vi.fn().mockResolvedValue(null),
    getKeyMetricsTtm: vi.fn().mockResolvedValue(null),
    getPriceTargetConsensus: vi.fn().mockResolvedValue(null),
    getPriceTargetSummary: vi.fn().mockResolvedValue(null),
    getProfile: vi.fn().mockResolvedValue(null),
    getProfileDescriptionKo: vi.fn().mockResolvedValue(null),
    getRatiosTtm: vi.fn().mockResolvedValue(null),
    getStockPeers: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));
vi.mock('@/widgets/fundamental/FundamentalAiSummary', () => ({
    FundamentalAiSummary: () => null,
}));
vi.mock('@/widgets/fundamental/FundamentalAiSummaryError', () => ({
    FundamentalAiSummaryError: () => null,
}));
vi.mock('@/widgets/fundamental/FundamentalAiSummarySkeleton', () => ({
    FundamentalAiSummarySkeleton: () => null,
}));
vi.mock('@/widgets/fundamental/sections/FinancialHealthCard', () => ({
    FinancialHealthCard: () => null,
}));
vi.mock('@/widgets/fundamental/sections/FutureDirectionCard', () => ({
    FutureDirectionCard: () => null,
}));
vi.mock('@/widgets/fundamental/sections/GrowthChart', () => ({
    GrowthChart: () => null,
}));
vi.mock('@/widgets/fundamental/sections/PeersTable', () => ({
    PeersTable: () => null,
}));
vi.mock('@/widgets/fundamental/sections/ProfileCard', () => ({
    ProfileCard: () => null,
}));
vi.mock('@/widgets/fundamental/sections/ProfitabilityCard', () => ({
    ProfitabilityCard: () => null,
}));
vi.mock('@/widgets/fundamental/sections/ValuationCard', () => ({
    ValuationCard: () => null,
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/views/symbol/SectionSkeleton', () => ({
    SectionSkeleton: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    buildSymbolFundamentalSeoContent: vi.fn().mockReturnValue({
        title: '',
        fullTitle: '',
        description: '',
        url: '',
        keywords: [],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import FundamentalPage from '@/app/[locale]/[symbol]/fundamental/page';
import { FundamentalDegraded } from '@/app/[locale]/[symbol]/fundamental/FundamentalDegraded';
import { FundamentalSnapshotProse } from '@/views/symbol/snapshot/renderers/FundamentalSnapshotProse';
import { FundamentalAiSummary } from '@/widgets/fundamental/FundamentalAiSummary';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[locale]/[symbol]/fundamental/getProfileResilient';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { expectFaqSingleSource } from '@/__tests__/utils/expectFaqSingleSource';
import { expectSymbolBreadcrumbName } from '@/__tests__/utils/expectSymbolBreadcrumbName';

const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);
const mockGetProfileResilient = vi.mocked(getProfileResilient);

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
    overallConclusionKo: '밸류에이션은 업종 평균 대비 낮은 편입니다.',
    overallSentiment: 'bullish',
    categoryAssessments: [],
    riskFactorsKo: [],
};

describe('FundamentalPage — SEO snapshot prose (Task 7b)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);
    });

    it('스냅샷 있으면 FundamentalSnapshotProse를 렌더하고, 중복되는 AI 위젯(FundamentalAiSummary)은 hideView로 UI만 끈다 (audit fix FIX 2)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'fundamental',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await FundamentalPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const prose = findElementByType(tree, FundamentalSnapshotProse);
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
        const widget = findElementByType(tree, FundamentalAiSummary);
        expect(widget).not.toBeNull();
        expect(widget?.props).toMatchObject({ hideView: true });
    });

    /**
     * 회귀 가드: FAQPage 마크업과 화면 Q&A는 배열 하나에서 나와야 한다. 이 탭은
     * 오랫동안 마크업만 내보내고 화면에는 Q&A가 없었다 — 구글은 대응하는 내용이
     * 페이지에 보일 것을 요구하며, 없으면 리치 결과 자격을 잃는다. JSON-LD가
     * 유효한지만 보는 테스트로는 이 결함이 잡히지 않는다.
     */
    it('FAQPage 구조화데이터가 화면 FaqSection과 같은 질문·답변을 쓴다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        const tree = await FundamentalPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expectFaqSingleSource(tree);
    });

    /**
     * 회귀 가드: BreadcrumbList position 2는 화면 브레드크럼과 같은 이름이어야 한다.
     * 근거는 `expectSymbolBreadcrumbName` JSDoc 참고.
     */
    it('BreadcrumbList가 티커가 아니라 displayName을 쓴다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        await FundamentalPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expectSymbolBreadcrumbName('Apple Inc.');
    });

    it('스냅샷 없으면(빈 배열) FundamentalSnapshotProse 대신 FundamentalAiSummary(AI 위젯)를 렌더한다 (audit fix FIX 2)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const tree = await FundamentalPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findElementByType(tree, FundamentalSnapshotProse)).toBeNull();
        expect(findElementByType(tree, FundamentalAiSummary)).not.toBeNull();
    });

    it('다른 탭(overall)의 스냅샷은 fundamental 슬롯에 전달되지 않아 FundamentalAiSummary(AI 위젯)로 폴백한다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'overall',
                content: { headlineKo: '헤드라인' },
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await FundamentalPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findElementByType(tree, FundamentalSnapshotProse)).toBeNull();
        expect(findElementByType(tree, FundamentalAiSummary)).not.toBeNull();
    });

    it('getSeoSnapshotsStatic은 페이지의 revalidate 리터럴(86400)로 호출된다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        await FundamentalPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            86400,
            'ko'
        );
    });

    it('profile degraded 분기에서도 스냅샷 콘텐츠가 FundamentalDegraded에 전달된다(spec §7)', async () => {
        mockGetProfileResilient.mockResolvedValue(PROFILE_DEGRADED);
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'fundamental',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await FundamentalPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findElementByType(tree, FundamentalDegraded)).not.toBeNull();
        const degraded = findElementByType(tree, FundamentalDegraded);
        expect(
            (degraded?.props as { snapshotContent: unknown }).snapshotContent
        ).toEqual(SNAPSHOT_CONTENT);
    });
});

/**
 * 회귀 가드(SEO 감사 finding 4, 2026-08-18): `CrossLinkCards`는 `marketProfile`을
 * 안 받으면 `'us-equity'` 기본값으로 떨어져, 한국 종목 페이지에도 존재하지 않는
 * `/options`·`/congress` 링크(soft-404: notFound()가 Suspense 안이라 200 반환 —
 * `e2e/specs/kr-equity-seo.spec.ts`)를 노출했다. 페이지가 계산한 marketProfile이
 * 정상 분기와 degrade 분기 양쪽 모두 `CrossLinkCards`/`FundamentalDegraded`에
 * 그대로 전달되는지 pin한다 — hrefs 자체는 `CrossLinkCards.test.tsx`의 tabs
 * whitelist 테스트가 이미 검증한다.
 */
describe('FundamentalPage — marketProfile 전달 (SEO 감사 finding 4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
    });

    it('한국 종목은 CrossLinkCards에 marketProfile="kr-equity"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);

        const tree = await FundamentalPage({
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

        const tree = await FundamentalPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const links = findElementByType(tree, CrossLinkCards);
        expect((links?.props as { marketProfile?: string }).marketProfile).toBe(
            'us-equity'
        );
    });

    it('profile degraded 분기에서도 한국 종목은 FundamentalDegraded에 marketProfile="kr-equity"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_DEGRADED);

        const tree = await FundamentalPage({
            params: Promise.resolve({ locale: 'ko', symbol: '005930.ks' }),
        });

        const degraded = findElementByType(tree, FundamentalDegraded);
        expect(
            (degraded?.props as { marketProfile?: string }).marketProfile
        ).toBe('kr-equity');
    });
});
