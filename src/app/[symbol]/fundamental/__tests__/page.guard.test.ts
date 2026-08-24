/**
 * Page-level tab guard tests for the fundamental page.
 *
 * Verifies that the equity-only guard (`isTabAllowedForSymbol`) runs before any
 * FMP/profile data fetch, calls `notFound()` for crypto symbols, and does NOT
 * call it for equity symbols. The full page body is not exercised — this is a
 * guard-ordering test, not a render test.
 */

// vi.mock calls are hoisted above imports by vitest.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn(),
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));
vi.mock('@/app/[symbol]/fundamental/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[symbol]/fundamental/fundamentalData', () => ({
    getAnalystEstimates: vi.fn(),
    getCashFlowStatement: vi.fn(),
    getFinancialScores: vi.fn(),
    getGradesConsensus: vi.fn(),
    getIncomeStatementGrowth: vi.fn(),
    getKeyMetricsTtm: vi.fn(),
    getPriceTargetConsensus: vi.fn(),
    getPriceTargetSummary: vi.fn(),
    getProfile: vi.fn(),
    getProfileDescriptionKo: vi.fn(),
    getRatiosTtm: vi.fn(),
    getStockPeers: vi.fn(),
}));
vi.mock('@/app/[symbol]/fundamental/FundamentalDegraded', () => ({
    FundamentalDegraded: () => null,
}));
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(),
}));
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));
// Widget mocks to avoid deep import chains.
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
    SymbolPageHeading: () => null,
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

import {
    describe,
    expect,
    it,
    beforeEach,
    vi,
    type MockedFunction,
} from 'vitest';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { notFound } from 'next/navigation';
import FundamentalPage, {
    generateMetadata,
    revalidate,
} from '@/app/[symbol]/fundamental/page';

const mockIsTabAllowed = isTabAllowedForSymbol as MockedFunction<
    typeof isTabAllowedForSymbol
>;
const mockNotFound = notFound as MockedFunction<typeof notFound>;
const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockGetProfileResilient = getProfileResilient as MockedFunction<
    typeof getProfileResilient
>;
const mockGetSeoSnapshotsStatic = getSeoSnapshotsStatic as MockedFunction<
    typeof getSeoSnapshotsStatic
>;

describe('Fundamental page ISR route config', () => {
    it('exports revalidate = 86400 (literal — required for Next.js static analysis)', () => {
        // app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here)
        expect(revalidate).toBe(86400);
    });
});

describe('Fundamental page tab guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls notFound() for a crypto symbol (isTabAllowedForSymbol → false)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            FundamentalPage({ params: Promise.resolve({ symbol: 'BTCUSD' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'fundamental');
        expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('does not call notFound() from the guard for an equity symbol (isTabAllowedForSymbol → true)', async () => {
        mockIsTabAllowed.mockResolvedValue(true);
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as Awaited<ReturnType<typeof getAssetInfoResilient>>);
        // profile degraded = degrade branch (returns JSX, no notFound). This is the
        // simplest path past the guard that does not require full widget rendering.
        mockGetProfileResilient.mockResolvedValue({
            profile: null,
            degraded: true,
        } as Awaited<ReturnType<typeof getProfileResilient>>);

        await FundamentalPage({ params: Promise.resolve({ symbol: 'AAPL' }) });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'fundamental');
        // notFound must NOT have been called (guard did not trigger).
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('guard runs BEFORE getProfileResilient (guard short-circuits first)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            FundamentalPage({ params: Promise.resolve({ symbol: 'BTCUSD' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        // getProfileResilient must NOT have been called — the guard prevented it.
        expect(mockGetProfileResilient).not.toHaveBeenCalled();
    });
});

/**
 * generateMetadata must mirror the page body's isTabAllowedForSymbol guard.
 * Without it, a crypto symbol would have canonical + index:true metadata while
 * the page body returns notFound() (noindex) — creating a soft-404 mismatch.
 */
describe('Fundamental generateMetadata crypto NOINDEX guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('crypto symbol (isTabAllowedForSymbol → false) → returns NOINDEX_SYMBOL_METADATA', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        const result = await generateMetadata({
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'fundamental');
        // noindex 계약: robots index:false + canonical null. 상수와의 동등성이
        // 아니라 계약을 단언한다 — 2026-08-24부터 이 분기는 심볼 고유
        // title/description/og:url을 함께 낸다(`noindexSymbolMetadata`). 상수
        // 동등성으로 두면 "루트 레이아웃 메타 상속" 회귀를 영영 못 잡는다.
        expect(result.robots).toEqual(NOINDEX_SYMBOL_METADATA.robots);
        expect(result.alternates).toEqual(NOINDEX_SYMBOL_METADATA.alternates);
        expect(result.title).toEqual({
            absolute: expect.stringContaining('BTCUSD'),
        });
    });

    it('equity symbol (isTabAllowedForSymbol → true) → returns indexable metadata (not NOINDEX)', async () => {
        mockIsTabAllowed.mockResolvedValue(true);

        // Provide assetInfo + profile so generateMetadata can build real metadata content.
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as Awaited<ReturnType<typeof getAssetInfoResilient>>);
        mockGetProfileResilient.mockResolvedValue({
            profile: { sector: 'Technology', description: '' },
            degraded: false,
        } as Awaited<ReturnType<typeof getProfileResilient>>);

        const result = await generateMetadata({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'fundamental');
        // Must NOT be the hard NOINDEX sentinel object.
        // NOINDEX_SYMBOL_METADATA has { robots: { index: false, follow: true },
        //   alternates: { canonical: null } } — the sentinel returned for crypto/invalid.
        //   `canonical: null` (not follow) is what separates it from an indexable
        //   page: every noindex branch now keeps follow:true so crawl paths to the
        //   sibling tabs survive.
        expect(result).not.toEqual(NOINDEX_SYMBOL_METADATA);
        // Equity generateMetadata does not set a robots override — the page is fully
        // indexable.  NOINDEX_SYMBOL_METADATA always has robots.index: false, so
        // checking robots is undefined is the positive falsifiable signal.
        expect(result.robots).toBeUndefined();
    });
});

/**
 * spec 2026-07-24 Task 8 — generateMetadata should use the pre-warmed
 * snapshot's `overallConclusionKo` prose as the <meta name="description">
 * when a fundamental snapshot row exists, falling back to the (here empty
 * per the seo mock) templated description otherwise.
 */
describe('Fundamental generateMetadata snapshot-derived description', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsTabAllowed.mockResolvedValue(true);
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as Awaited<ReturnType<typeof getAssetInfoResilient>>);
        mockGetProfileResilient.mockResolvedValue({
            profile: { sector: 'Technology', description: '' },
            degraded: false,
        } as Awaited<ReturnType<typeof getProfileResilient>>);
    });

    it('uses the snapshot overallConclusionKo when a fundamental snapshot row exists', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'fundamental',
                content: {
                    overallConclusionKo:
                        'PER은 업종 평균 대비 높지만 성장성이 이를 상쇄합니다.',
                },
                model: 'deepseek-v4-flash',
                generatedAt: new Date(),
                updatedAt: new Date(),
            },
        ] as Awaited<ReturnType<typeof getSeoSnapshotsStatic>>);

        const result = await generateMetadata({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        // FIX 5 (audit): description is prefixed with the resolved display
        // name (subject; buildDisplayName is mocked to 'Apple Inc.' above)
        // before clamping.
        expect(result.description).toBe(
            'Apple Inc. — PER은 업종 평균 대비 높지만 성장성이 이를 상쇄합니다.'
        );
    });

    it('falls back to the templated description when no fundamental snapshot exists', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const result = await generateMetadata({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        // The seo mock in this file stubs buildSymbolFundamentalSeoContent to
        // return description: '' — asserting that value confirms the templated
        // path (not the snapshot path) was taken.
        expect(result.description).toBe('');
    });
});
