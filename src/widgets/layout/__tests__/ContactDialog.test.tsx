vi.mock('@/features/contact-form', () => ({
    ContactForm: () => <div data-testid="contact-form" />,
}));
vi.mock('@/shared/hooks/useDialog', () => ({
    useDialog: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        dialogRef: { current: null },
        triggerRef: { current: null },
    })),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { ContactDialog } from '../ContactDialog';
import { useDialog } from '@/shared/hooks/useDialog';

describe('ContactDialog', () => {
    it('renders the trigger button with default label', () => {
        render(<ContactDialog />);

        expect(
            screen.getByRole('button', { name: /문의하기/ })
        ).toBeInTheDocument();
    });

    it('renders the trigger button with custom label', () => {
        render(<ContactDialog triggerLabel="커스텀 라벨" />);

        expect(
            screen.getByRole('button', { name: /커스텀 라벨/ })
        ).toBeInTheDocument();
    });

    it('does not render the dialog when closed', () => {
        render(<ContactDialog />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the dialog with ContactForm when open', () => {
        vi.mocked(useDialog).mockReturnValue({
            isOpen: true,
            open: vi.fn(),
            close: vi.fn(),
            dialogRef: { current: null },
            triggerRef: { current: null },
        });

        render(<ContactDialog />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByTestId('contact-form')).toBeInTheDocument();
    });

    it('calls open when the trigger button is clicked', () => {
        const openFn = vi.fn();
        vi.mocked(useDialog).mockReturnValue({
            isOpen: false,
            open: openFn,
            close: vi.fn(),
            dialogRef: { current: null },
            triggerRef: { current: null },
        });

        render(<ContactDialog />);
        fireEvent.click(screen.getByRole('button', { name: /문의하기/ }));

        expect(openFn).toHaveBeenCalledTimes(1);
    });
});
