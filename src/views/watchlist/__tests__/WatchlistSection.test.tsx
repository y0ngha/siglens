vi.mock('@/features/watchlist/hooks/useWatchlist');
vi.mock(
    '@/features/watchlist/hooks/useWatchlistQuote',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/features/watchlist/hooks/useWatchlistQuote')
        >()),
        useWatchlistQuote: vi.fn(() => ({
            quote: { price: 150.25, changePct: 1.5, trend: [148, 150.25] },
            isSettled: true,
        })),
    })
);
const bars = vi.hoisted(() => ({ getBarsAction: vi.fn() }));
vi.mock('@/entities/bars/actions/getBarsAction', () => bars);
const openSearch = vi.hoisted(() => vi.fn());
vi.mock('@/features/watchlist/hooks/useOpenTickerSearch', () => ({
    useOpenTickerSearch: () => openSearch,
}));
vi.mock('@/shared/hooks/useInViewOnce', () => ({
    useInViewOnce: () => [vi.fn(), true],
}));
vi.mock('@/entities/portfolio/hooks/usePortfolioHoldings');
const toast = vi.hoisted(() => ({ showToast: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/shared/ui/ToastProvider', () => ({ useToast: () => toast }));
vi.mock('@/features/ticker-search/ui/TickerAutocomplete', () => ({
    TickerAutocomplete: () => <input aria-label="종목 티커 검색" />,
}));

import { render as rtlRender, screen, within } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';
import userEvent from '@testing-library/user-event';
import { WatchlistSection } from '@/views/watchlist/WatchlistSection';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { useWatchlistQuote } from '@/features/watchlist/hooks/useWatchlistQuote';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';

function render(ui: ReactElement) {
    return rtlRender(ui, { wrapper: createQueryClientWrapper().wrapper });
}

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
        add: vi.fn(async () => 'added' as const),
        remove: vi.fn(async () => true),
        isHydrated: true,
        isAtLimit: false,
        limit: 20,
        isIdentityPending: false,
        isMember: false,
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

/**
 * 실제 `useWatchlist`처럼 `remove`가 성공하면 그 항목이 목록에서 빠지는 회원 목록. 행이 정말로
 * 사라져야 "지운 뒤 포커스가 어디로 가는가"를 볼 수 있다.
 */
function setRemovableWatchlist(initial: Watchlist['items']) {
    mockUseWatchlist.mockImplementation(function useRemovableWatchlist() {
        const [items, setItems] = useState(initial);
        return {
            items,
            has: vi.fn(() => true),
            toggle: vi.fn(async () => 'removed' as const),
            add: vi.fn(async () => 'added' as const),
            remove: async (symbol: string) => {
                setItems(prev => prev.filter(item => item.symbol !== symbol));
                return true;
            },
            isHydrated: true,
            isAtLimit: false,
            limit: 20,
            isIdentityPending: false,
            isMember: true,
        };
    });
}

async function convertRow(
    user: ReturnType<typeof userEvent.setup>,
    symbol: string
) {
    await user.click(
        screen.getByRole('button', { name: `${symbol} 보유로 전환` })
    );
    const row = screen.getByRole('button', { name: '추가' }).closest('li')!;
    await user.type(within(row).getByLabelText('수량'), '10');
    await user.type(within(row).getByLabelText('평단'), '150');
    await user.click(within(row).getByRole('button', { name: '추가' }));
}

describe('WatchlistSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
            quote: { price: 150.25, changePct: 1.5, trend: [148, 150.25] },
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

    it('비어 있으면 안내와 종목 검색 버튼', async () => {
        setWatchlist({ items: [] });
        const user = userEvent.setup();
        render(<WatchlistSection />);
        expect(screen.getByText('아직 담은 종목이 없어요')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '종목 검색' }));
        expect(openSearch).toHaveBeenCalledTimes(1);
    });

    it('이름 순 정렬은 보이는 이름으로 줄을 세운다', () => {
        setWatchlist();
        render(<WatchlistSection sort="name" />);
        const links = within(
            screen.getByRole('list', { name: '관심종목 목록' })
        ).getAllByRole('link');
        // ko 정렬은 한글이 라틴 문자보다 앞이다(화면 로케일로 비교한다).
        expect(links.map(link => link.textContent)).toEqual([
            '애플 (AAPL)',
            'ZZZQ',
        ]);
    });

    it('등락률 정렬을 고르기 전에는 행 밖에서 시세를 요청하지 않는다', () => {
        setWatchlist();
        render(<WatchlistSection />);
        expect(bars.getBarsAction).not.toHaveBeenCalled();
    });

    it('등락률 순은 큰 것부터 줄을 세운다', async () => {
        setWatchlist();
        bars.getBarsAction.mockImplementation(async (symbol: string) => ({
            bars:
                symbol === 'ZZZQ'
                    ? [{ close: 100 }, { close: 110 }]
                    : [{ close: 100 }, { close: 101 }],
        }));
        render(<WatchlistSection sort="change" />);
        const list = screen.getByRole('list', { name: '관심종목 목록' });
        await vi.waitFor(() =>
            expect(
                within(list)
                    .getAllByRole('link')
                    .map(link => link.textContent)
            ).toEqual(['ZZZQ', '애플 (AAPL)'])
        );
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

    it('종목 링크는 블록 상자라 긴 이름이 칸 안에서 잘린다', () => {
        setWatchlist();
        render(<WatchlistSection />);
        expect(screen.getByRole('link', { name: '애플 (AAPL)' })).toHaveClass(
            'block',
            'max-w-full',
            'truncate'
        );
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

    it('회원: 보유로 전환 → 심볼이 채워진 HoldingForm → 저장 성공 시 관심 항목 삭제', async () => {
        const wl = setWatchlist({ isMember: true });
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
        const user = userEvent.setup();
        render(<WatchlistSection />);

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
        expect(toast.showToast).not.toHaveBeenCalled();
    });

    it('회원: 보유로 전환을 열면 수량 칸으로, 취소하면 전환 버튼으로 포커스가 옮겨진다', async () => {
        setWatchlist({ isMember: true });
        const user = userEvent.setup();
        render(<WatchlistSection />);
        await user.click(
            screen.getByRole('button', { name: 'AAPL 보유로 전환' })
        );
        expect(screen.getByLabelText('수량')).toHaveFocus();
        await user.click(screen.getByRole('button', { name: '취소' }));
        expect(
            screen.getByRole('button', { name: 'AAPL 보유로 전환' })
        ).toHaveFocus();
    });

    it('회원: 보유는 저장됐는데 관심 항목 삭제가 실패하면 구체적인 토스트를 띄운다', async () => {
        setWatchlist({ isMember: true, remove: vi.fn(async () => false) });
        const user = userEvent.setup();
        render(<WatchlistSection />);
        await user.click(
            screen.getByRole('button', { name: 'AAPL 보유로 전환' })
        );
        const row = screen.getByRole('button', { name: '추가' }).closest('li')!;
        await user.type(within(row).getByLabelText('수량'), '10');
        await user.type(within(row).getByLabelText('평단'), '150');
        await user.click(within(row).getByRole('button', { name: '추가' }));

        expect(toast.showToast).toHaveBeenCalledWith({
            message:
                '보유종목은 저장했지만 관심종목에서는 빼지 못했어요. 관심종목 페이지에서 직접 삭제해 주세요.',
        });
    });

    describe('회원: 전환에 성공해 행이 사라지면', () => {
        it('다음 행의 종목 링크로 포커스를 옮긴다', async () => {
            setRemovableWatchlist([AAPL, ZZZQ]);
            const user = userEvent.setup();
            render(<WatchlistSection />);
            await convertRow(user, 'AAPL');
            expect(screen.getByRole('link', { name: 'ZZZQ' })).toHaveFocus();
        });

        it('마지막 행이었으면 이전 행의 종목 링크로 포커스를 옮긴다', async () => {
            // 관심 항목 삭제는 저장된 보유의 심볼을 쓴다.
            setHoldings({
                status: 'ok',
                holding: {
                    symbol: 'ZZZQ',
                    companyName: null,
                    fmpSymbol: 'ZZZQ',
                    quantity: '10',
                    averagePrice: '150',
                    updatedAt: '',
                },
            });
            setRemovableWatchlist([AAPL, ZZZQ]);
            const user = userEvent.setup();
            render(<WatchlistSection />);
            await convertRow(user, 'ZZZQ');
            expect(
                screen.getByRole('link', { name: '애플 (AAPL)' })
            ).toHaveFocus();
        });

        it('목록이 비면 빈 상태 안내로 포커스를 옮긴다', async () => {
            setRemovableWatchlist([AAPL]);
            const user = userEvent.setup();
            render(<WatchlistSection />);
            await convertRow(user, 'AAPL');
            expect(screen.getByText('아직 담은 종목이 없어요')).toHaveFocus();
        });
    });

    it('삭제 버튼으로 행이 사라져도 다음 행의 종목 링크로 포커스를 옮긴다', async () => {
        setRemovableWatchlist([AAPL, ZZZQ]);
        const user = userEvent.setup();
        render(<WatchlistSection />);
        await user.click(
            screen.getByRole('button', { name: 'AAPL 관심종목 삭제' })
        );
        expect(screen.getByRole('link', { name: 'ZZZQ' })).toHaveFocus();
    });

    it('회원 판정은 useWatchlist의 isMember를 따른다(힌트만 있어도 전환 버튼)', () => {
        setWatchlist({ isMember: true });
        render(<WatchlistSection />);
        expect(
            screen.getByRole('button', { name: 'AAPL 보유로 전환' })
        ).toBeInTheDocument();
    });

    it('회원: 저장이 error면 관심 항목을 지우지 않는다', async () => {
        const wl = setWatchlist({ isMember: true });
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
