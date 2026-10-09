vi.mock('@/features/watchlist/hooks/useWatchlist');
vi.mock('@/shared/config/popular-tickers', () => ({
    KR_CATEGORY_IDS: new Set<string>(['kr-semiconductor']),
    TICKER_CATEGORIES: [
        {
            id: 'megacap',
            label: '메가캡·지수',
            items: [
                { symbol: 'AAPL', name: '애플' },
                { symbol: 'MSFT', name: '마이크로소프트' },
            ],
        },
        {
            id: 'ai-semiconductor',
            label: 'AI·반도체',
            items: [{ symbol: 'NVDA', name: '엔비디아' }],
        },
        {
            id: 'kr-semiconductor',
            label: '반도체·IT',
            items: [{ symbol: '005930.KS', name: '삼성전자' }],
        },
    ],
}));

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchlistOnboarding } from '@/features/watchlist/ui/WatchlistOnboarding';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';
import { WATCHLIST_ONBOARDING_COLLAPSE_COUNT } from '@/shared/config/watchlist';

const mockUseWatchlist = vi.mocked(useWatchlist);
type Watchlist = ReturnType<typeof useWatchlist>;
const item = (symbol: string) => ({
    symbol,
    companyName: null,
    addedAt: '2026-10-09T00:00:00.000Z',
});

function setWatchlist(overrides: Partial<Watchlist> = {}): Watchlist {
    const value: Watchlist = {
        items: [],
        has: vi.fn(() => false),
        toggle: vi.fn(async () => 'added' as const),
        add: vi.fn(async () => 'added' as const),
        remove: vi.fn(async () => true),
        isHydrated: true,
        isAtLimit: false,
        isIdentityPending: false,
        isMember: false,
        limit: 20,
        ...overrides,
    };
    mockUseWatchlist.mockReturnValue(value);
    return value;
}

describe('WatchlistOnboarding', () => {
    beforeEach(() => vi.clearAllMocks());

    it('제목·부제와 기본 선택 megacap의 타일을 그린다', () => {
        setWatchlist();
        render(<WatchlistOnboarding />);
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: '관심 종목부터 담아 보세요',
            })
        ).toBeInTheDocument();
        const chips = within(
            screen.getByRole('group', { name: '종목 카테고리' })
        ).getAllByRole('button');
        expect(
            chips.find(c => c.getAttribute('aria-pressed') === 'true')
        ).toHaveTextContent('메가캡·지수');
        const tiles = within(
            screen.getByRole('list', { name: '메가캡·지수 종목' })
        ).getAllByRole('listitem');
        expect(tiles).toHaveLength(2);
    });

    it('타일은 토글 버튼(aria-pressed)이고 회사명만 종목 링크다 — 포커스 순서 타일→링크', () => {
        setWatchlist({ has: vi.fn(symbol => symbol === 'AAPL') });
        render(<WatchlistOnboarding />);
        const [aapl] = within(
            screen.getByRole('list', { name: '메가캡·지수 종목' })
        ).getAllByRole('listitem');
        const toggle = within(aapl!).getByRole('button', {
            name: '관심종목: 애플 (AAPL)',
        });
        const link = within(aapl!).getByRole('link', { name: '애플' });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        expect(toggle).not.toHaveAttribute('aria-describedby');
        expect(link).toHaveAttribute('href', '/AAPL');
        expect(
            toggle.compareDocumentPosition(link) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(link.closest('button')).toBeNull();
    });

    it('타일 클릭은 toggle({symbol,label}, "home_onboarding")', async () => {
        const wl = setWatchlist();
        const user = userEvent.setup();
        render(<WatchlistOnboarding />);
        await user.click(
            within(
                screen.getByRole('list', { name: '메가캡·지수 종목' })
            ).getAllByRole('button')[1]!
        );
        expect(wl.toggle).toHaveBeenCalledWith(
            { symbol: 'MSFT', label: '마이크로소프트' },
            'home_onboarding'
        );
    });

    it('상한이면 담기 전 타일은 aria-disabled(포커스 가능)이고 사유를 설명으로 갖는다', async () => {
        const wl = setWatchlist({ isAtLimit: true, limit: 20 });
        const user = userEvent.setup();
        render(<WatchlistOnboarding />);
        const [aapl] = within(
            screen.getByRole('list', { name: '메가캡·지수 종목' })
        ).getAllByRole('listitem');
        const toggle = within(aapl!).getByRole('button', {
            name: '관심종목: 애플 (AAPL)',
        });
        expect(toggle).toHaveAttribute('aria-disabled', 'true');
        expect(toggle).not.toBeDisabled();
        expect(toggle).toHaveAccessibleDescription(/최대 20개/);
        await user.click(toggle);
        expect(wl.toggle).not.toHaveBeenCalled();
    });

    it('칩을 누르면 그 카테고리 타일로 바뀐다', async () => {
        setWatchlist();
        const user = userEvent.setup();
        render(<WatchlistOnboarding />);
        await user.click(screen.getByRole('button', { name: 'AI·반도체' }));
        expect(
            screen.getByRole('list', { name: 'AI·반도체 종목' })
        ).toBeInTheDocument();
    });

    it('ko에서는 KR 카테고리 칩이 보이고, en에서는 숨는다', () => {
        setWatchlist();
        const { unmount } = render(<WatchlistOnboarding />);
        expect(
            screen.getByRole('button', { name: '반도체·IT' })
        ).toBeInTheDocument();
        unmount();
        render(withLocale(<WatchlistOnboarding />, 'en'));
        // mock 카테고리 3개 중 KR 1개가 빠져 칩은 2개다.
        expect(
            within(
                screen.getByRole('group', { name: 'Symbol categories' })
            ).getAllByRole('button')
        ).toHaveLength(2);
    });

    it('담은 개수 ≥1이면 하단에 개수와 내 종목 링크', () => {
        setWatchlist({ items: [item('AAPL')] });
        render(<WatchlistOnboarding />);
        expect(screen.getByText('담은 종목 1개')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /내 종목 보기/ })
        ).toHaveAttribute('href', '/portfolio');
    });

    it(`하이드레이션 후 ${WATCHLIST_ONBOARDING_COLLAPSE_COUNT}개 이상이면 한 줄 요약으로 접히고, 누르면 펼친다`, async () => {
        setWatchlist({ items: [item('A'), item('B'), item('C')] });
        const user = userEvent.setup();
        render(<WatchlistOnboarding />);
        expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
        const expand = screen.getByRole('button', {
            name: /관심종목 3개를 지켜보고 있어요/,
        });
        expect(expand).toHaveAttribute('aria-expanded', 'false');
        expect(
            screen.getByRole('link', { name: /내 종목 보기/ })
        ).toBeInTheDocument();
        await user.click(expand);
        expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('서버 렌더(미하이드레이션)는 개수와 무관하게 펼친 상태다', () => {
        setWatchlist({
            items: [item('A'), item('B'), item('C')],
            isHydrated: false,
        });
        render(<WatchlistOnboarding />);
        expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('블록 id는 내 종목 빈 상태 링크의 앵커와 같다', () => {
        setWatchlist();
        const { container } = render(<WatchlistOnboarding />);
        expect(container.querySelector('#watchlist-onboarding')).not.toBeNull();
    });
});
