import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HoldingForm } from '@/features/portfolio-management/ui/HoldingForm';
import type { PortfolioHoldingView } from '@/entities/portfolio';

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

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('HoldingForm', () => {
    it('add mode: submits symbol/quantity/averagePrice and clears the form on success', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue({
            status: 'ok',
            holding: HOLDING,
        });
        render(<HoldingForm onSubmit={onSubmit} />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'AAPL');
        await user.type(screen.getByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '추가' }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({
                symbol: 'AAPL',
                quantity: '10',
                averagePrice: '150.5',
            });
        });

        // Form clears itself on success in add mode: symbol chip gone, autocomplete back.
        expect(
            await screen.findByLabelText('종목 티커 검색')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('수량')).toHaveValue('');
        expect(screen.getByLabelText('평단')).toHaveValue('');
    });

    it('add mode: the 변경 button clears the selected symbol and returns to the autocomplete', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<HoldingForm onSubmit={onSubmit} />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'AAPL');
        await user.tab();

        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(
            screen.queryByLabelText('종목 티커 검색')
        ).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '변경' }));

        expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
        expect(screen.getByLabelText('종목 티커 검색')).toBeInTheDocument();
    });

    it('edit mode: shows the symbol as read-only text, pre-fills quantity/averagePrice, and calls onCancel on a successful submit', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue({
            status: 'ok',
            holding: HOLDING,
        });
        const onCancel = vi.fn();
        render(
            <HoldingForm
                initial={HOLDING}
                onSubmit={onSubmit}
                onCancel={onCancel}
            />
        );

        // Symbol renders as read-only text, not the autocomplete input.
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(
            screen.queryByLabelText('종목 티커 검색')
        ).not.toBeInTheDocument();
        expect(screen.getByLabelText('수량')).toHaveValue('10');
        expect(screen.getByLabelText('평단')).toHaveValue('150.5');

        await user.click(screen.getByRole('button', { name: '저장' }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({
                symbol: 'AAPL',
                quantity: '10',
                averagePrice: '150.5',
            });
        });
        await waitFor(() => {
            expect(onCancel).toHaveBeenCalled();
        });
    });

    it('focuses the quantity field and marks it invalid on an invalid_quantity error', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue({
            status: 'error',
            code: 'invalid_quantity',
            message: '수량은 0보다 커야 해요.',
        });
        render(<HoldingForm onSubmit={onSubmit} />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'AAPL');
        await user.type(screen.getByLabelText('수량'), '0');
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '추가' }));

        expect(
            await screen.findByText('수량은 0보다 커야 해요.')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('수량')).toHaveAttribute(
            'aria-invalid',
            'true'
        );
        expect(screen.getByLabelText('수량')).toHaveFocus();
    });

    it('focuses the averagePrice field and marks it invalid on an invalid_price error', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue({
            status: 'error',
            code: 'invalid_price',
            message: '평단은 0보다 커야 해요.',
        });
        render(<HoldingForm onSubmit={onSubmit} />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'AAPL');
        await user.type(screen.getByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평단'), '0');
        await user.click(screen.getByRole('button', { name: '추가' }));

        expect(
            await screen.findByText('평단은 0보다 커야 해요.')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('평단')).toHaveAttribute(
            'aria-invalid',
            'true'
        );
        expect(screen.getByLabelText('평단')).toHaveFocus();
    });

    it('surfaces the message without focusing a field on an error code with no dedicated field (e.g. storage_unavailable)', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue({
            status: 'error',
            code: 'storage_unavailable',
            message: '일시적인 오류로 저장하지 못했어요.',
        });
        render(<HoldingForm onSubmit={onSubmit} />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'AAPL');
        await user.type(screen.getByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '추가' }));

        expect(
            await screen.findByText('일시적인 오류로 저장하지 못했어요.')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('수량')).toHaveAttribute(
            'aria-invalid',
            'false'
        );
        expect(screen.getByLabelText('평단')).toHaveAttribute(
            'aria-invalid',
            'false'
        );
    });

    it('handles onSubmit throwing/rejecting: surfaces a generic error and does not crash', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockRejectedValue(new Error('network down'));
        render(<HoldingForm onSubmit={onSubmit} />);

        await user.type(screen.getByLabelText('종목 티커 검색'), 'AAPL');
        await user.type(screen.getByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '추가' }));

        expect(
            await screen.findByText(
                '요청 처리 중 문제가 발생했어요. 다시 시도해 주세요.'
            )
        ).toBeInTheDocument();

        // Submitting state resets and the form is still usable (did not crash / lock up).
        expect(screen.getByRole('button', { name: '추가' })).toBeEnabled();
    });
});
