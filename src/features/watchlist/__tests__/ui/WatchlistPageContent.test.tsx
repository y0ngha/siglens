vi.mock('@/features/watchlist/hooks/useWatchlist');
vi.mock('@/features/watchlist/ui/WatchlistSection', () => ({
    WatchlistSection: ({ sort }: { sort: string }) => (
        <div data-testid="watchlist-section">{sort}</div>
    ),
}));
vi.mock('@/features/watchlist/ui/RecentSymbolsList', () => ({
    RecentSymbolsList: () => <div data-testid="recent-list" />,
}));
const openSearch = vi.hoisted(() => vi.fn());
vi.mock('@/shared/hooks/useOpenTickerSearch', () => ({
    useOpenTickerSearch: () => openSearch,
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import {
    tabFromParam,
    WatchlistPageContent,
} from '@/features/watchlist/ui/WatchlistPageContent';

describe('tabFromParam', () => {
    it('recent만 최근 본 탭이고 나머지는 관심 탭이다', () => {
        expect(tabFromParam('recent')).toBe('recent');
        expect(tabFromParam(null)).toBe('watchlist');
        expect(tabFromParam('other')).toBe('watchlist');
    });
});

describe('WatchlistPageContent', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/watchlist');
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

    it('?tab=recent면 최근 본 탭으로 연다', () => {
        window.history.replaceState(null, '', '/watchlist?tab=recent');
        render(<WatchlistPageContent />);
        expect(screen.getByTestId('recent-list')).toBeInTheDocument();
    });

    it('탭을 바꾸면 URL에 남기고, 관심 탭으로 돌아오면 파라미터를 지운다', async () => {
        const user = userEvent.setup();
        render(<WatchlistPageContent />);
        expect(screen.getByTestId('watchlist-section')).toHaveTextContent(
            'added'
        );
        await user.click(screen.getByRole('tab', { name: '최근 본' }));
        expect(window.location.search).toBe('?tab=recent');
        expect(screen.getByTestId('recent-list')).toBeInTheDocument();
        await user.click(screen.getByRole('tab', { name: /관심/ }));
        expect(window.location.search).toBe('');
    });

    it('정렬을 바꾸면 목록에 전달한다', async () => {
        const user = userEvent.setup();
        render(<WatchlistPageContent />);
        await user.selectOptions(screen.getByLabelText('정렬'), 'change');
        expect(screen.getByTestId('watchlist-section')).toHaveTextContent(
            'change'
        );
    });

    it('종목 담기는 검색을 연다', async () => {
        const user = userEvent.setup();
        render(<WatchlistPageContent />);
        await user.click(screen.getByRole('button', { name: '종목 담기' }));
        expect(openSearch).toHaveBeenCalled();
    });
});
