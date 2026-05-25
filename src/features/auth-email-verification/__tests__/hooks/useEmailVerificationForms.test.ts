// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import {
    useRequestEmailVerification,
    useVerifyEmail,
} from '@/features/auth-email-verification/hooks/useEmailVerificationForms';

vi.mock(
    '@/features/auth-email-verification/actions/requestEmailVerificationAction',
    () => ({
        requestEmailVerificationAction: vi.fn(),
    })
);

vi.mock('@/features/auth-email-verification/actions/verifyEmailAction', () => ({
    verifyEmailAction: vi.fn(),
}));

describe('useRequestEmailVerification', () => {
    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useRequestEmailVerification());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({ submitted: false, error: null });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('initial state has submitted: false and error: null', () => {
        const { result } = renderHook(() => useRequestEmailVerification());

        expect(result.current[0]).toStrictEqual({
            submitted: false,
            error: null,
        });
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() =>
            useRequestEmailVerification()
        );
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });
});

describe('useVerifyEmail', () => {
    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useVerifyEmail());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({ verified: false, error: null });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('initial state has verified: false and error: null', () => {
        const { result } = renderHook(() => useVerifyEmail());

        expect(result.current[0]).toStrictEqual({
            verified: false,
            error: null,
        });
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() => useVerifyEmail());
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });
});
