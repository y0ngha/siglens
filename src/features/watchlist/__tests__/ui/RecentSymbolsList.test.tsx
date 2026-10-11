vi.mock('@/features/watchlist/hooks/useWatchlist');
vi.mock('@/features/watchlist/hooks/useWatchlistQuote', () => ({
    useWatchlistQuote: () => ({ quote: null, isSettled: true }),
}));
vi.mock('@/shared/hooks/useInViewOnce', () => ({
    useInViewOnce: () => [vi.fn(), true],
}));
vi.mock('@/features/watchlist/ui/WatchlistToggleButton', () => ({
    WatchlistToggleButton: ({
        symbol,
        source,
    }: {
        symbol: string;
        source: string;
    }) => <button type="button">{`${symbol}:${source}`}</button>,
}));

import { render, screen, within } from '@testing-library/react';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { RecentSymbolsList } from '@/features/watchlist/ui/RecentSymbolsList';
import { LOCAL_STORAGE_RECENT_SYMBOLS_KEY } from '@/shared/lib/storageKeys';

describe('RecentSymbolsList', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.mocked(useWatchlist).mockReturnValue({
            items: [],
            has: () => false,
            toggle: vi.fn(),
            add: vi.fn(),
            remove: vi.fn(),
            isHydrated: true,
            isAtLimit: false,
            limit: 20,
            isMember: false,
            isIdentityPending: false,
        });
    });

    it('기록이 없으면 안내 문구', () => {
        render(<RecentSymbolsList />);
        expect(
            screen.getByText(/아직 둘러본 종목이 없어요/)
        ).toBeInTheDocument();
    });

    it('최근 본 순으로 종목 링크와 ☆ 담기(watchlist_page)를 그린다', () => {
        localStorage.setItem(
            LOCAL_STORAGE_RECENT_SYMBOLS_KEY,
            JSON.stringify([
                { symbol: 'AAPL', label: '애플', viewedAt: 1 },
                { symbol: 'NVDA', label: '엔비디아', viewedAt: 2 },
            ])
        );
        render(<RecentSymbolsList />);
        const rows = within(
            screen.getByRole('list', { name: '최근 본' })
        ).getAllByRole('listitem');
        expect(rows).toHaveLength(2);
        expect(
            within(rows[0]!).getByRole('link', { name: /엔비디아/ })
        ).toHaveAttribute('href', '/NVDA');
        expect(within(rows[0]!).getByRole('button')).toHaveTextContent(
            'NVDA:watchlist_page'
        );
    });
});
