import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordField } from '@/shared/ui/auth/PasswordField';

vi.mock('@/shared/ui/EyeIcon', () => ({
    EyeIcon: ({ isVisible }: { isVisible: boolean }) => (
        <span data-testid="eye-icon">{isVisible ? 'visible' : 'hidden'}</span>
    ),
}));

describe('PasswordField', () => {
    const defaultProps = {
        id: 'password',
        name: 'password',
        label: 'Password',
        autoComplete: 'current-password' as const,
    };

    it('renders a labeled password input', () => {
        render(<PasswordField {...defaultProps} />);
        const input = screen.getByLabelText('Password');
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('type', 'password');
    });

    it('toggles visibility on eye button click', async () => {
        const user = userEvent.setup();
        render(<PasswordField {...defaultProps} />);
        const input = screen.getByLabelText('Password');
        expect(input).toHaveAttribute('type', 'password');

        const toggleButton = screen.getByRole('button', {
            name: /비밀번호 보이기/,
        });
        await user.click(toggleButton);
        expect(input).toHaveAttribute('type', 'text');

        const hideButton = screen.getByRole('button', {
            name: /비밀번호 숨기기/,
        });
        await user.click(hideButton);
        expect(input).toHaveAttribute('type', 'password');
    });

    it('sets aria-pressed on toggle button', async () => {
        const user = userEvent.setup();
        render(<PasswordField {...defaultProps} />);
        const toggleButton = screen.getByRole('button');
        expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
        await user.click(toggleButton);
        expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onChange with the input value', async () => {
        const handleChange = vi.fn();
        const user = userEvent.setup();
        render(<PasswordField {...defaultProps} onChange={handleChange} />);
        await user.type(screen.getByLabelText('Password'), 'abc');
        expect(handleChange).toHaveBeenCalledWith('a');
        expect(handleChange).toHaveBeenCalledWith('ab');
        expect(handleChange).toHaveBeenCalledWith('abc');
    });

    it('displays error message', () => {
        render(<PasswordField {...defaultProps} error="Too short" />);
        expect(screen.getByRole('alert')).toHaveTextContent('Too short');
    });

    it('sets aria-invalid when error is present', () => {
        render(<PasswordField {...defaultProps} error="Required" />);
        expect(screen.getByLabelText('Password')).toHaveAttribute(
            'aria-invalid',
            'true'
        );
    });

    it('renders hint when provided', () => {
        render(
            <PasswordField
                {...defaultProps}
                hint={<span data-testid="hint">Hint text</span>}
            />
        );
        expect(screen.getByTestId('hint')).toBeInTheDocument();
    });

    it('composes aria-describedby from error and describedById', () => {
        render(
            <PasswordField
                {...defaultProps}
                error="Error"
                describedById="pw-hint"
            />
        );
        const input = screen.getByLabelText('Password');
        expect(input.getAttribute('aria-describedby')).toContain(
            'password-error'
        );
        expect(input.getAttribute('aria-describedby')).toContain('pw-hint');
    });
});
