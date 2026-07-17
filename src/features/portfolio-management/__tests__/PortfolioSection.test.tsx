import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioSection } from '@/features/portfolio-management/ui/PortfolioSection';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type { PortfolioHoldingView } from '@/entities/portfolio';

vi.mock('@/entities/portfolio/hooks/usePortfolioHoldings');

// TickerAutocomplete pulls in useTickerSearch (react-query + a server action) which
// is unrelated to what this suite verifies (symbol selection wiring). Stub it with a
// plain uncontrolled input that "selects" on blur (mirrors picking a dropdown result),
// matching the real component's onSelect contract.
vi.mock('@/features/ticker-search', () => ({
    TickerAutocomplete: ({
        onSelect,
    }: {
        onSelect?: (symbol: string) => void;
    }) => (
        <input
            aria-label="종목 티커 검색"
            onBlur={e => {
                if (e.target.value) onSelect?.(e.target.value);
            }}
        />
    ),
}));

const mockUsePortfolioHoldings = vi.mocked(usePortfolioHoldings);

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

type Holdings = ReturnType<typeof usePortfolioHoldings>;

function setHoldings(
    overrides: Partial<Holdings> & { holdings: PortfolioHoldingView[] }
) {
    const base: Holdings = {
        holdings: [],
        isHydrated: true,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
        save: {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as Holdings['save'],
        remove: {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as Holdings['remove'],
    };
    const merged = { ...base, ...overrides };
    mockUsePortfolioHoldings.mockReturnValue(merged);
    return merged;
}

describe('PortfolioSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the empty state when there are no holdings', () => {
        setHoldings({ holdings: [] });
        render(<PortfolioSection />);
        expect(
            screen.getByText(
                '아직 등록한 보유종목이 없어요. 첫 종목을 추가해 보세요.'
            )
        ).toBeInTheDocument();
    });

    it('renders a holding row with symbol, quantity and price', () => {
        setHoldings({ holdings: [HOLDING] });
        render(<PortfolioSection />);
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText(/10주 · 평단 \$150\.5/)).toBeInTheDocument();
    });

    it('submits the add form with the entered symbol/quantity/averagePrice', async () => {
        const user = userEvent.setup();
        const { save } = setHoldings({ holdings: [] });
        render(<PortfolioSection />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'AAPL');
        await user.type(screen.getByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평균 단가'), '150.5');
        await user.click(screen.getByRole('button', { name: '추가' }));

        await waitFor(() => {
            expect(save.mutateAsync).toHaveBeenCalledWith({
                symbol: 'AAPL',
                quantity: '10',
                averagePrice: '150.5',
            });
        });
    });

    it('surfaces the error message when the save mutation returns an error result', async () => {
        const user = userEvent.setup();
        const { save } = setHoldings({ holdings: [] });
        (save.mutateAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
            status: 'error',
            code: 'invalid_symbol',
            message: '유효하지 않은 종목 코드입니다.',
        });
        render(<PortfolioSection />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'ZZZZ');
        await user.type(screen.getByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평균 단가'), '150.5');
        await user.click(screen.getByRole('button', { name: '추가' }));

        expect(
            await screen.findByText('유효하지 않은 종목 코드입니다.')
        ).toBeInTheDocument();
    });

    it('calls remove.mutateAsync with the symbol after confirming delete', async () => {
        const user = userEvent.setup();
        const { remove } = setHoldings({ holdings: [HOLDING] });
        (remove.mutateAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
            status: 'ok',
        });
        render(<PortfolioSection />);

        const row = screen.getByText('AAPL').closest('li');
        if (!row) throw new Error('holding row not found');

        await user.click(
            within(row).getByRole('button', { name: 'AAPL 보유종목 삭제' })
        );
        await user.click(
            within(row).getByRole('button', { name: '삭제 확정' })
        );

        await waitFor(() => {
            expect(remove.mutateAsync).toHaveBeenCalledWith('AAPL');
        });
    });

    it('shows a loading skeleton while not yet hydrated', () => {
        setHoldings({ holdings: [], isHydrated: false });
        const { container } = render(<PortfolioSection />);
        expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
        expect(
            screen.queryByText(
                '아직 등록한 보유종목이 없어요. 첫 종목을 추가해 보세요.'
            )
        ).not.toBeInTheDocument();
    });

    it('renders an error state instead of the empty state when the list query fails, and refetch() is called on 다시 시도', async () => {
        const user = userEvent.setup();
        const { refetch } = setHoldings({ holdings: [], isError: true });
        render(<PortfolioSection />);

        expect(
            screen.getByText('보유종목을 일시적으로 불러오지 못했어요.')
        ).toBeInTheDocument();
        expect(
            screen.queryByText(
                '아직 등록한 보유종목이 없어요. 첫 종목을 추가해 보세요.'
            )
        ).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(refetch).toHaveBeenCalled();
    });
});
