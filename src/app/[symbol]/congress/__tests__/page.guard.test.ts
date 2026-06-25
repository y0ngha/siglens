/**
 * Page-level tab guard tests for the congress page.
 *
 * Verifies that the equity-only guard (`isTabAllowedForSymbol`) runs before any
 * FMP/congress data fetch, calls `notFound()` for crypto symbols, and does NOT
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
vi.mock('@/app/[symbol]/congress/congressData', () => ({
    getCongressPageData: vi.fn(),
}));
vi.mock('@/app/[symbol]/congress/CongressDegraded', () => ({
    CongressDegraded: () => null,
}));
vi.mock('@/entities/congress-trades', () => ({
    getCongressTradesResilient: vi.fn(),
}));
vi.mock('@/widgets/congress', () => ({
    CongressTrendSummary: () => null,
    CongressTradesTable: () => null,
}));
vi.mock('@/views/symbol', () => ({
    CrossLinkCards: () => null,
    SymbolPageHeading: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    buildSymbolCongressSeoContent: vi.fn().mockReturnValue({
        title: '',
        fullTitle: '',
        description: '',
        url: '',
        keywords: [],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
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
import { notFound } from 'next/navigation';
import CongressPage, {
    generateMetadata,
    revalidate,
} from '@/app/[symbol]/congress/page';

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

describe('Congress page ISR route config', () => {
    it('exports revalidate = 86400 (literal — required for Next.js static analysis)', () => {
        // app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here)
        expect(revalidate).toBe(86400);
    });
});

describe('Congress page tab guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls notFound() for a crypto symbol (isTabAllowedForSymbol → false)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            CongressPage({ params: Promise.resolve({ symbol: 'BTCUSD' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'congress');
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
        // profile degraded = degrade branch (returns JSX, no notFound).
        mockGetProfileResilient.mockResolvedValue({
            profile: null,
            degraded: true,
        } as Awaited<ReturnType<typeof getProfileResilient>>);

        await CongressPage({ params: Promise.resolve({ symbol: 'AAPL' }) });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'congress');
        // notFound must NOT have been called (guard did not trigger).
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('guard runs BEFORE getProfileResilient (guard short-circuits first)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            CongressPage({ params: Promise.resolve({ symbol: 'BTCUSD' }) })
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
describe('Congress generateMetadata crypto NOINDEX guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('crypto symbol (isTabAllowedForSymbol → false) → returns NOINDEX_SYMBOL_METADATA', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        const result = await generateMetadata({
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'congress');
        // Must exactly match NOINDEX_SYMBOL_METADATA shape: robots index:false + canonical null.
        // A real indexable metadata object would have alternates.canonical set to a URL string.
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
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

        // getCongressTradesResilient is called after the profile gate in generateMetadata.
        // Return non-degraded so the equity path proceeds to build real metadata.
        const { getCongressTradesResilient } =
            await import('@/entities/congress-trades');
        (
            getCongressTradesResilient as MockedFunction<
                typeof getCongressTradesResilient
            >
        ).mockResolvedValue({
            trades: [],
            degraded: false,
        } as Awaited<ReturnType<typeof getCongressTradesResilient>>);

        const result = await generateMetadata({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'congress');
        // Must NOT be the hard NOINDEX sentinel object.
        // NOINDEX_SYMBOL_METADATA has { robots: { index: false, follow: false },
        //   alternates: { canonical: null } } — the sentinel returned for crypto/invalid.
        expect(result).not.toEqual(NOINDEX_SYMBOL_METADATA);
        // Equity generateMetadata does not set a robots override — the page is fully
        // indexable.  NOINDEX_SYMBOL_METADATA always has robots.index: false, so
        // checking robots is undefined is the positive falsifiable signal.
        expect(result.robots).toBeUndefined();
    });
});
