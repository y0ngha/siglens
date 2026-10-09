vi.mock('@/features/watchlist/hooks/useWatchlist');
vi.mock('@/features/watchlist/hooks/useWatchlistQuote', () => ({
    useWatchlistQuote: vi.fn(() => ({
        quote: { price: 150.25, changePct: 1.5 },
        isSettled: true,
    })),
}));
vi.mock('@/shared/hooks/useInViewOnce', () => ({
    useInViewOnce: () => [vi.fn(), true],
}));
vi.mock('@/entities/portfolio/hooks/usePortfolioHoldings');
const identity = vi.hoisted(() => ({
    currentUser: null as { id: string } | null,
}));
vi.mock('@/entities/auth/hooks/useCurrentUser', () => ({
    useCurrentUser: () => ({ data: identity.currentUser, isPending: false }),
}));
vi.mock('@/features/ticker-search/ui/TickerAutocomplete', () => ({
    TickerAutocomplete: () => <input aria-label="종목 티커 검색" />,
}));

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchlistSection } from '@/features/watchlist/ui/WatchlistSection';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { useWatchlistQuote } from '@/features/watchlist/hooks/useWatchlistQuote';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';

const mockUseWatchlist = vi.mocked(useWatchlist);
const mockUseQuote = vi.mocked(useWatchlistQuote);
const mockUseHoldings = vi.mocked(usePortfolioHoldings);
type Watchlist = ReturnType<typeof useWatchlist>;
type Holdings = ReturnType<typeof usePortfolioHoldings>;

const AAPL = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    addedAt: '2026-10-09T00:00:00.000Z',
};
const ZZZQ = {
    symbol: 'ZZZQ',
    companyName: null,
    addedAt: '2026-10-08T00:00:00.000Z',
};

function setWatchlist(overrides: Partial<Watchlist> = {}): Watchlist {
    const value: Watchlist = {
        items: [AAPL, ZZZQ],
        has: vi.fn(() => true),
        toggle: vi.fn(async () => 'removed' as const),
        remove: vi.fn(async () => true),
        isHydrated: true,
        isAtLimit: false,
        limit: 20,
        isIdentityPending: false,
        ...overrides,
    };
    mockUseWatchlist.mockReturnValue(value);
    return value;
}
function setHoldings(
    saveResult: Awaited<ReturnType<Holdings['save']['mutateAsync']>>
) {
    const save = {
        mutateAsync: vi.fn(async () => saveResult),
        isPending: false,
    } as unknown as Holdings['save'];
    mockUseHoldings.mockReturnValue({
        holdings: [],
        hasData: true,
        isHydrated: true,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
        save,
        remove: {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as Holdings['remove'],
    });
    return save;
}

describe('WatchlistSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        identity.currentUser = null;
        setHoldings({
            status: 'ok',
            holding: {
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                fmpSymbol: 'AAPL',
                quantity: '1',
                averagePrice: '1',
                updatedAt: '',
            },
        });
        mockUseQuote.mockReturnValue({
            quote: { price: 150.25, changePct: 1.5 },
            isSettled: true,
        });
    });

    it('하이드레이션 전엔 로딩 상태(role=status)', () => {
        setWatchlist({ isHydrated: false, items: [] });
        render(<WatchlistSection />);
        expect(screen.getByRole('status')).toHaveTextContent(
            '관심종목을 불러오는 중이에요'
        );
    });

    it('회원 여부를 아직 모르면 빈 목록이어도 빈 상태 CTA 대신 로딩을 그린다', () => {
        setWatchlist({ items: [], isIdentityPending: true });
        render(<WatchlistSection />);
        expect(screen.getByRole('status')).toHaveTextContent(
            '관심종목을 불러오는 중이에요'
        );
        expect(screen.queryByText('아직 담은 종목이 없어요')).toBeNull();
    });

    it('비어 있으면 안내와 홈 온보딩 링크', () => {
        setWatchlist({ items: [] });
        render(<WatchlistSection />);
        expect(screen.getByText('아직 담은 종목이 없어요')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '홈에서 관심 종목 담기' })
        ).toHaveAttribute('href', '/#watchlist-onboarding');
    });

    it('행마다 종목 링크·시세·등락률을 그리고, 이름이 없으면 심볼만 보인다', () => {
        setWatchlist();
        render(<WatchlistSection />);
        const rows = within(
            screen.getByRole('list', { name: '관심종목 목록' })
        ).getAllByRole('listitem');
        expect(rows).toHaveLength(2);
        expect(
            within(rows[0]!).getByRole('link', { name: '애플 (AAPL)' })
        ).toHaveAttribute('href', '/AAPL');
        expect(
            within(rows[1]!).getByRole('link', { name: 'ZZZQ' })
        ).toHaveAttribute('href', '/ZZZQ');
        expect(rows[0]).toHaveTextContent('+1.5%');
        expect(rows[0]).toHaveTextContent('150.25');
    });

    it('시세가 없으면 "시세 없음"', () => {
        setWatchlist();
        mockUseQuote.mockReturnValue({ quote: null, isSettled: true });
        render(<WatchlistSection />);
        expect(screen.getAllByText('시세 없음')).toHaveLength(2);
    });

    it('삭제 버튼은 remove(symbol)를 부른다', async () => {
        const wl = setWatchlist();
        const user = userEvent.setup();
        render(<WatchlistSection />);
        await user.click(
            screen.getByRole('button', { name: 'AAPL 관심종목 삭제' })
        );
        expect(wl.remove).toHaveBeenCalledWith('AAPL');
    });

    it('비회원에게는 "보유로 전환"이 없다', () => {
        setWatchlist();
        render(<WatchlistSection />);
        expect(
            screen.queryByRole('button', { name: /보유로 전환/ })
        ).toBeNull();
    });

    it('회원: 보유로 전환 → 심볼이 채워진 HoldingForm → 저장 성공 시 관심 항목 삭제·onHoldingsChange', async () => {
        identity.currentUser = { id: 'user-1' };
        const wl = setWatchlist();
        const save = setHoldings({
            status: 'ok',
            holding: {
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                fmpSymbol: 'AAPL',
                quantity: '10',
                averagePrice: '150',
                updatedAt: '',
            },
        });
        const onHoldingsChange = vi.fn();
        const user = userEvent.setup();
        render(<WatchlistSection onHoldingsChange={onHoldingsChange} />);

        await user.click(
            screen.getByRole('button', { name: 'AAPL 보유로 전환' })
        );
        const row = screen.getByRole('button', { name: '추가' }).closest('li')!;
        // HoldingForm은 defaultSymbol만 알고 회사명은 모른다 → 칩은 심볼(`symbolLabel('AAPL', null)`).
        expect(
            within(row).getByText('AAPL', { exact: true })
        ).toBeInTheDocument();
        await user.type(within(row).getByLabelText('수량'), '10');
        await user.type(within(row).getByLabelText('평단'), '150');
        await user.click(within(row).getByRole('button', { name: '추가' }));

        expect(save.mutateAsync).toHaveBeenCalledWith({
            symbol: 'AAPL',
            quantity: '10',
            averagePrice: '150',
        });
        expect(wl.remove).toHaveBeenCalledWith('AAPL');
        expect(onHoldingsChange).toHaveBeenCalledTimes(1);
    });

    it('회원: 저장이 error면 관심 항목을 지우지 않는다', async () => {
        identity.currentUser = { id: 'user-1' };
        const wl = setWatchlist();
        setHoldings({
            status: 'error',
            code: 'invalid_quantity',
            message: '수량',
        });
        const user = userEvent.setup();
        render(<WatchlistSection />);
        await user.click(
            screen.getByRole('button', { name: 'AAPL 보유로 전환' })
        );
        const row = screen.getByRole('button', { name: '추가' }).closest('li')!;
        await user.type(within(row).getByLabelText('수량'), '0');
        await user.type(within(row).getByLabelText('평단'), '150');
        await user.click(within(row).getByRole('button', { name: '추가' }));
        expect(wl.remove).not.toHaveBeenCalled();
    });
});
