// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useSignupForm } from '@/features/auth-signup/hooks/useSignupForm';

vi.mock('@/features/auth-signup/actions/registerAction', () => ({
    registerAction: vi.fn(),
}));

describe('useSignupForm', () => {
    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useSignupForm());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({ error: null });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() => useSignupForm());
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });
});
