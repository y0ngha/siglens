import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';

function SingleRefHarness({
    handler,
    enabled = true,
}: {
    handler: () => void;
    enabled?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useOnClickOutside(ref, handler, { enabled });
    return (
        <div>
            <div ref={ref} data-testid="inside">
                Inside
            </div>
            <div data-testid="outside">Outside</div>
        </div>
    );
}

function MultiRefHarness({ handler }: { handler: () => void }) {
    const ref1 = useRef<HTMLDivElement>(null);
    const ref2 = useRef<HTMLDivElement>(null);
    useOnClickOutside([ref1, ref2], handler, { enabled: true });
    return (
        <div>
            <div ref={ref1} data-testid="inside1">
                Inside 1
            </div>
            <div ref={ref2} data-testid="inside2">
                Inside 2
            </div>
            <div data-testid="outside">Outside</div>
        </div>
    );
}

describe('useOnClickOutside', () => {
    it('calls handler on pointerdown outside ref', () => {
        const handler = vi.fn();
        render(<SingleRefHarness handler={handler} />);
        fireEvent.pointerDown(screen.getByTestId('outside'));
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not call handler on pointerdown inside ref', () => {
        const handler = vi.fn();
        render(<SingleRefHarness handler={handler} />);
        fireEvent.pointerDown(screen.getByTestId('inside'));
        expect(handler).not.toHaveBeenCalled();
    });

    it('does not call handler when disabled', () => {
        const handler = vi.fn();
        render(<SingleRefHarness handler={handler} enabled={false} />);
        fireEvent.pointerDown(screen.getByTestId('outside'));
        expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple refs — does not fire when clicking inside any ref', () => {
        const handler = vi.fn();
        render(<MultiRefHarness handler={handler} />);
        fireEvent.pointerDown(screen.getByTestId('inside1'));
        expect(handler).not.toHaveBeenCalled();
        fireEvent.pointerDown(screen.getByTestId('inside2'));
        expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple refs — fires when clicking outside all refs', () => {
        const handler = vi.fn();
        render(<MultiRefHarness handler={handler} />);
        fireEvent.pointerDown(screen.getByTestId('outside'));
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
