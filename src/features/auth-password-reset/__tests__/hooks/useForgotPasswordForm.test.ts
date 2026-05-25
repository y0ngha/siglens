// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useForgotPasswordForm } from '@/features/auth-password-reset/hooks/useForgotPasswordForm';

vi.mock(
    '@/features/auth-password-reset/actions/requestPasswordResetAction',
    () => ({
        requestPasswordResetAction: vi.fn(),
    })
);

describe('useForgotPasswordForm', () => {
    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useForgotPasswordForm());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({ submitted: false });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('initial state has submitted: false', () => {
        const { result } = renderHook(() => useForgotPasswordForm());

        expect(result.current[0]).toStrictEqual({ submitted: false });
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() => useForgotPasswordForm());
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });
});
