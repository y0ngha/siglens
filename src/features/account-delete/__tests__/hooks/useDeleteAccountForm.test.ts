// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useDeleteAccountForm } from '@/features/account-delete/hooks/useDeleteAccountForm';

vi.mock('@/features/account-delete/actions/deleteAccountAction', () => ({
    deleteAccountAction: vi.fn(),
}));

describe('useDeleteAccountForm', () => {
    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useDeleteAccountForm());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({ error: null });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('initial state has error: null', () => {
        const { result } = renderHook(() => useDeleteAccountForm());

        expect(result.current[0]).toStrictEqual({ error: null });
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() => useDeleteAccountForm());
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });
});
