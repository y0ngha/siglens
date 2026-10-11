const quote = vi.hoisted(() => ({ useWatchlistQuote: vi.fn() }));
const openSearch = vi.hoisted(() => vi.fn());
vi.mock('@/features/watchlist/hooks/useWatchlist');
vi.mock('@/features/watchlist/hooks/useWatchlistQuote', () => quote);
vi.mock('@/features/watchlist/hooks/useOpenTickerSearch', () => ({
    useOpenTickerSearch: () => openSearch,
}));

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { HomeWatchlistCard } from '@/features/watchlist/ui/HomeWatchlistCard';
import {
    HOME_POPULAR_ANCHOR_ID,
    HOME_WATCHLIST_DESKTOP_COUNT,
    HOME_WATCHLIST_MOBILE_COUNT,
} from '@/shared/config/watchlist';
import { LOCAL_STORAGE_RECENT_SYMBOLS_KEY } from '@/shared/lib/storageKeys';

type Watchlist = ReturnType<typeof useWatchlist>;

function setWatchlist(symbols: string[], overrides: Partial<Watchlist> = {}) {
    vi.mocked(useWatchlist).mockReturnValue({
        items: symbols.map(symbol => ({
            symbol,
            companyName: null,
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

describe('HomeWatchlistCard', () => {
    beforeEach(() => {
        localStorage.clear();
        quote.useWatchlistQuote.mockReturnValue({
            quote: { price: 100, changePct: -1, trend: [101, 100] },
            isSettled: true,
        });
    });

    it('하이드레이션 전에는 제목 없는 자리표시자만 그린다', () => {
        setWatchlist([], { isHydrated: false });
        render(<HomeWatchlistCard />);
        expect(screen.queryByRole('heading')).toBeNull();
    });

    it('담은 것도 본 것도 없으면 검색·인기 종목으로 안내한다', async () => {
        setWatchlist([]);
        const user = userEvent.setup();
        render(<HomeWatchlistCard />);
        expect(
            screen.getByRole('heading', { name: '내 관심종목' })
        ).toBeInTheDocument();
        expect(screen.getByText(/종목 옆의 별을 누르면/)).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '인기 종목 보기' })
        ).toHaveAttribute('href', `#${HOME_POPULAR_ANCHOR_ID}`);
        await user.click(screen.getByRole('button', { name: '종목 검색' }));
        expect(openSearch).toHaveBeenCalledTimes(1);
    });

    it('담은 것이 없고 최근 본 것이 있으면 최근 본 탭으로 연다', () => {
        setWatchlist([]);
        localStorage.setItem(
            LOCAL_STORAGE_RECENT_SYMBOLS_KEY,
            JSON.stringify([{ symbol: 'NVDA', label: '엔비디아', viewedAt: 1 }])
        );
        render(<HomeWatchlistCard />);
        expect(screen.getByRole('tab', { name: '최근 본' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByRole('link', { name: '전체 보기' })).toHaveAttribute(
            'href',
            '/watchlist?tab=recent'
        );
    });

    it('담은 것이 있으면 관심 탭으로 열고 PC 카드는 상한까지만 그린다', () => {
        const many = Array.from(
            { length: HOME_WATCHLIST_DESKTOP_COUNT + 3 },
            (_, i) => `S${i}`
        );
        setWatchlist(many);
        render(<HomeWatchlistCard />);
        expect(screen.getByRole('tab', { name: /관심/ })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        // PC(기본 matchMedia 폴리필은 lg 미만이 아니다)는 카드 목록만 그린다: 카드 N개 + "종목 담기" 1개.
        const lists = screen.getAllByRole('list');
        expect(lists).toHaveLength(1);
        expect(within(lists[0]!).getAllByRole('listitem')).toHaveLength(
            HOME_WATCHLIST_DESKTOP_COUNT + 1
        );
        expect(screen.queryByRole('link', { name: /개 더 보기/ })).toBeNull();
        expect(quote.useWatchlistQuote).not.toHaveBeenCalledWith(
            `S${HOME_WATCHLIST_DESKTOP_COUNT}`,
            true
        );
    });

    it('lg 미만이면 행 목록만 그리고 나머지는 "더 보기"로 보낸다', () => {
        const original = window.matchMedia;
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: true,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        try {
            const many = Array.from({ length: 5 }, (_, i) => `S${i}`);
            setWatchlist(many);
            render(<HomeWatchlistCard />);
            const lists = screen.getAllByRole('list');
            expect(lists).toHaveLength(1);
            expect(within(lists[0]!).getAllByRole('listitem')).toHaveLength(
                HOME_WATCHLIST_MOBILE_COUNT
            );
            expect(
                screen.getByRole('link', { name: '2개 더 보기' })
            ).toHaveAttribute('href', '/watchlist');
        } finally {
            window.matchMedia = original;
        }
    });
});
