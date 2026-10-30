// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { usePasswordConfirmation } from '@/features/auth-password-reset/hooks/usePasswordConfirmation';

function renderConfirmation(formAction = vi.fn()) {
    return renderHook(() => usePasswordConfirmation(formAction));
}

describe('usePasswordConfirmation', () => {
    it('starts with empty values and no mismatch', () => {
        const { result } = renderConfirmation();

        expect(result.current.password).toBe('');
        expect(result.current.confirmPassword).toBe('');
        expect(result.current.isMismatch).toBe(false);
    });

    it('forwards the form data to formAction when both values match', () => {
        const formAction = vi.fn();
        const { result } = renderConfirmation(formAction);
        const formData = new FormData();
        act(() => {
            result.current.changePassword('Secret123');
            result.current.changeConfirmPassword('Secret123');
        });

        act(() => result.current.submit(formData));

        expect(formAction).toHaveBeenCalledWith(formData);
    });

    it('blocks formAction when the values differ', () => {
        const formAction = vi.fn();
        const { result } = renderConfirmation(formAction);
        act(() => {
            result.current.changePassword('Secret123');
            result.current.changeConfirmPassword('Secret124');
        });

        act(() => result.current.submit(new FormData()));

        expect(formAction).not.toHaveBeenCalled();
    });

    it('flags a mismatch after submitting differing values', () => {
        const { result } = renderConfirmation();
        act(() => result.current.changePassword('Secret123'));

        act(() => result.current.submit(new FormData()));

        expect(result.current.isMismatch).toBe(true);
    });

    it('clears the mismatch when the password changes', () => {
        const { result } = renderConfirmation();
        act(() => result.current.changePassword('Secret123'));
        act(() => result.current.submit(new FormData()));

        act(() => result.current.changePassword('Secret1234'));

        expect(result.current.isMismatch).toBe(false);
    });

    it('clears the mismatch when the confirmation changes', () => {
        const { result } = renderConfirmation();
        act(() => result.current.changePassword('Secret123'));
        act(() => result.current.submit(new FormData()));

        act(() => result.current.changeConfirmPassword('S'));

        expect(result.current.isMismatch).toBe(false);
    });

    it('keeps both values after a matching submit', () => {
        const { result } = renderConfirmation();
        act(() => {
            result.current.changePassword('Secret123');
            result.current.changeConfirmPassword('Secret123');
        });

        act(() => result.current.submit(new FormData()));

        expect(result.current.password).toBe('Secret123');
        expect(result.current.confirmPassword).toBe('Secret123');
    });

    it('returns stable change handlers across re-renders', () => {
        const { result, rerender } = renderConfirmation();
        const { changePassword, changeConfirmPassword } = result.current;

        rerender();

        expect(result.current.changePassword).toBe(changePassword);
        expect(result.current.changeConfirmPassword).toBe(
            changeConfirmPassword
        );
    });
});
