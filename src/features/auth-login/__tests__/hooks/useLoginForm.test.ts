// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useLoginForm } from '@/features/auth-login/hooks/useLoginForm';

vi.mock('@/features/auth-login/actions/loginAction', () => ({
    loginAction: vi.fn(),
}));

describe('useLoginForm', () => {
    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useLoginForm());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({ error: null });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() => useLoginForm());
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });
});
