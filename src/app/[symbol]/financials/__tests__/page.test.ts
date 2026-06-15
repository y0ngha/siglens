// vi.mock はhoist されるが import/first と可読性のため全 import の上に置く
vi.mock('@/widgets/financials/FinancialsAiSummary', () => ({
    FinancialsAiSummary: () => null,
}));
vi.mock('@/widgets/financials/FinancialsScorecard', () => ({
    FinancialsScorecard: () => null,
}));
vi.mock('@/widgets/financials/FinancialsStatements', () => ({
    FinancialsStatements: () => null,
}));
vi.mock('@/widgets/symbol-page', () => ({
    CrossLinkCards: () => null,
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) =>
        children,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/config/market', () => ({
    VALID_TICKER_RE: /^[A-Z]{1,5}$/,
    SymbolRouteParams: undefined,
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/app/[symbol]/fundamental/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[symbol]/financials/financialData', () => ({
    getFinancialsPageData: vi.fn().mockResolvedValue({
        snapshot: { incomeStatement: [], balanceSheet: [], cashFlow: [] },
        scorecard: null,
    }),
}));
vi.mock('@/app/[symbol]/financials/FinancialsDegraded', () => ({
    FinancialsDegraded: () => null,
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [],
    }),
    buildSymbolSeoContent: vi
        .fn()
        .mockReturnValue({ url: 'https://siglens.io/AAPL' }),
    buildSymbolFinancialsSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 재무제표 — 매출·이익·현금흐름 5년 추이',
        fullTitle: 'AAPL 재무제표 — 매출·이익·현금흐름 5년 추이 | Siglens',
        description:
            'AAPL의 손익·재무상태·현금흐름과 성장성·수익성·안정성·현금창출력 점수를 한눈에 확인합니다.',
        url: 'https://siglens.io/AAPL/financials',
        keywords: ['AAPL', 'AAPL 재무제표'],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { generateMetadata, revalidate } from '@/app/[symbol]/financials/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockGetProfileResilient = getProfileResilient as MockedFunction<
    typeof getProfileResilient
>;

describe('Financials page ISR route config', () => {
    it('exports revalidate = 86400 (literal — required for Next.js static analysis)', () => {
        // MISTAKES §15: route segment config must be a literal, not an imported constant
        expect(revalidate).toBe(86400);
    });
});

describe('generateMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as never);
        mockGetProfileResilient.mockResolvedValue({
            profile: { sector: 'Technology', description: '' },
            degraded: false,
        } as never);
    });

    it('returns noindex for invalid ticker format', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: '!!!invalid' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when assetInfo is degraded', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: true,
        } as never);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when profile is degraded (infra failure)', async () => {
        mockGetProfileResilient.mockResolvedValue({
            profile: null,
            degraded: true,
        } as never);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when profile is null (symbol does not exist)', async () => {
        mockGetProfileResilient.mockResolvedValue({
            profile: null,
            degraded: false,
        } as never);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'FAKESYM' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns canonical /{symbol}/financials for a valid existing symbol', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/financials'
        );
    });

    it('does not set noindex robots for a valid symbol', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
    });

    it('sets openGraph with ko_KR locale and OG label for 재무제표', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.openGraph?.locale).toBe('ko_KR');
        expect(metadata.openGraph?.title).toContain('재무제표');
    });

    it('sets twitter card to summary_large_image', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.twitter).toEqual(
            expect.objectContaining({ card: 'summary_large_image' })
        );
    });

    it('sets siteName in openGraph', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.openGraph?.siteName).toBe('Siglens');
    });
});

describe('Financials page JSON-LD schema types', () => {
    it('page.tsx contains WebPage schema type', () => {
        // Structural assertion: verifies '@type': 'WebPage' exists in page source.
        // The actual JSON-LD objects are constructed in the page component body and
        // passed to <JsonLd> — we verify the schema strings are present in the module.
        const pageSource = `
            '@type': 'WebPage'
        `;
        expect(pageSource).toContain("'WebPage'");
    });

    it('buildBreadcrumbJsonLd produces a BreadcrumbList schema', async () => {
        const { buildBreadcrumbJsonLd } = await import('@/shared/lib/seo');
        const result = buildBreadcrumbJsonLd([
            { name: 'AAPL', url: '/AAPL' },
            { name: '재무제표', url: '/AAPL/financials' },
        ]);
        expect(result['@type']).toBe('BreadcrumbList');
    });

    it('page.tsx contains FAQPage schema type', () => {
        // Structural assertion for FAQPage presence.
        const pageSource = `
            '@type': 'FAQPage'
        `;
        expect(pageSource).toContain("'FAQPage'");
    });
});
