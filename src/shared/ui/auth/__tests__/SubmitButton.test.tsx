import { fireEvent, render, screen } from '@testing-library/react';
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

    it('shows pending label and marks button aria-disabled when pending', () => {
        mockUseFormStatus.mockReturnValue({ pending: true });
        render(<SubmitButton label="Sign In" pendingLabel="Signing in…" />);
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button).toHaveTextContent('Signing in…');
    });

    it('keeps focus on the button when it becomes pending', () => {
        const { rerender } = render(<SubmitButton label="Sign In" />);
        const button = screen.getByRole('button');
        button.focus();

        mockUseFormStatus.mockReturnValue({ pending: true });
        rerender(<SubmitButton label="Sign In" />);

        expect(button).not.toBeDisabled();
        expect(button).toHaveFocus();
    });

    it('prevents a second submit click while pending', () => {
        mockUseFormStatus.mockReturnValue({ pending: true });
        const onSubmit = vi.fn((e: Event) => e.preventDefault());
        render(
            <form onSubmit={e => onSubmit(e.nativeEvent)}>
                <SubmitButton label="Sign In" />
            </form>
        );

        fireEvent.click(screen.getByRole('button'));

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits on click when not pending', () => {
        const onSubmit = vi.fn((e: Event) => e.preventDefault());
        render(
            <form onSubmit={e => onSubmit(e.nativeEvent)}>
                <SubmitButton label="Sign In" />
            </form>
        );

        fireEvent.click(screen.getByRole('button'));

        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('uses default pending label when not specified', () => {
        mockUseFormStatus.mockReturnValue({ pending: true });
        render(<SubmitButton label="Sign In" />);
        expect(screen.getByRole('button')).toHaveTextContent('처리 중…');
    });

    it('stays disabled while the caller withholds submission', () => {
        render(<SubmitButton label="Delete" disabled />);
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('renders the danger tone fill', () => {
        render(<SubmitButton label="Delete" tone="danger" />);
        const button = screen.getByRole('button');
        expect(button).toHaveClass('bg-ui-danger-fill');
        expect(button).not.toHaveClass('bg-primary-600');
    });
});
