// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useFinalizeOAuthSignup } from '@/features/auth-oauth-consent/hooks/useFinalizeOAuthSignup';

vi.mock(
    '@/features/auth-oauth-consent/actions/finalizeOAuthSignupAction',
    () => ({
        finalizeOAuthSignupAction: vi.fn(),
    })
);

describe('useFinalizeOAuthSignup', () => {
    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useFinalizeOAuthSignup());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({});
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('initial state is an empty object', () => {
        const { result } = renderHook(() => useFinalizeOAuthSignup());

        expect(result.current[0]).toStrictEqual({});
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() => useFinalizeOAuthSignup());
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });
});
