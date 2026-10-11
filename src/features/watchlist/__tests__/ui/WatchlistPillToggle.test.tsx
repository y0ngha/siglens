vi.mock('@/features/watchlist/hooks/useWatchlist');

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { WatchlistPillToggle } from '@/features/watchlist/ui/WatchlistPillToggle';

type Watchlist = ReturnType<typeof useWatchlist>;

function setWatchlist(overrides: Partial<Watchlist> = {}): Watchlist {
    const value: Watchlist = {
        items: [],
        has: () => false,
        toggle: vi.fn(async () => 'added' as const),
        add: vi.fn(),
        remove: vi.fn(),
        isHydrated: true,
        isAtLimit: false,
        limit: 20,
        isMember: false,
        isIdentityPending: false,
        ...overrides,
    };
    vi.mocked(useWatchlist).mockReturnValue(value);
    return value;
}

describe('WatchlistPillToggle', () => {
    it('누르면 이 종목을 그 지점(source)으로 담는다', async () => {
        const wl = setWatchlist();
        const user = userEvent.setup();
        render(
            <WatchlistPillToggle
                symbol="AAPL"
                label="애플"
                source="home_popular"
            />
        );
        const button = screen.getByRole('button', { name: '관심종목: 애플' });
        expect(button).toHaveAttribute('aria-pressed', 'false');
        await user.click(button);
        expect(wl.toggle).toHaveBeenCalledWith(
            { symbol: 'AAPL', label: '애플' },
            'home_popular'
        );
    });

    it('담겨 있으면 눌린 상태다', () => {
        setWatchlist({ has: () => true });
        render(
            <WatchlistPillToggle
                symbol="AAPL"
                label="애플"
                source="home_popular"
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    it('하이드레이션 전에는 같은 자리에 비활성으로 그린다', () => {
        setWatchlist({ isHydrated: false });
        render(
            <WatchlistPillToggle
                symbol="AAPL"
                label="애플"
                source="home_popular"
            />
        );
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
