import type { SubmitEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { SavePortfolioResult } from '@/entities/portfolio/model';
import type { UseSymbolHoldingReturn } from '../hooks/useSymbolHolding';
import { useHoldingPopoverForm } from '../hooks/useHoldingPopoverForm';
import { submitHolding } from '../lib/submitHolding';

/*
 * Isolated from `useHoldingPopoverForm.test.tsx` so the other tests keep the
 * real `submitHolding`. The real one never rejects (it maps a thrown save to
 * `failed`), so only a mock can reach the hook's `finally` on a throw.
 */
vi.mock('../lib/submitHolding', async importOriginal => ({
    ...(await importOriginal<typeof import('../lib/submitHolding')>()),
    submitHolding: vi.fn(),
}));

type Save = UseSymbolHoldingReturn['save'];

function makeSave(): Save {
    return {
        mutateAsync: vi.fn(async (): Promise<SavePortfolioResult> => ({
            status: 'error',
            code: 'unknown',
            message: 'unused',
        })),
        isPending: false,
    } as unknown as Save;
}

function submitEvent(): SubmitEvent<HTMLFormElement> {
    return {
        preventDefault: vi.fn(),
    } as unknown as SubmitEvent<HTMLFormElement>;
}

describe('useHoldingPopoverForm when submitHolding itself rejects', () => {
    beforeEach(() => {
        vi.mocked(submitHolding).mockReset();
    });

    it('releases the in-flight guard so a later submit is still accepted', async () => {
        vi.mocked(submitHolding)
            .mockRejectedValueOnce(new Error('leaked rejection'))
            .mockResolvedValueOnce({ kind: 'saved' });
        const onSaved = vi.fn();
        const { result } = renderHook(() =>
            useHoldingPopoverForm({
                symbol: 'AAPL',
                holding: null,
                save: makeSave(),
                onSaved,
                unexpectedErrorMessage: '알 수 없는 오류',
            })
        );

        await act(async () => {
            await expect(
                result.current.handleSubmit(submitEvent())
            ).rejects.toThrow('leaked rejection');
        });
        await act(() => result.current.handleSubmit(submitEvent()));

        expect(submitHolding).toHaveBeenCalledTimes(2);
        expect(onSaved).toHaveBeenCalledTimes(1);
    });
});
