import { render, screen } from '@testing-library/react';
import { AuthErrorAlert } from '@/shared/ui/auth/AuthErrorAlert';

describe('AuthErrorAlert', () => {
    it('renders the error message', () => {
        render(<AuthErrorAlert message="Invalid email" />);
        expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });

    it('has role="alert" for accessibility', () => {
        render(<AuthErrorAlert message="Something went wrong" />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders the warning icon as decorative (aria-hidden)', () => {
        const { container } = render(<AuthErrorAlert message="Error" />);
        const icon = container.querySelector('[aria-hidden]');
        expect(icon).toBeInTheDocument();
    });

    it('accepts ReactNode as message', () => {
        render(
            <AuthErrorAlert
                message={<strong data-testid="rich">Bold error</strong>}
            />
        );
        expect(screen.getByTestId('rich')).toBeInTheDocument();
    });
});
