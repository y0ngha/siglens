import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';

function PopoverHarness() {
    const popoverRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    // Pass both popover and toggle refs so clicking the toggle is not "outside"
    const { isOpen, open, close, toggle } = usePopoverToggle([
        popoverRef,
        toggleRef,
    ]);
    return (
        <div>
            <button onClick={open} data-testid="open-btn">
                Open
            </button>
            <button onClick={close} data-testid="close-btn">
                Close
            </button>
            <button ref={toggleRef} onClick={toggle} data-testid="toggle-btn">
                Toggle
            </button>
            <div ref={popoverRef} data-testid="popover">
                {isOpen ? 'OPEN' : 'CLOSED'}
            </div>
            <div data-testid="outside">Outside</div>
        </div>
    );
}

describe('usePopoverToggle', () => {
    it('starts closed', () => {
        render(<PopoverHarness />);
        expect(screen.getByTestId('popover')).toHaveTextContent('CLOSED');
    });

    it('opens via open()', async () => {
        const user = userEvent.setup();
        render(<PopoverHarness />);
        await user.click(screen.getByTestId('open-btn'));
        expect(screen.getByTestId('popover')).toHaveTextContent('OPEN');
    });

    it('closes via close()', async () => {
        const user = userEvent.setup();
        render(<PopoverHarness />);
        await user.click(screen.getByTestId('open-btn'));
        await user.click(screen.getByTestId('close-btn'));
        expect(screen.getByTestId('popover')).toHaveTextContent('CLOSED');
    });

    it('toggles between open and closed', async () => {
        const user = userEvent.setup();
        render(<PopoverHarness />);
        await user.click(screen.getByTestId('toggle-btn'));
        expect(screen.getByTestId('popover')).toHaveTextContent('OPEN');
        await user.click(screen.getByTestId('toggle-btn'));
        expect(screen.getByTestId('popover')).toHaveTextContent('CLOSED');
    });

    it('auto-closes on click outside when open', async () => {
        render(<PopoverHarness />);
        fireEvent.click(screen.getByTestId('open-btn'));
        expect(screen.getByTestId('popover')).toHaveTextContent('OPEN');

        fireEvent.pointerDown(screen.getByTestId('outside'));
        expect(screen.getByTestId('popover')).toHaveTextContent('CLOSED');
    });

    it('does not auto-close on click inside when open', async () => {
        render(<PopoverHarness />);
        fireEvent.click(screen.getByTestId('open-btn'));
        expect(screen.getByTestId('popover')).toHaveTextContent('OPEN');
        fireEvent.pointerDown(screen.getByTestId('popover'));
        expect(screen.getByTestId('popover')).toHaveTextContent('OPEN');
    });
});
