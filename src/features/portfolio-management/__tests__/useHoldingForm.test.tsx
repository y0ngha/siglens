import { act, renderHook } from '@testing-library/react';
import {
    useHoldingForm,
    type UseHoldingFormOptions,
} from '@/features/portfolio-management/hooks/useHoldingForm';
import type {
    PortfolioHoldingView,
    SavePortfolioResult,
} from '@/entities/portfolio/model';

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

const OK_RESULT: SavePortfolioResult = { status: 'ok', holding: HOLDING };

function submitEvent(): React.SubmitEvent<HTMLFormElement> {
    return {
        preventDefault: vi.fn(),
    } as unknown as React.SubmitEvent<HTMLFormElement>;
}

function renderForm(overrides: Partial<UseHoldingFormOptions> = {}) {
    const onSubmit = vi.fn().mockResolvedValue(OK_RESULT);
    const options: UseHoldingFormOptions = {
        onSubmit,
        submitting: false,
        autoFocusFirstField: false,
        ...overrides,
    };
    return { ...renderHook(() => useHoldingForm(options)), options };
}

function fillAddForm(result: { current: ReturnType<typeof useHoldingForm> }) {
    act(() => {
        result.current.selectSymbol({ symbol: 'MSFT', label: 'Microsoft' });
        result.current.changeQuantity('3');
        result.current.changeAveragePrice('400');
    });
}

describe('useHoldingForm', () => {
    it('pre-fills edit mode from the holding with trailing zeros trimmed', () => {
        const { result } = renderForm({ initial: HOLDING });

        expect(result.current.isEditMode).toBe(true);
        expect(result.current.symbol).toBe('AAPL');
        expect(result.current.symbolName).toBe('Apple Inc.');
        expect(result.current.quantity).toBe('10');
        expect(result.current.averagePrice).toBe('150.5');
    });

    it('starts add mode from defaultSymbol', () => {
        const { result } = renderForm({ defaultSymbol: 'NVDA' });

        expect(result.current.isEditMode).toBe(false);
        expect(result.current.symbol).toBe('NVDA');
    });

    it('strips a typed minus sign from quantity and average price', () => {
        const { result } = renderForm();

        act(() => {
            result.current.changeQuantity('-3');
            result.current.changeAveragePrice('-400');
        });

        expect(result.current.quantity).toBe('3');
        expect(result.current.averagePrice).toBe('400');
    });

    it('submits only the symbol (not the display label) with the typed values', async () => {
        const { result, options } = renderForm();
        fillAddForm(result);

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(options.onSubmit).toHaveBeenCalledWith({
            symbol: 'MSFT',
            quantity: '3',
            averagePrice: '400',
        });
    });

    it('clears every field after a successful add', async () => {
        const { result } = renderForm();
        fillAddForm(result);

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(result.current.symbol).toBe('');
        expect(result.current.symbolName).toBeNull();
        expect(result.current.quantity).toBe('');
        expect(result.current.averagePrice).toBe('');
    });

    it('calls onCancel after a successful edit', async () => {
        const onCancel = vi.fn();
        const { result } = renderForm({ initial: HOLDING, onCancel });

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('surfaces an error result against its field', async () => {
        const onSubmit = vi.fn().mockResolvedValue({
            status: 'error',
            code: 'invalid_quantity',
            message: '수량 오류',
        });
        const { result } = renderForm({ onSubmit });

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(result.current.error).toBe('수량 오류');
        expect(result.current.errorField).toBe('quantity');
    });

    it('shows the generic message and unlocks when onSubmit rejects', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('network down'));
        const { result } = renderForm({ onSubmit });

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(result.current.error).toBe(
            '요청 처리 중 문제가 발생했어요. 다시 시도해 주세요.'
        );
        expect(result.current.isSubmitting).toBe(false);
    });

    it('stays submitting while its own request is in flight', async () => {
        const onSubmit = vi.fn(
            () => new Promise<SavePortfolioResult>(() => {})
        );
        const { result } = renderForm({ onSubmit });

        act(() => {
            void result.current.handleSubmit(submitEvent());
        });

        expect(result.current.isSubmitting).toBe(true);
    });

    it('ignores a second submit while the first is in flight', async () => {
        const onSubmit = vi.fn(
            () => new Promise<SavePortfolioResult>(() => {})
        );
        const { result } = renderForm({ onSubmit });

        act(() => {
            void result.current.handleSubmit(submitEvent());
        });
        act(() => {
            void result.current.handleSubmit(submitEvent());
        });

        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('ignores a submit while the parent reports submitting', async () => {
        const { result, options } = renderForm({ submitting: true });

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(options.onSubmit).not.toHaveBeenCalled();
    });
});
