import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';

interface DialogProps {
    readonly active: boolean;
}

function Dialog({ active }: DialogProps) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(ref, active);
    return (
        <div ref={ref} role="dialog" tabIndex={-1} data-testid="dialog">
            <button data-testid="dialog-close">close</button>
            <button data-testid="dialog-action">action</button>
        </div>
    );
}

function Harness({ active }: DialogProps) {
    return (
        <>
            <button data-testid="trigger">trigger</button>
            <Dialog active={active} />
        </>
    );
}

describe('useFocusTrap', () => {
    it('mount시 첫 번째 focusable 요소로 포커스를 이동시킨다', () => {
        const trigger = document.createElement('button');
        trigger.setAttribute('data-testid', 'pre');
        document.body.appendChild(trigger);
        trigger.focus();
        expect(document.activeElement).toBe(trigger);

        render(<Harness active={true} />);
        expect(document.activeElement).toBe(screen.getByTestId('dialog-close'));
        document.body.removeChild(trigger);
    });

    it('active=true → false 전환시 trigger로 포커스가 복원된다', () => {
        const { rerender } = render(<Harness active={false} />);
        const trigger = screen.getByTestId('trigger');
        trigger.focus();
        expect(document.activeElement).toBe(trigger);

        rerender(<Harness active={true} />);
        expect(document.activeElement).toBe(screen.getByTestId('dialog-close'));

        rerender(<Harness active={false} />);
        expect(document.activeElement).toBe(trigger);
    });

    it('active=false면 포커스를 이동시키지 않는다', () => {
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();

        render(<Harness active={false} />);
        expect(document.activeElement).toBe(trigger);
        document.body.removeChild(trigger);
    });

    it('Tab wraps from last to first focusable element', () => {
        render(<Harness active={true} />);

        const closeBtn = screen.getByTestId('dialog-close');
        const actionBtn = screen.getByTestId('dialog-action');

        actionBtn.focus();
        expect(document.activeElement).toBe(actionBtn);

        fireEvent.keyDown(document, { key: 'Tab' });
        expect(document.activeElement).toBe(closeBtn);
    });

    it('Shift+Tab wraps from first to last focusable element', () => {
        render(<Harness active={true} />);

        const closeBtn = screen.getByTestId('dialog-close');
        const actionBtn = screen.getByTestId('dialog-action');

        // Focus should be on first (close) after mount
        expect(document.activeElement).toBe(closeBtn);

        // Shift+Tab from first element should wrap to last
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(actionBtn);
    });

    it('Tab does nothing when non-Tab key is pressed', () => {
        render(<Harness active={true} />);

        const closeBtn = screen.getByTestId('dialog-close');
        expect(document.activeElement).toBe(closeBtn);

        fireEvent.keyDown(document, { key: 'Escape' });
        // Focus should not change
        expect(document.activeElement).toBe(closeBtn);
    });

    it('focuses container with tabindex when no focusable children exist', () => {
        function EmptyDialog({ active }: DialogProps) {
            const ref = useRef<HTMLDivElement>(null);
            useFocusTrap(ref, active);
            return (
                <div
                    ref={ref}
                    role="dialog"
                    tabIndex={-1}
                    data-testid="empty-dialog"
                >
                    <p>No focusable elements here</p>
                </div>
            );
        }

        render(<EmptyDialog active={true} />);
        expect(document.activeElement).toBe(screen.getByTestId('empty-dialog'));
    });

    it('does not restore focus when previouslyFocused is no longer in DOM', () => {
        const trigger = document.createElement('button');
        trigger.setAttribute('data-testid', 'removable');
        document.body.appendChild(trigger);
        trigger.focus();
        expect(document.activeElement).toBe(trigger);

        const { rerender } = render(<Harness active={true} />);
        expect(document.activeElement).toBe(screen.getByTestId('dialog-close'));

        // Remove the trigger from DOM before deactivating trap
        document.body.removeChild(trigger);

        rerender(<Harness active={false} />);
        // Should not throw, focus stays wherever it is
        expect(document.activeElement).not.toBe(trigger);
    });

    it('Shift+Tab wraps when focus is on the container itself', () => {
        render(<Harness active={true} />);

        const dialog = screen.getByTestId('dialog');
        const actionBtn = screen.getByTestId('dialog-action');

        // Manually focus the container
        dialog.focus();
        expect(document.activeElement).toBe(dialog);

        // Shift+Tab from container should wrap to last
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(actionBtn);
    });
});
