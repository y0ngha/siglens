/**
 * `/portfolio` page tests — mirrors the onboarding/account sibling pattern:
 * metadata (noindex/canonical), the `PortfolioGuard` auth redirect, the
 * holdings-driven grid (one `PositionHoldingCard` per holding, server never
 * fetches per-symbol price ranges), the 0-holdings empty-state CTA, and the
 * degrade-to-error-state behavior on a transient DB read failure.
 *
 * `PortfolioGuard` reads holdings directly via `DrizzlePortfolioRepository`
 * (not `getPortfolioHoldingsAction`, which re-resolves `getCurrentUser`
 * internally — see the page's doc comment), so this mocks the repository +
 * `getDatabaseClient` the same way `src/app/privacy/__tests__/page.test.ts`
 * mocks `DrizzleTermsRepository`. `toView` is real (pure), so fixtures are
 * raw `PortfolioHoldingRecord`-shaped rows (Date `updatedAt`).
 */

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
const mockFindByUser = vi.fn();
vi.mock('@/entities/portfolio/api', () => ({
    // A plain `function` (not an arrow) — the production code calls this via
    // `new DrizzlePortfolioRepository(db)`, and arrow functions are not
    // constructible (`new (() => {})()` throws), which tinyspy surfaces as
    // "... is not a constructor" when `mockImplementation` wraps one.
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mockFindByUser };
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}));
vi.mock('@/app/portfolio/PositionHoldingCard', () => ({
    PositionHoldingCard: () => null,
}));

import { isValidElement, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { PositionHoldingCard } from '@/app/portfolio/PositionHoldingCard';
import {
    metadata,
    PortfolioEmptyState,
    PortfolioErrorState,
    PortfolioGuard,
} from '@/app/portfolio/page';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import type { PortfolioHoldingRecord } from '@/shared/db/types';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRedirect = vi.mocked(redirect);

/** findElementByType only returns the FIRST match — this counts every match in the tree (grid has N cards). */
function countElementsByType(node: ReactNode, type: unknown): number {
    if (Array.isArray(node)) {
        return node.reduce<number>(
            (sum, child) => sum + countElementsByType(child, type),
            0
        );
    }
    if (!isValidElement(node)) return 0;
    const self = node.type === type ? 1 : 0;
    const childProps = node.props as { children?: ReactNode };
    return self + countElementsByType(childProps.children, type);
}

const RECORD_AAPL: PortfolioHoldingRecord = {
    id: 'holding-1',
    userId: 'user-1',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10',
    averagePrice: '150',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};
const RECORD_MSFT: PortfolioHoldingRecord = {
    id: 'holding-2',
    userId: 'user-1',
    symbol: 'MSFT',
    companyName: 'Microsoft Corp.',
    fmpSymbol: 'MSFT',
    quantity: '5',
    averagePrice: '300',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('Portfolio page', () => {
    it('exports metadata with the portfolio title', () => {
        expect(metadata.title).toBe('내 포트폴리오 위치');
    });

    it('sets robots to noindex, nofollow', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false, follow: false })
        );
    });

    it('includes canonical URL', () => {
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/portfolio'
        );
    });

    describe('PortfolioGuard', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('redirects unauthenticated visitors to /login?next=/portfolio', async () => {
            mockGetCurrentUser.mockResolvedValue(null);
            mockFindByUser.mockResolvedValue([]);

            await PortfolioGuard();

            expect(mockRedirect).toHaveBeenCalledWith('/login?next=/portfolio');
        });

        it('resolves the session only once (does not double-call getCurrentUser)', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockFindByUser.mockResolvedValue([RECORD_AAPL]);

            await PortfolioGuard();

            expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
        });

        it('does not redirect an authenticated member', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockFindByUser.mockResolvedValue([RECORD_AAPL]);

            await PortfolioGuard();

            expect(mockRedirect).not.toHaveBeenCalled();
        });

        it('reads holdings scoped to the resolved user id', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockFindByUser.mockResolvedValue([RECORD_AAPL]);

            await PortfolioGuard();

            expect(mockFindByUser).toHaveBeenCalledWith('user-1');
        });

        it('renders one PositionHoldingCard per holding inside the grid', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockFindByUser.mockResolvedValue([RECORD_AAPL, RECORD_MSFT]);

            const tree = await PortfolioGuard();

            expect(countElementsByType(tree, PositionHoldingCard)).toBe(2);
        });

        it('passes the holding through to its card as a view (server never fetches per-symbol ranges)', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockFindByUser.mockResolvedValue([RECORD_AAPL]);

            const tree = await PortfolioGuard();

            const card = findElementByType(tree, PositionHoldingCard);
            expect(card?.props).toEqual(
                expect.objectContaining({
                    holding: expect.objectContaining({
                        symbol: 'AAPL',
                        companyName: 'Apple Inc.',
                        fmpSymbol: 'AAPL',
                        quantity: '10',
                        averagePrice: '150',
                    }),
                })
            );
        });

        it('shows the empty-state CTA (no cards) when the member has no holdings', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockFindByUser.mockResolvedValue([]);

            const tree = await PortfolioGuard();

            expect(countElementsByType(tree, PositionHoldingCard)).toBe(0);
            expect(findElementByType(tree, PortfolioEmptyState)).not.toBeNull();
        });

        it('degrades to the in-page error state (never throws to the root error boundary) when the holdings read fails', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockFindByUser.mockRejectedValue(new Error('transient DB error'));

            const tree = await PortfolioGuard();

            expect(findElementByType(tree, PortfolioErrorState)).not.toBeNull();
            expect(countElementsByType(tree, PositionHoldingCard)).toBe(0);
        });
    });
});
