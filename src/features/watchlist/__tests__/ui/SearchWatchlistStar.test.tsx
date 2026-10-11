vi.mock('@/features/watchlist/hooks/useWatchlist');
const toast = vi.hoisted(() => ({ showToast: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/shared/ui/ToastProvider', () => ({ useToast: () => toast }));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { SearchWatchlistStar } from '@/features/watchlist/ui/SearchWatchlistStar';

type Watchlist = ReturnType<typeof useWatchlist>;

function setWatchlist(outcome: 'added' | 'removed'): Watchlist {
    const value: Watchlist = {
        items: [],
        has: () => outcome === 'removed',
        toggle: vi.fn(async () => outcome),
        add: vi.fn(),
        remove: vi.fn(async () => true),
        isHydrated: true,
        isAtLimit: false,
        limit: 20,
        isMember: false,
        isIdentityPending: false,
    };
    vi.mocked(useWatchlist).mockReturnValue(value);
    return value;
}

describe('SearchWatchlistStar', () => {
    beforeEach(() => vi.clearAllMocks());

    it('담으면 search로 기록하고 되돌리기 토스트를 띄운다', async () => {
        const wl = setWatchlist('added');
        const user = userEvent.setup();
        render(
            <SearchWatchlistStar symbol="NVDA" label="엔비디아" focusable />
        );
        await user.click(
            screen.getByRole('button', { name: '관심종목: 엔비디아' })
        );
        expect(wl.toggle).toHaveBeenCalledWith(
            { symbol: 'NVDA', label: '엔비디아' },
            'search'
        );
        const shown = toast.showToast.mock.calls.at(-1)?.[0];
        expect(shown.message).toBe('관심종목에 담았어요');
        expect(shown.action.label).toBe('되돌리기');
        shown.action.onAction();
        expect(wl.remove).toHaveBeenCalledWith('NVDA');
    });

    it('뺄 때는 토스트를 띄우지 않는다', async () => {
        setWatchlist('removed');
        const user = userEvent.setup();
        render(
            <SearchWatchlistStar symbol="NVDA" label="엔비디아" focusable />
        );
        await user.click(screen.getByRole('button'));
        expect(toast.showToast).not.toHaveBeenCalled();
    });

    it('자동완성용(focusable=false)은 Tab 정지점이 아니다', () => {
        setWatchlist('added');
        render(
            <SearchWatchlistStar
                symbol="NVDA"
                label="엔비디아"
                focusable={false}
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1');
    });
});
