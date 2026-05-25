import { render, screen } from '@testing-library/react';
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
});
