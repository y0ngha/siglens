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
    NOINDEX_SYMBOL_METADATA: {
        robots: { index: false, follow: false },
        alternates: { canonical: null },
    },
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { notFound } from 'next/navigation';
import OptionsPage, { revalidate } from '@/app/[symbol]/options/page';

const mockIsTabAllowed = isTabAllowedForSymbol as MockedFunction<
    typeof isTabAllowedForSymbol
>;
const mockNotFound = notFound as MockedFunction<typeof notFound>;

describe('Options page ISR route config', () => {
    it('exports revalidate = 43200 (literal — required for Next.js static analysis)', () => {
        // MISTAKES §15: route segment config must be a literal, not an imported constant
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
