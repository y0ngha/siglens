/**
 * Page-level tab guard tests for the options page.
 *
 * Verifies that the equity-only guard (`isTabAllowedForSymbol`) runs before any
 * FMP/options data fetch, calls `notFound()` for crypto symbols, and does NOT
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
        // Simulate the Next.js notFound() control-flow throw so the page body stops.
        throw new Error('NEXT_NOT_FOUND');
    }),
}));
// Heavy page-body dependencies — mock to prevent import-time side effects.
vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(),
    hasOptionsMarket: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/widgets/options/OptionsPageClient', () => ({
    OptionsPageClient: () => null,
}));
vi.mock('@/widgets/options/OptionsEmptyState', () => ({
    OptionsEmptyState: () => null,
}));
vi.mock('@/widgets/symbol-page', () => ({
    SymbolPageHeading: () => null,
    CrossLinkCards: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@y0ngha/siglens-core', () => ({
    mapExpirationsToSlots: vi.fn().mockReturnValue([]),
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    buildSymbolOptionsSeoContent: vi.fn().mockReturnValue({
        title: '',
        fullTitle: '',
        description: '',
        url: '',
        keywords: [],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { notFound } from 'next/navigation';
import OptionsPage, {
    generateMetadata,
    revalidate,
} from '@/app/[symbol]/options/page';

const mockIsTabAllowed = isTabAllowedForSymbol as MockedFunction<
    typeof isTabAllowedForSymbol
>;
const mockNotFound = notFound as MockedFunction<typeof notFound>;

describe('Options page ISR route config', () => {
    it('exports revalidate = 43200 (literal — required for Next.js static analysis)', () => {
        // app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here)
        expect(revalidate).toBe(43200);
    });
});

describe('Options page tab guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls notFound() for a crypto symbol (isTabAllowedForSymbol → false)', async () => {
        // Guard returns false = crypto symbol that does not support the options tab.
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            OptionsPage({ params: Promise.resolve({ symbol: 'BTCUSD' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'options');
        expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('does not call notFound() from the guard for an equity symbol (isTabAllowedForSymbol → true)', async () => {
        // Guard returns true = equity symbol, proceed past the guard.
        // Downstream calls may still notFound() (e.g. assetInfo null), but that
        // is NOT the guard. We only assert the guard itself does not trigger it.
        mockIsTabAllowed.mockResolvedValue(true);

        // getAssetInfoResilient and staticSymbolCache are already mocked to return
        // safe defaults that prevent a downstream notFound. We just need to confirm
        // the guard path itself didn't call it.
        const { getAssetInfoResilient } = await import('@/entities/ticker');
        (
            getAssetInfoResilient as MockedFunction<
                typeof getAssetInfoResilient
            >
        ).mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as Awaited<ReturnType<typeof getAssetInfoResilient>>);

        // hasOptionsMarket returns false → OptionsEmptyState branch (early return, no
        // further async that could throw). This is the simplest path past the guard.
        await OptionsPage({ params: Promise.resolve({ symbol: 'AAPL' }) });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'options');
        // notFound must NOT have been called (guard did not trigger).
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('guard runs BEFORE hasOptionsMarket (guard short-circuits first)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);
        const { staticSymbolCache } =
            await import('@/shared/cache/staticSymbolCache');
        const mockCache = staticSymbolCache as MockedFunction<
            typeof staticSymbolCache
        >;

        await expect(
            OptionsPage({ params: Promise.resolve({ symbol: 'BTCUSD' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        // The cache (which wraps hasOptionsMarket) must NOT have been called —
        // the guard ran first and threw notFound, preventing further execution.
        expect(mockCache).not.toHaveBeenCalled();
    });
});

/**
 * generateMetadata must mirror the page body's isTabAllowedForSymbol guard.
 * Without it, a crypto symbol would have canonical + index:true metadata while
 * the page body returns notFound() (noindex) — creating a soft-404 mismatch.
 */
describe('Options generateMetadata crypto NOINDEX guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('crypto symbol (isTabAllowedForSymbol → false) → returns NOINDEX_SYMBOL_METADATA', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        const result = await generateMetadata({
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'options');
        // Must exactly match NOINDEX_SYMBOL_METADATA shape: robots index:false + canonical null.
        // A real indexable metadata object would have alternates.canonical set to a URL string.
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });

    it('equity symbol (isTabAllowedForSymbol → true) → returns indexable metadata (not NOINDEX)', async () => {
        mockIsTabAllowed.mockResolvedValue(true);

        // Provide assetInfo so generateMetadata can build real metadata content.
        const { getAssetInfoResilient } = await import('@/entities/ticker');
        (
            getAssetInfoResilient as MockedFunction<
                typeof getAssetInfoResilient
            >
        ).mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as Awaited<ReturnType<typeof getAssetInfoResilient>>);

        const result = await generateMetadata({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'options');
        // Must NOT be the hard NOINDEX sentinel object.
        // NOINDEX_SYMBOL_METADATA has { robots: { index: false, follow: false },
        //   alternates: { canonical: null } } — the sentinel returned for crypto/invalid.
        expect(result).not.toEqual(NOINDEX_SYMBOL_METADATA);
        // The equity path with hasOptionsMarket:false (our mock) sets
        // robots: { index: false, follow: true } — links are still crawlable.
        // follow:true is the positive falsifiable signal: NOINDEX_SYMBOL_METADATA
        // has follow:false, and no other equity branch sets follow:false.
        const robots = result.robots as
            | { index?: boolean; follow?: boolean }
            | undefined;
        expect(robots?.follow).toBe(true);
    });
});
