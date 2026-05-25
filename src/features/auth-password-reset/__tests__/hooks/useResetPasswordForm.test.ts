// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useResetPasswordForm } from '@/features/auth-password-reset/hooks/useResetPasswordForm';

vi.mock(
    '@/features/auth-password-reset/actions/confirmPasswordResetAction',
    () => ({
        confirmPasswordResetAction: vi.fn(),
    })
);

describe('useResetPasswordForm', () => {
    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useResetPasswordForm());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({ error: null });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() => useResetPasswordForm());
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });
});
