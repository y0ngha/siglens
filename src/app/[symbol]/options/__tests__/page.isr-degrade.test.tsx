/**
 * ISR empty-cache prevention tests for the options page.
 *
 * A transient throw from hasOptionsMarket or fetchOptionsSnapshot during ISR
 * cold-gen must NOT propagate — it must degrade to OptionsEmptyState (a
 * non-empty, non-0-byte page) rather than freezing an empty ISR cache.
 *
 * Strategy: invoke the RSC directly (no DOM render), confirm OptionsEmptyState
 * is in the returned element tree by its type name, and confirm no throw
 * escapes the page. Mirrors page.guard.test.ts mocking pattern.
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
vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(),
    hasOptionsMarket: vi.fn(),
}));
// staticSymbolCache: call fetcher() directly so tests stay pure (no I/O).
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));
vi.mock('@/widgets/options/OptionsPageClient', () => ({
    OptionsPageClient: () => null,
}));
vi.mock('@/widgets/options/OptionsEmptyState', () => ({
    OptionsEmptyState: ({ symbol }: { symbol: string }) => (
        <section data-testid="options-empty-state" data-symbol={symbol} />
    ),
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
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

import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import OptionsPage from '@/app/[symbol]/options/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import {
    hasOptionsMarket,
    fetchOptionsSnapshot,
} from '@/entities/options-chain/lib/optionsDataCache';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockHasOptionsMarket = hasOptionsMarket as MockedFunction<
    typeof hasOptionsMarket
>;
const mockFetchOptionsSnapshot = fetchOptionsSnapshot as MockedFunction<
    typeof fetchOptionsSnapshot
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

/**
 * Walk the JSX tree and find an element whose type's `name` matches `fnName`.
 * Used to detect `<OptionsEmptyState>` in the RSC output without triggering a
 * real render (the section component returns JSX but hasn't been called yet).
 */
function findByComponentName(node: ReactNode, fnName: string): boolean {
    if (Array.isArray(node)) {
        return node.some(n => findByComponentName(n, fnName));
    }
    if (!isValidElement(node)) return false;
    const t = node.type as { name?: string } | string;
    if (typeof t === 'function' && (t as { name?: string }).name === fnName) {
        return true;
    }
    const props = node.props as { children?: ReactNode };
    return findByComponentName(props.children, fnName);
}

describe('Options page ISR empty-cache prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
    });

    it('hasOptionsMarket throw → page does not throw, renders OptionsEmptyState', async () => {
        // Simulate transient Yahoo infra failure during ISR cold-gen.
        mockHasOptionsMarket.mockRejectedValue(
            new Error('Yahoo infra timeout')
        );

        // Must NOT reject — the .catch(() => false) in the page body must absorb the throw.
        const tree = await OptionsPage({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        // The page must return OptionsEmptyState (non-empty, non-0-byte result).
        expect(findByComponentName(tree, 'OptionsEmptyState')).toBe(true);
    });

    it('fetchOptionsSnapshot throw → page does not throw, renders OptionsEmptyState', async () => {
        // hasOptionsMarket succeeds but snapshot fetch fails.
        mockHasOptionsMarket.mockResolvedValue(true);
        mockFetchOptionsSnapshot.mockRejectedValue(
            new Error('Yahoo snapshot unavailable')
        );

        // Must NOT reject — the .catch(() => null) in the page body must absorb the throw.
        const tree = await OptionsPage({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        // snapshot===null branch renders OptionsEmptyState — page is non-empty.
        expect(findByComponentName(tree, 'OptionsEmptyState')).toBe(true);
    });

    it('hasOptionsMarket returns false (normal no-options path) → OptionsEmptyState, fetchOptionsSnapshot NOT called', async () => {
        mockHasOptionsMarket.mockResolvedValue(false);

        const tree = await OptionsPage({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        // Normal no-options path returns OptionsEmptyState.
        expect(findByComponentName(tree, 'OptionsEmptyState')).toBe(true);
        // fetchOptionsSnapshot must NOT have been called (short-circuited by !hasOptions).
        expect(mockFetchOptionsSnapshot).not.toHaveBeenCalled();
    });

    it('hasOptionsMarket throw → console.error emitted with [OptionsPage] prefix', async () => {
        mockHasOptionsMarket.mockRejectedValue(
            new Error('Yahoo infra timeout')
        );
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await OptionsPage({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[OptionsPage] hasOptionsMarket'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('fetchOptionsSnapshot throw → console.error emitted with [OptionsPage] prefix', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);
        mockFetchOptionsSnapshot.mockRejectedValue(
            new Error('Yahoo snapshot unavailable')
        );
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await OptionsPage({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[OptionsPage] fetchOptionsSnapshot'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });
});
