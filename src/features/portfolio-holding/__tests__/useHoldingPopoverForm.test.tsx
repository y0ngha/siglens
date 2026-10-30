import type { SubmitEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import type {
    PortfolioHoldingView,
    SavePortfolioResult,
} from '@/entities/portfolio/model';
import type { UseSymbolHoldingReturn } from '../hooks/useSymbolHolding';
import { useHoldingPopoverForm } from '../hooks/useHoldingPopoverForm';

type Save = UseSymbolHoldingReturn['save'];

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

const UNEXPECTED = '알 수 없는 오류';

function makeSave(
    mutateAsync: () => Promise<SavePortfolioResult>,
    isPending = false
): Save {
    return { mutateAsync: vi.fn(mutateAsync), isPending } as unknown as Save;
}

function submitEvent(): SubmitEvent<HTMLFormElement> {
    return {
        preventDefault: vi.fn(),
    } as unknown as SubmitEvent<HTMLFormElement>;
}

function renderForm(
    save: Save,
    holding: PortfolioHoldingView | null = null,
    onSaved = vi.fn()
) {
    const hook = renderHook(props => useHoldingPopoverForm(props), {
        initialProps: {
            symbol: 'AAPL',
            holding,
            save,
            onSaved,
            unexpectedErrorMessage: UNEXPECTED,
        },
    });
    return { ...hook, onSaved };
}

describe('useHoldingPopoverForm', () => {
    it('pre-fills both amounts from the holding with trailing zeros trimmed', () => {
        const { result } = renderForm(
            makeSave(async () => ({ status: 'ok', holding: HOLDING })),
            HOLDING
        );

        expect(result.current.quantity).toBe('10');
        expect(result.current.averagePrice).toBe('150.5');
    });

    it('starts both amounts empty without a holding', () => {
        const { result } = renderForm(
            makeSave(async () => ({ status: 'ok', holding: HOLDING }))
        );

        expect(result.current.quantity).toBe('');
        expect(result.current.averagePrice).toBe('');
    });

    it('strips minus signs from typed amounts', () => {
        const { result } = renderForm(
            makeSave(async () => ({ status: 'ok', holding: HOLDING }))
        );

        act(() => {
            result.current.changeQuantity('-3');
            result.current.changeAveragePrice('-7.25');
        });

        expect(result.current.quantity).toBe('3');
        expect(result.current.averagePrice).toBe('7.25');
    });

    it('calls onSaved after an ok save', async () => {
        const { result, onSaved } = renderForm(
            makeSave(async () => ({ status: 'ok', holding: HOLDING }))
        );

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it('keeps the server message and field for a rejected save', async () => {
        const { result } = renderForm(
            makeSave(async () => ({
                status: 'error',
                code: 'invalid_quantity',
                message: '수량을 확인해 주세요.',
            }))
        );

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(result.current.error).toEqual({
            message: '수량을 확인해 주세요.',
            field: 'quantity',
        });
    });

    it('does not call onSaved for a rejected save', async () => {
        const { result, onSaved } = renderForm(
            makeSave(async () => ({
                status: 'error',
                code: 'invalid_quantity',
                message: '수량을 확인해 주세요.',
            }))
        );

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(onSaved).not.toHaveBeenCalled();
    });

    it('shows the unexpected-error message with no field when the save throws', async () => {
        const { result } = renderForm(
            makeSave(async () => {
                throw new Error('network down');
            })
        );

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(result.current.error).toEqual({
            message: UNEXPECTED,
            field: null,
        });
    });

    it('ignores a second submit while the first save is still in flight', async () => {
        const deferred = Promise.withResolvers<SavePortfolioResult>();
        const save = makeSave(() => deferred.promise);
        const { result } = renderForm(save);

        await act(async () => {
            const first = result.current.handleSubmit(submitEvent());
            const second = result.current.handleSubmit(submitEvent());
            deferred.resolve({ status: 'ok', holding: HOLDING });
            await Promise.all([first, second]);
        });

        expect(save.mutateAsync).toHaveBeenCalledTimes(1);
    });

    it.each<[string, () => Promise<SavePortfolioResult>]>([
        ['ok', async () => ({ status: 'ok', holding: HOLDING })],
        [
            'rejected',
            async () => ({
                status: 'error',
                code: 'invalid_quantity',
                message: '수량을 확인해 주세요.',
            }),
        ],
        [
            'with a thrown mutation (submitHolding maps it to failed)',
            async () => {
                throw new Error('network down');
            },
        ],
    ])(
        'accepts a new submit once a save that ended %s has settled',
        async (_outcome, mutateAsync) => {
            const save = makeSave(mutateAsync);
            const { result } = renderForm(save);

            await act(() => result.current.handleSubmit(submitEvent()));
            await act(() => result.current.handleSubmit(submitEvent()));

            expect(save.mutateAsync).toHaveBeenCalledTimes(2);
        }
    );

    it('does not submit while a save from an earlier popover is still pending', async () => {
        const save = makeSave(
            async () => ({ status: 'ok', holding: HOLDING }),
            true
        );
        const { result } = renderForm(save);

        await act(() => result.current.handleSubmit(submitEvent()));

        expect(save.mutateAsync).not.toHaveBeenCalled();
    });

    describe('focus after a rejected save', () => {
        const attached: HTMLInputElement[] = [];

        function attachInputs(
            hook: ReturnType<typeof renderForm>['result']['current']
        ) {
            const quantityInput = document.createElement('input');
            const priceInput = document.createElement('input');
            document.body.append(quantityInput, priceInput);
            attached.push(quantityInput, priceInput);
            hook.quantityRef.current = quantityInput;
            hook.priceRef.current = priceInput;
            return { quantityInput, priceInput };
        }

        afterEach(() => {
            attached.splice(0).forEach(input => input.remove());
        });

        it('focuses the quantity field for a quantity rejection', async () => {
            const { result } = renderForm(
                makeSave(async () => ({
                    status: 'error',
                    code: 'invalid_quantity',
                    message: '수량을 확인해 주세요.',
                }))
            );
            const { quantityInput } = attachInputs(result.current);

            await act(() => result.current.handleSubmit(submitEvent()));

            expect(document.activeElement).toBe(quantityInput);
        });

        it('moves no focus for a rejection without a field', async () => {
            const { result } = renderForm(
                makeSave(async () => ({
                    status: 'error',
                    code: 'storage_unavailable',
                    message: '잠시 후 다시 시도해 주세요.',
                }))
            );
            attachInputs(result.current);

            await act(() => result.current.handleSubmit(submitEvent()));

            expect(document.activeElement).toBe(document.body);
        });
    });

    it('keeps the change handlers stable across renders', () => {
        const { result, rerender } = renderForm(
            makeSave(async () => ({ status: 'ok', holding: HOLDING }))
        );
        const { changeQuantity, changeAveragePrice } = result.current;

        act(() => result.current.changeQuantity('4'));
        rerender({
            symbol: 'AAPL',
            holding: null,
            save: makeSave(async () => ({ status: 'ok', holding: HOLDING })),
            onSaved: vi.fn(),
            unexpectedErrorMessage: UNEXPECTED,
        });

        expect(result.current.changeQuantity).toBe(changeQuantity);
        expect(result.current.changeAveragePrice).toBe(changeAveragePrice);
    });
});
