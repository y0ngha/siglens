import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthFieldGroup } from '@/shared/ui/auth/AuthFieldGroup';

describe('AuthFieldGroup', () => {
    const defaultProps = {
        id: 'email',
        name: 'email',
        label: 'Email',
        type: 'email' as const,
    };

    it('renders a labeled input', () => {
        render(<AuthFieldGroup {...defaultProps} />);
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('renders the label text', () => {
        render(<AuthFieldGroup {...defaultProps} />);
        expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('sets the correct input type', () => {
        render(<AuthFieldGroup {...defaultProps} />);
        expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    });

    it('sets autoComplete when provided', () => {
        render(<AuthFieldGroup {...defaultProps} autoComplete="email" />);
        expect(screen.getByLabelText('Email')).toHaveAttribute(
            'autocomplete',
            'email'
        );
    });

    it('sets required attribute when provided', () => {
        render(<AuthFieldGroup {...defaultProps} required />);
        expect(screen.getByLabelText('Email')).toBeRequired();
    });

    it('sets placeholder when provided', () => {
        render(
            <AuthFieldGroup {...defaultProps} placeholder="you@example.com" />
        );
        expect(
            screen.getByPlaceholderText('you@example.com')
        ).toBeInTheDocument();
    });

    it('displays an error message when error is provided', () => {
        render(<AuthFieldGroup {...defaultProps} error="Email is required" />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Email is required'
        );
    });

    it('sets aria-invalid when error is present', () => {
        render(<AuthFieldGroup {...defaultProps} error="Required" />);
        expect(screen.getByLabelText('Email')).toHaveAttribute(
            'aria-invalid',
            'true'
        );
    });

    it('sets aria-describedby pointing to error when error is present', () => {
        render(<AuthFieldGroup {...defaultProps} error="Required" />);
        const input = screen.getByLabelText('Email');
        expect(input).toHaveAttribute('aria-describedby', 'email-error');
    });

    it('does not set aria-describedby when no error', () => {
        render(<AuthFieldGroup {...defaultProps} />);
        const input = screen.getByLabelText('Email');
        expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('calls onChange when typing', async () => {
        const handleChange = vi.fn();
        const user = userEvent.setup();
        render(<AuthFieldGroup {...defaultProps} onChange={handleChange} />);
        await user.type(screen.getByLabelText('Email'), 'a');
        expect(handleChange).toHaveBeenCalled();
    });

    it('does not render error alert when no error', () => {
        render(<AuthFieldGroup {...defaultProps} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
