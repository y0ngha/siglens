import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDialog } from '@/shared/hooks/useDialog';

function DialogHarness() {
    const { isOpen, open, close, dialogRef, triggerRef } = useDialog();
    return (
        <>
            <button ref={triggerRef} onClick={open}>
                Open
            </button>
            {isOpen && (
                <div
                    ref={dialogRef}
                    tabIndex={-1}
                    role="dialog"
                    data-testid="dialog"
                >
                    <p>Dialog content</p>
                    <button onClick={close}>Close</button>
                </div>
            )}
        </>
    );
}

describe('useDialog', () => {
    it('starts closed', () => {
        render(<DialogHarness />);
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('opens on trigger click', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        await user.click(screen.getByText('Open'));
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('closes on close button click', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        await user.click(screen.getByText('Open'));
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
        await user.click(screen.getByText('Close'));
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('closes on Escape key', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        await user.click(screen.getByText('Open'));
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('closes on click outside', async () => {
        const user = userEvent.setup();
        render(
            <div>
                <DialogHarness />
                <div data-testid="outside">outside</div>
            </div>
        );
        await user.click(screen.getByText('Open'));
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
        await user.pointer({
            target: screen.getByTestId('outside'),
            keys: '[MouseLeft]',
        });
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('returns focus to trigger after closing', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        const trigger = screen.getByText('Open');
        await user.click(trigger);
        await user.click(screen.getByText('Close'));
        expect(trigger).toHaveFocus();
    });
});
