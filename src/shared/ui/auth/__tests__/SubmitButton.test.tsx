import { render, screen } from '@testing-library/react';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';

const mockUseFormStatus = vi.fn(() => ({ pending: false }));

vi.mock('react-dom', async () => {
    const actual = await vi.importActual('react-dom');
    return { ...actual, useFormStatus: () => mockUseFormStatus() };
});

describe('SubmitButton', () => {
    afterEach(() => {
        mockUseFormStatus.mockReturnValue({ pending: false });
    });

    it('renders the label text', () => {
        render(<SubmitButton label="Sign In" />);
        expect(screen.getByRole('button')).toHaveTextContent('Sign In');
    });

    it('has type="submit"', () => {
        render(<SubmitButton label="Sign In" />);
        expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('is not disabled when not pending', () => {
        render(<SubmitButton label="Sign In" />);
        expect(screen.getByRole('button')).not.toBeDisabled();
    });

    it('is not aria-busy when not pending', () => {
        render(<SubmitButton label="Sign In" />);
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-busy',
            'false'
        );
    });

    it('shows pending label and disables button when pending', () => {
        mockUseFormStatus.mockReturnValue({ pending: true });
        render(<SubmitButton label="Sign In" pendingLabel="Signing in…" />);
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button).toHaveTextContent('Signing in…');
    });

    it('uses default pending label when not specified', () => {
        mockUseFormStatus.mockReturnValue({ pending: true });
        render(<SubmitButton label="Sign In" />);
        expect(screen.getByRole('button')).toHaveTextContent('처리 중…');
    });
});
