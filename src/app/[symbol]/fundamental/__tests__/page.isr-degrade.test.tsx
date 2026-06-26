/**
 * ISR empty-cache prevention tests for the fundamental page.
 *
 * A transient throw from any FMP section loader during ISR cold-gen must NOT
 * propagate — it must degrade to the section's existing null/empty-state UI
 * while keeping the page non-empty.
 *
 * Architecture note: FundamentalPage returns a Suspense-wrapped RSC tree where
 * each section (ValuationSection, PeersSection, …) is a lazy async RSC child.
 * These children are NOT awaited when FundamentalPage() is invoked directly in
 * tests — they only execute when React's async streaming pipeline renders them.
 * Because of this, testing "loader throw → section degrade" at the RSC-call
 * level requires a different approach per layer:
 *
 *   Layer A — page body (top-level async): FundamentalPage itself awaits
 *   getProfileResilient + getAssetInfoResilient. Tests here verify that the
 *   top-level degrade guard (profile-level) works correctly.
 *
 *   Layer B — section functions (exported async RSCs): ValuationSection,
 *   PeersSection, etc. are exported from page.tsx as named exports and tested
 *   by calling them directly. staticSymbolCache is mocked to call fetcher()
 *   directly so a rejection propagates to the section's .catch() handler.
 *   Widget mocks render a visible data-testid so the degraded path (null/[]
 *   passed to the card) is assertable. This is falsifiable: removing a
 *   section's .catch() causes the test to fail with an unhandled rejection.
 *
 * Mirrors page.guard.test.ts mocking pattern.
 */

// vi.mock calls are hoisted above imports by vitest.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
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
vi.mock('@/app/[symbol]/fundamental/FundamentalDegraded', () => ({
    FundamentalDegraded: () => <div data-testid="fundamental-degraded" />,
}));
// staticSymbolCache: call fetcher() directly so tests stay pure (no I/O).
// This is the key — section functions call staticSymbolCache(..., fetcher),
// and we must route that call to the fetcher so the rejection propagates to
// the section's .catch() handler.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));
// Widget card mocks render a data-testid that reflects the data they received.
// When the section's .catch() fires, the loader returns null/[] and the card
// renders with degraded props — the testid becomes assertable in Layer B tests.
// When no .catch() fires (success path), the same mock renders the same testid
// but it still proves the section did not throw.
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
    FinancialHealthCard: ({
        ratios,
        scores,
        cashFlow,
    }: {
        ratios: unknown;
        scores: unknown;
        cashFlow: unknown;
    }) => (
        <div
            data-testid="financial-health-card"
            data-degraded={
                ratios === null && scores === null && cashFlow === null
                    ? 'true'
                    : 'false'
            }
        />
    ),
}));
vi.mock('@/widgets/fundamental/sections/FutureDirectionCard', () => ({
    FutureDirectionCard: ({
        estimates,
        grades,
        ptConsensus,
        ptSummary,
    }: {
        estimates: unknown;
        grades: unknown;
        ptConsensus: unknown;
        ptSummary: unknown;
    }) => (
        <div
            data-testid="future-direction-card"
            data-degraded={
                estimates === null &&
                grades === null &&
                ptConsensus === null &&
                ptSummary === null
                    ? 'true'
                    : 'false'
            }
        />
    ),
}));
vi.mock('@/widgets/fundamental/sections/GrowthChart', () => ({
    GrowthChart: ({ growth }: { growth: unknown }) => (
        <div
            data-testid="growth-chart"
            data-degraded={growth === null ? 'true' : 'false'}
        />
    ),
}));
vi.mock('@/widgets/fundamental/sections/PeersTable', () => ({
    PeersTable: ({ peers }: { peers: unknown[] }) => (
        <div
            data-testid="peers-table"
            data-degraded={peers.length === 0 ? 'true' : 'false'}
        />
    ),
}));
vi.mock('@/widgets/fundamental/sections/ProfileCard', () => ({
    ProfileCard: ({ profile }: { profile: unknown }) => (
        <div
            data-testid="profile-card"
            data-degraded={profile === null ? 'true' : 'false'}
        />
    ),
}));
vi.mock('@/widgets/fundamental/sections/ProfitabilityCard', () => ({
    ProfitabilityCard: ({ ratios }: { ratios: unknown }) => (
        <div
            data-testid="profitability-card"
            data-degraded={ratios === null ? 'true' : 'false'}
        />
    ),
}));
vi.mock('@/widgets/fundamental/sections/ValuationCard', () => ({
    ValuationCard: ({ metrics }: { metrics: unknown }) => (
        <div
            data-testid="valuation-card"
            data-degraded={metrics === null ? 'true' : 'false'}
        />
    ),
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
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';
import React from 'react';
import { isValidElement } from 'react';
import { render, screen } from '@testing-library/react';
import FundamentalPage, {
    ValuationSection,
    PeersSection,
    ProfitabilitySection,
    GrowthSection,
    FinancialHealthSection,
    FutureDirectionSection,
} from '@/app/[symbol]/fundamental/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import {
    getKeyMetricsTtm,
    getStockPeers,
    getRatiosTtm,
    getIncomeStatementGrowth,
    getFinancialScores,
    getCashFlowStatement,
    getAnalystEstimates,
    getGradesConsensus,
    getPriceTargetConsensus,
    getPriceTargetSummary,
} from '@/app/[symbol]/fundamental/fundamentalData';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockGetProfileResilient = getProfileResilient as MockedFunction<
    typeof getProfileResilient
>;
const mockGetKeyMetricsTtm = getKeyMetricsTtm as MockedFunction<
    typeof getKeyMetricsTtm
>;
const mockGetStockPeers = getStockPeers as MockedFunction<typeof getStockPeers>;
const mockGetRatiosTtm = getRatiosTtm as MockedFunction<typeof getRatiosTtm>;
const mockGetIncomeStatementGrowth = getIncomeStatementGrowth as MockedFunction<
    typeof getIncomeStatementGrowth
>;
const mockGetFinancialScores = getFinancialScores as MockedFunction<
    typeof getFinancialScores
>;
const mockGetCashFlowStatement = getCashFlowStatement as MockedFunction<
    typeof getCashFlowStatement
>;
const mockGetAnalystEstimates = getAnalystEstimates as MockedFunction<
    typeof getAnalystEstimates
>;
const mockGetGradesConsensus = getGradesConsensus as MockedFunction<
    typeof getGradesConsensus
>;
const mockGetPriceTargetConsensus = getPriceTargetConsensus as MockedFunction<
    typeof getPriceTargetConsensus
>;
const mockGetPriceTargetSummary = getPriceTargetSummary as MockedFunction<
    typeof getPriceTargetSummary
>;

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

describe('Fundamental page ISR empty-cache prevention — top-level guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);
    });

    it('page does not throw and returns a non-null JSX element when all loaders succeed', async () => {
        const tree = await FundamentalPage({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });
        expect(isValidElement(tree)).toBe(true);
    });
});

/**
 * Layer B: section-level ISR degrade tests.
 *
 * Each section is exported from page.tsx as a named async function. We render
 * the real section directly with staticSymbolCache mocked to call fetcher()
 * directly — so a loader rejection propagates to the section's .catch() handler.
 *
 * Widget card mocks render a data-testid with data-degraded="true" when the
 * section passes null/[] (the degrade value from .catch()). This makes each
 * test falsifiable: removing a section's .catch() causes an unhandled rejection
 * instead of a successful render with data-degraded="true".
 *
 * Falsifiability check (performed once after writing this suite):
 *   1. Temporarily remove the .catch() from ValuationSection in page.tsx.
 *   2. Run: yarn vitest run src/app/[symbol]/fundamental/__tests__/page.isr-degrade.test.tsx
 *   3. The "ValuationSection: loader throw → renders degraded card" test FAILS.
 *   4. Restore .catch() → test PASSES again. ✓
 */
describe('Fundamental page ISR empty-cache prevention — section layer (Layer B)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: all loaders succeed with safe empty values.
        mockGetKeyMetricsTtm.mockResolvedValue(null);
        mockGetStockPeers.mockResolvedValue(
            [] as Awaited<ReturnType<typeof getStockPeers>>
        );
        mockGetRatiosTtm.mockResolvedValue(null);
        mockGetIncomeStatementGrowth.mockResolvedValue(null);
        mockGetFinancialScores.mockResolvedValue(null);
        mockGetCashFlowStatement.mockResolvedValue(null);
        mockGetAnalystEstimates.mockResolvedValue(null);
        mockGetGradesConsensus.mockResolvedValue(null);
        mockGetPriceTargetConsensus.mockResolvedValue(null);
        mockGetPriceTargetSummary.mockResolvedValue(null);
    });

    it('ValuationSection: loader throw → renders degraded card (data-degraded="true"), does not throw', async () => {
        mockGetKeyMetricsTtm.mockRejectedValue(new Error('FMP 429'));
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        // Must not throw — .catch() in ValuationSection absorbs the rejection
        // and passes null to ValuationCard, which the mock renders as data-degraded="true".
        render(await ValuationSection({ symbol: 'AAPL' }));

        const card = screen.getByTestId('valuation-card');
        expect(card).toBeInTheDocument();
        expect(card.getAttribute('data-degraded')).toBe('true');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[ValuationSection]'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('PeersSection: loader throw → renders degraded card (data-degraded="true"), does not throw', async () => {
        mockGetStockPeers.mockRejectedValue(new Error('FMP peers down'));
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        render(await PeersSection({ symbol: 'AAPL' }));

        const card = screen.getByTestId('peers-table');
        expect(card).toBeInTheDocument();
        expect(card.getAttribute('data-degraded')).toBe('true');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[PeersSection]'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('ProfitabilitySection: loader throw → renders degraded card (data-degraded="true"), does not throw', async () => {
        mockGetRatiosTtm.mockRejectedValue(new Error('FMP ratios down'));
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        render(await ProfitabilitySection({ symbol: 'AAPL' }));

        const card = screen.getByTestId('profitability-card');
        expect(card).toBeInTheDocument();
        expect(card.getAttribute('data-degraded')).toBe('true');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[ProfitabilitySection]'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('GrowthSection: loader throw → renders degraded card (data-degraded="true"), does not throw', async () => {
        mockGetIncomeStatementGrowth.mockRejectedValue(
            new Error('FMP growth down')
        );
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        render(await GrowthSection({ symbol: 'AAPL' }));

        const card = screen.getByTestId('growth-chart');
        expect(card).toBeInTheDocument();
        expect(card.getAttribute('data-degraded')).toBe('true');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[GrowthSection]'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('FinancialHealthSection: all three loaders throw → renders degraded card (data-degraded="true"), does not throw', async () => {
        mockGetRatiosTtm.mockRejectedValue(new Error('ratios down'));
        mockGetFinancialScores.mockRejectedValue(new Error('scores down'));
        mockGetCashFlowStatement.mockRejectedValue(new Error('cashflow down'));
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        render(await FinancialHealthSection({ symbol: 'AAPL' }));

        const card = screen.getByTestId('financial-health-card');
        expect(card).toBeInTheDocument();
        expect(card.getAttribute('data-degraded')).toBe('true');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[FinancialHealthSection] getRatiosTtm'),
            expect.any(Error)
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[FinancialHealthSection] getFinancialScores'
            ),
            expect.any(Error)
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[FinancialHealthSection] getCashFlowStatement'
            ),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('FutureDirectionSection: all four loaders throw → renders degraded card (data-degraded="true"), does not throw', async () => {
        mockGetAnalystEstimates.mockRejectedValue(new Error('estimates down'));
        mockGetGradesConsensus.mockRejectedValue(new Error('grades down'));
        mockGetPriceTargetConsensus.mockRejectedValue(
            new Error('pt-consensus down')
        );
        mockGetPriceTargetSummary.mockRejectedValue(
            new Error('pt-summary down')
        );
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        render(await FutureDirectionSection({ symbol: 'AAPL' }));

        const card = screen.getByTestId('future-direction-card');
        expect(card).toBeInTheDocument();
        expect(card.getAttribute('data-degraded')).toBe('true');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[FutureDirectionSection] getAnalystEstimates'
            ),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('success path — all loaders succeed → cards receive real data (data-degraded="false"), no throw', async () => {
        // Override defaults with non-null values to prove the success path.
        const fakeMetrics = { peRatioTTM: 30 };
        mockGetKeyMetricsTtm.mockResolvedValue(
            fakeMetrics as Awaited<ReturnType<typeof getKeyMetricsTtm>>
        );
        // Use a non-empty array cast through unknown to avoid needing full peer shape.
        mockGetStockPeers.mockResolvedValue([
            { symbol: 'MSFT' },
        ] as unknown as Awaited<ReturnType<typeof getStockPeers>>);

        render(await ValuationSection({ symbol: 'AAPL' }));
        expect(
            screen.getByTestId('valuation-card').getAttribute('data-degraded')
        ).toBe('false');

        render(await PeersSection({ symbol: 'AAPL' }));
        expect(
            screen.getByTestId('peers-table').getAttribute('data-degraded')
        ).toBe('false');
    });
});
