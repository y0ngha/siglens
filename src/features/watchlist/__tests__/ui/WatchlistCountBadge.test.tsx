vi.mock('@/features/watchlist/hooks/useWatchlist');

import { screen } from '@testing-library/react';
import { WatchlistCountBadge } from '@/features/watchlist/ui/WatchlistCountBadge';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

const mockUseWatchlist = vi.mocked(useWatchlist);
type Watchlist = ReturnType<typeof useWatchlist>;
const item = (symbol: string) => ({
    symbol,
    companyName: null,
    addedAt: '2026-10-09T00:00:00.000Z',
});

function setWatchlist(items: Watchlist['items'], isHydrated = true) {
    mockUseWatchlist.mockReturnValue({
        items,
        isHydrated,
        has: vi.fn(),
        toggle: vi.fn(),
        remove: vi.fn(),
        isAtLimit: false,
        limit: 50,
    } as unknown as Watchlist);
}

describe('WatchlistCountBadge', () => {
    it('하이드레이션 전엔 그리지 않는다', () => {
        setWatchlist([item('A')], false);
        const { container } = renderWithIntl(<WatchlistCountBadge />);
        expect(container).toBeEmptyDOMElement();
    });

    it('0개면 그리지 않는다', () => {
        setWatchlist([]);
        const { container } = renderWithIntl(<WatchlistCountBadge />);
        expect(container).toBeEmptyDOMElement();
    });

    it('개수를 접근 가능한 이름과 함께 그린다', () => {
        setWatchlist([item('A'), item('B'), item('C')]);
        renderWithIntl(<WatchlistCountBadge />);
        expect(screen.getByText('관심종목 3개')).toHaveClass('sr-only');
        expect(screen.getByText('3')).toHaveAttribute('aria-hidden', 'true');
    });
});
