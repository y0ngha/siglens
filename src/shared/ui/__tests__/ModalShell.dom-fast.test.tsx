import { fireEvent, render, screen } from '@testing-library/react';
import { ModalShell } from '@/shared/ui/ModalShell';

function renderShell(onClose = vi.fn(), focusPanel?: boolean) {
    render(
        <ModalShell titleId="t" onClose={onClose} focusPanel={focusPanel}>
            <h2 id="t">Title</h2>
            <button type="button">Action</button>
        </ModalShell>
    );
    return onClose;
}

describe('ModalShell', () => {
    it('labels a single modal dialog by its title', () => {
        renderShell();
        const dialog = screen.getByRole('dialog', { name: 'Title' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('closes on a backdrop click but not on a click inside the panel', () => {
        const onClose = renderShell();
        fireEvent.click(screen.getByRole('dialog'));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('modal-backdrop'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('portals the overlay to document.body so it can cover the sticky header', () => {
        const { container } = render(
            <div data-testid="page-body">
                <ModalShell titleId="t" onClose={vi.fn()}>
                    <h2 id="t">Title</h2>
                </ModalShell>
            </div>
        );
        const backdrop = screen.getByTestId('modal-backdrop');
        expect(container.contains(backdrop)).toBe(false);
        expect(backdrop.parentElement).toBe(document.body);
    });

    it('closes on Escape', () => {
        const onClose = renderShell();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('moves focus to the first control by default and restores it on unmount', () => {
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();

        const { unmount } = render(
            <ModalShell titleId="t" onClose={vi.fn()}>
                <h2 id="t">Title</h2>
                <button type="button">Action</button>
            </ModalShell>
        );
        expect(screen.getByRole('button', { name: 'Action' })).toHaveFocus();
        unmount();
        expect(trigger).toHaveFocus();
        trigger.remove();
    });

    it('focuses the panel itself when focusPanel is set', () => {
        renderShell(vi.fn(), true);
        expect(screen.getByRole('dialog')).toHaveFocus();
    });
});
