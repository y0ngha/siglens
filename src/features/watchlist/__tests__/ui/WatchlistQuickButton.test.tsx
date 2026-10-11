const quote = vi.hoisted(() => ({ useWatchlistQuote: vi.fn() }));
vi.mock('@/features/watchlist/hooks/useWatchlist');
vi.mock('@/features/watchlist/hooks/useWatchlistQuote', () => quote);
vi.mock('next/dynamic', () => ({
    default: () =>
        function SheetStub({ open }: { open: boolean }) {
            return open ? <div data-testid="watchlist-sheet" /> : null;
        },
}));

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { WatchlistQuickButton } from '@/features/watchlist/ui/WatchlistQuickButton';
import { WATCHLIST_PREVIEW_COUNT } from '@/shared/config/watchlist';
import { LOCAL_STORAGE_RECENT_SYMBOLS_KEY } from '@/shared/lib/storageKeys';

type Watchlist = ReturnType<typeof useWatchlist>;

function setWatchlist(symbols: string[], overrides: Partial<Watchlist> = {}) {
    vi.mocked(useWatchlist).mockReturnValue({
        items: symbols.map(symbol => ({
            symbol,
            companyName: `${symbol} Inc.`,
            addedAt: '2026-10-11T00:00:00.000Z',
        })),
        has: () => true,
        toggle: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        isHydrated: true,
        isAtLimit: false,
        limit: 20,
        isMember: false,
        isIdentityPending: false,
        ...overrides,
    });
}

function setViewport(belowLg: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: belowLg,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

describe('WatchlistQuickButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        quote.useWatchlistQuote.mockReturnValue({
            quote: { price: 100, changePct: 2, trend: [98, 100] },
            isSettled: true,
        });
        setViewport(false);
    });

    it('담은 개수를 라벨에 싣고, 하이드레이션 전에는 개수를 말하지 않는다', () => {
        setWatchlist(['AAPL', 'NVDA']);
        const { rerender } = render(<WatchlistQuickButton />);
        expect(
            screen.getByRole('button', { name: '관심종목 열기, 2개' })
        ).toHaveAttribute('aria-expanded', 'false');
        setWatchlist([], { isHydrated: false });
        rerender(<WatchlistQuickButton />);
        expect(
            screen.getByRole('button', { name: '관심종목 열기' })
        ).toBeInTheDocument();
    });

    it('PC에서는 팝오버로 열고, 행은 종목 링크이며 최대 개수까지만 그린다', async () => {
        const many = Array.from(
            { length: WATCHLIST_PREVIEW_COUNT + 2 },
            (_, i) => `S${i}`
        );
        setWatchlist(many);
        const user = userEvent.setup();
        render(<WatchlistQuickButton />);
        await user.click(screen.getByRole('button', { name: /관심종목 열기/ }));
        const dialog = screen.getByRole('dialog', { name: '관심종목' });
        const list = within(dialog).getByRole('list', { name: '관심' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(
            WATCHLIST_PREVIEW_COUNT
        );
        expect(within(list).getAllByRole('link')[0]).toHaveAttribute(
            'href',
            '/S0'
        );
        expect(
            within(dialog).getByRole('link', { name: '관심종목 전체 보기' })
        ).toHaveAttribute('href', '/watchlist');
    });

    it('닫혀 있는 동안에는 시세를 요청하지 않는다', () => {
        setWatchlist(['AAPL']);
        render(<WatchlistQuickButton />);
        expect(quote.useWatchlistQuote).not.toHaveBeenCalled();
    });

    it('Esc로 닫히고 포커스가 버튼으로 돌아온다', async () => {
        setWatchlist(['AAPL']);
        const user = userEvent.setup();
        render(<WatchlistQuickButton />);
        const button = screen.getByRole('button', { name: /관심종목 열기/ });
        await user.click(button);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // 열리면 포커스가 대화상자 안의 선택된 탭으로 들어간다.
        expect(screen.getByRole('tab', { name: /관심/ })).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(button).toHaveFocus();
    });

    it('행을 누르면 팝오버가 닫힌다', async () => {
        setWatchlist(['AAPL']);
        const user = userEvent.setup();
        render(<WatchlistQuickButton />);
        await user.click(screen.getByRole('button', { name: /관심종목 열기/ }));
        await user.click(screen.getByRole('link', { name: /AAPL Inc\./ }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('담은 게 없고 최근 본 종목이 있으면 최근 본 탭으로 열린다', async () => {
        setWatchlist([]);
        localStorage.setItem(
            LOCAL_STORAGE_RECENT_SYMBOLS_KEY,
            JSON.stringify([{ symbol: 'TSLA', label: '테슬라', viewedAt: 1 }])
        );
        const user = userEvent.setup();
        render(<WatchlistQuickButton />);
        await user.click(screen.getByRole('button', { name: '관심종목 열기' }));
        expect(screen.getByRole('tab', { name: '최근 본' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByRole('link', { name: /테슬라/ })).toHaveAttribute(
            'href',
            '/TSLA'
        );
        expect(
            screen.getByRole('link', { name: '관심종목 전체 보기' })
        ).toHaveAttribute('href', '/watchlist?tab=recent');
    });

    it('방향키로 탭을 옮긴다', async () => {
        setWatchlist(['AAPL']);
        const user = userEvent.setup();
        render(<WatchlistQuickButton />);
        await user.click(screen.getByRole('button', { name: /관심종목 열기/ }));
        screen.getByRole('tab', { name: /관심/ }).focus();
        await user.keyboard('{ArrowRight}');
        const recent = screen.getByRole('tab', { name: '최근 본' });
        expect(recent).toHaveAttribute('aria-selected', 'true');
        expect(recent).toHaveFocus();
        expect(
            screen.getByText(/아직 둘러본 종목이 없어요/)
        ).toBeInTheDocument();
    });

    it('lg 미만에서는 팝오버 대신 시트를 연다', async () => {
        setViewport(true);
        setWatchlist(['AAPL']);
        const user = userEvent.setup();
        render(<WatchlistQuickButton />);
        await user.click(screen.getByRole('button', { name: /관심종목 열기/ }));
        expect(screen.getByTestId('watchlist-sheet')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
