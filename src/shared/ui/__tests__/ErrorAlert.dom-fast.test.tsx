import { render, screen } from '@testing-library/react';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';

describe('ErrorAlert', () => {
    it('renders the error message', () => {
        render(<ErrorAlert message="Invalid email" />);
        expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });

    it('has role="alert" for accessibility', () => {
        render(<ErrorAlert message="Something went wrong" />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders the warning icon as decorative (aria-hidden)', () => {
        const { container } = render(<ErrorAlert message="Error" />);
        const icon = container.querySelector('[aria-hidden]');
        expect(icon).toBeInTheDocument();
    });

    it('accepts ReactNode as message', () => {
        render(
            <ErrorAlert
                message={<strong data-testid="rich">Bold error</strong>}
            />
        );
        expect(screen.getByTestId('rich')).toBeInTheDocument();
    });
});
