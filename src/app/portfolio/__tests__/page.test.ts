/**
 * `/portfolio` page tests — mirrors the onboarding/account sibling pattern:
 * metadata (noindex/canonical), the `PortfolioGuard` auth redirect, the
 * holdings-driven grid (one `PositionHoldingCard` per holding, server never
 * fetches per-symbol price ranges), and the 0-holdings empty-state CTA.
 */

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/entities/portfolio/actions', () => ({
    getPortfolioHoldingsAction: vi.fn(),
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
import { getPortfolioHoldingsAction } from '@/entities/portfolio/actions';
import { PositionHoldingCard } from '@/app/portfolio/PositionHoldingCard';
import {
    metadata,
    PortfolioEmptyState,
    PortfolioGuard,
} from '@/app/portfolio/page';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import type { PortfolioHoldingView } from '@/entities/portfolio';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetPortfolioHoldingsAction = vi.mocked(getPortfolioHoldingsAction);
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

const HOLDING_AAPL: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10',
    averagePrice: '150',
    updatedAt: '2026-01-02T00:00:00.000Z',
};
const HOLDING_MSFT: PortfolioHoldingView = {
    symbol: 'MSFT',
    companyName: 'Microsoft Corp.',
    fmpSymbol: 'MSFT',
    quantity: '5',
    averagePrice: '300',
    updatedAt: '2026-01-02T00:00:00.000Z',
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
            mockGetPortfolioHoldingsAction.mockResolvedValue([]);

            await PortfolioGuard();

            expect(mockRedirect).toHaveBeenCalledWith('/login?next=/portfolio');
        });

        it('does not redirect an authenticated member', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockGetPortfolioHoldingsAction.mockResolvedValue([HOLDING_AAPL]);

            await PortfolioGuard();

            expect(mockRedirect).not.toHaveBeenCalled();
        });

        it('renders one PositionHoldingCard per holding inside the grid', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockGetPortfolioHoldingsAction.mockResolvedValue([
                HOLDING_AAPL,
                HOLDING_MSFT,
            ]);

            const tree = await PortfolioGuard();

            expect(countElementsByType(tree, PositionHoldingCard)).toBe(2);
        });

        it('passes the holding through to its card unmodified (server never fetches per-symbol ranges)', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockGetPortfolioHoldingsAction.mockResolvedValue([HOLDING_AAPL]);

            const tree = await PortfolioGuard();

            const card = findElementByType(tree, PositionHoldingCard);
            expect(card?.props).toEqual(
                expect.objectContaining({ holding: HOLDING_AAPL })
            );
        });

        it('shows the empty-state CTA (no cards) when the member has no holdings', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
            mockGetPortfolioHoldingsAction.mockResolvedValue([]);

            const tree = await PortfolioGuard();

            expect(countElementsByType(tree, PositionHoldingCard)).toBe(0);
            expect(findElementByType(tree, PortfolioEmptyState)).not.toBeNull();
        });
    });
});
