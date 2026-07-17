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
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '추가' }));

        await waitFor(() => {
            expect(save.mutateAsync).toHaveBeenCalledWith({
                symbol: 'AAPL',
                quantity: '10',
                averagePrice: '150.5',
            });
        });
    });

    it('announces success in the polite status region after adding a holding', async () => {
        const user = userEvent.setup();
        const { save } = setHoldings({ holdings: [] });
        (save.mutateAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
            status: 'ok',
            holding: HOLDING,
        });
        render(<PortfolioSection />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'AAPL');
        await user.type(screen.getByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '추가' }));

        expect(
            await screen.findByText("'AAPL' 보유종목을 저장했어요")
        ).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent(
            "'AAPL' 보유종목을 저장했어요"
        );
    });

    it('surfaces the error message when the save mutation returns an error result', async () => {
        const user = userEvent.setup();
        const { save } = setHoldings({ holdings: [] });
        (save.mutateAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
            status: 'error',
            code: 'invalid_symbol',
            message: '올바른 종목 코드를 입력해 주세요.',
        });
        render(<PortfolioSection />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'ZZZZ');
        await user.type(screen.getByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '추가' }));

        expect(
            await screen.findByText('올바른 종목 코드를 입력해 주세요.')
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

    it('announces success in the polite status region after deleting a holding', async () => {
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

        expect(
            await screen.findByText("'AAPL' 보유종목을 삭제했어요")
        ).toBeInTheDocument();
    });

    it('moves focus to the section heading (not <body>) after a successful delete', async () => {
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
            expect(
                screen.getByRole('heading', { name: '보유종목' })
            ).toHaveFocus();
        });
        expect(document.activeElement).not.toBe(document.body);
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

    it('edits a holding: opens inline form, submits, and returns to display mode on ok', async () => {
        const user = userEvent.setup();
        const { save } = setHoldings({ holdings: [HOLDING] });
        (save.mutateAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
            status: 'ok',
            holding: { ...HOLDING, quantity: '20.00000000' },
        });
        render(<PortfolioSection />);

        const row = screen.getByText('AAPL').closest('li');
        if (!row) throw new Error('holding row not found');

        await user.click(
            within(row).getByRole('button', { name: 'AAPL 보유종목 수정' })
        );

        // Inline edit form: symbol is read-only text, quantity/averagePrice pre-filled.
        expect(
            within(row).getByRole('button', { name: '저장' })
        ).toBeInTheDocument();
        const quantityInput = within(row).getByLabelText('수량');
        expect(quantityInput).toHaveValue('10');
        await user.clear(quantityInput);
        await user.type(quantityInput, '20');
        await user.click(within(row).getByRole('button', { name: '저장' }));

        await waitFor(() => {
            expect(save.mutateAsync).toHaveBeenCalledWith({
                symbol: 'AAPL',
                quantity: '20',
                averagePrice: '150.5',
            });
        });

        // Edit form closes -> row is back in display mode (수정/삭제 buttons visible again).
        await waitFor(() => {
            expect(
                within(row).getByRole('button', { name: 'AAPL 보유종목 수정' })
            ).toBeInTheDocument();
        });
        expect(
            within(row).queryByRole('button', { name: '저장' })
        ).not.toBeInTheDocument();

        // Success is announced in the section's polite status region.
        expect(
            screen.getByText("'AAPL' 보유종목을 저장했어요")
        ).toBeInTheDocument();
    });

    it('moves focus into the inline edit form (quantity field) when 수정 is clicked', async () => {
        const user = userEvent.setup();
        setHoldings({ holdings: [HOLDING] });
        render(<PortfolioSection />);

        const row = screen.getByText('AAPL').closest('li');
        if (!row) throw new Error('holding row not found');

        await user.click(
            within(row).getByRole('button', { name: 'AAPL 보유종목 수정' })
        );

        expect(within(row).getByLabelText('수량')).toHaveFocus();
    });

    it('shows the row-level delete error and keeps the row when remove.mutateAsync resolves an error', async () => {
        const user = userEvent.setup();
        const { remove } = setHoldings({ holdings: [HOLDING] });
        (remove.mutateAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
            status: 'error',
            code: 'unknown',
            message: '삭제에 실패했어요. 다시 시도해 주세요.',
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

        expect(
            await within(row).findByText(
                '삭제에 실패했어요. 다시 시도해 주세요.'
            )
        ).toBeInTheDocument();
        // Row is not removed - the symbol is still on screen.
        expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('restores the normal row buttons without deleting when 취소 is clicked on the delete confirm', async () => {
        const user = userEvent.setup();
        const { remove } = setHoldings({ holdings: [HOLDING] });
        render(<PortfolioSection />);

        const row = screen.getByText('AAPL').closest('li');
        if (!row) throw new Error('holding row not found');

        await user.click(
            within(row).getByRole('button', { name: 'AAPL 보유종목 삭제' })
        );
        expect(
            within(row).getByRole('button', { name: '삭제 확정' })
        ).toBeInTheDocument();

        await user.click(within(row).getByRole('button', { name: '취소' }));

        expect(
            within(row).queryByRole('button', { name: '삭제 확정' })
        ).not.toBeInTheDocument();
        expect(
            within(row).getByRole('button', { name: 'AAPL 보유종목 삭제' })
        ).toBeInTheDocument();
        expect(remove.mutateAsync).not.toHaveBeenCalled();
    });

    it('moves focus to "삭제 확정" when 삭제 is clicked', async () => {
        const user = userEvent.setup();
        setHoldings({ holdings: [HOLDING] });
        render(<PortfolioSection />);

        const row = screen.getByText('AAPL').closest('li');
        if (!row) throw new Error('holding row not found');

        await user.click(
            within(row).getByRole('button', { name: 'AAPL 보유종목 삭제' })
        );

        expect(
            within(row).getByRole('button', { name: '삭제 확정' })
        ).toHaveFocus();
    });

    it('returns focus to "삭제" when the delete confirm is cancelled', async () => {
        const user = userEvent.setup();
        setHoldings({ holdings: [HOLDING] });
        render(<PortfolioSection />);

        const row = screen.getByText('AAPL').closest('li');
        if (!row) throw new Error('holding row not found');

        await user.click(
            within(row).getByRole('button', { name: 'AAPL 보유종목 삭제' })
        );
        await user.click(within(row).getByRole('button', { name: '취소' }));

        expect(
            within(row).getByRole('button', { name: 'AAPL 보유종목 삭제' })
        ).toHaveFocus();
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
