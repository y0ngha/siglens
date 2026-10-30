import { render, screen } from '@testing-library/react';
import { useLoginErrorFocus } from '@/features/auth-login/hooks/useLoginErrorFocus';
import { LOGIN_FIELD } from '@/features/auth-login/lib/loginFields';
import type { LoginFormState } from '@/shared/lib/auth/formTypes';

function Harness({ state }: { state: LoginFormState }) {
    const formRef = useLoginErrorFocus(state);
    return (
        <form ref={formRef}>
            <input aria-label="email" name={LOGIN_FIELD.email} />
            <input aria-label="password" name={LOGIN_FIELD.password} />
        </form>
    );
}

const FAILED: LoginFormState = {
    error: { code: 'invalid_credentials', message: '' },
};

describe('useLoginErrorFocus', () => {
    it('does not move focus while the state has no error', () => {
        render(<Harness state={{ error: null }} />);
        expect(screen.getByLabelText('password')).not.toHaveFocus();
    });

    it('focuses the password input when the state carries an error', () => {
        render(<Harness state={FAILED} />);
        expect(screen.getByLabelText('password')).toHaveFocus();
    });

    it('refocuses the password input on a new error state with the same code', () => {
        const { rerender } = render(<Harness state={FAILED} />);
        screen.getByLabelText('email').focus();

        rerender(<Harness state={{ ...FAILED }} />);

        expect(screen.getByLabelText('password')).toHaveFocus();
    });
});
