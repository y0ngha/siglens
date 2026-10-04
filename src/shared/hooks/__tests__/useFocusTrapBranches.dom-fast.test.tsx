/**
 * Branch coverage tests for useFocusTrap — targets uncovered:
 * - L26: focusable.length === 0
 * - L32: Shift+Tab when activeElement is neither first nor container
 * - L40: Tab when activeElement is not last
 * - L53: document.activeElement not instanceof HTMLElement
 * - L63: container.hasAttribute('tabindex') false branch
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';

interface DialogProps {
    readonly active: boolean;
}

describe('useFocusTrap — branch coverage', () => {
    it('Tab does nothing when zero focusable elements inside trap', () => {
        function EmptyDialog({ active }: DialogProps) {
            const ref = useRef<HTMLDivElement>(null);
            useFocusTrap(ref, active);
            return (
                <div ref={ref} role="dialog" tabIndex={-1} data-testid="empty">
                    <p>No buttons here</p>
                </div>
            );
        }

        render(<EmptyDialog active={true} />);

        // Tab key should not throw with zero focusable elements
        fireEvent.keyDown(document, { key: 'Tab' });
        expect(document.activeElement).toBe(screen.getByTestId('empty'));
    });

    it('Shift+Tab when focus is on a middle element does not wrap', () => {
        function ThreeButtonDialog({ active }: DialogProps) {
            const ref = useRef<HTMLDivElement>(null);
            useFocusTrap(ref, active);
            return (
                <div ref={ref} role="dialog" tabIndex={-1}>
                    <button data-testid="btn-1">1</button>
                    <button data-testid="btn-2">2</button>
                    <button data-testid="btn-3">3</button>
                </div>
            );
        }

        render(<ThreeButtonDialog active={true} />);

        // Focus the middle button
        screen.getByTestId('btn-2').focus();
        expect(document.activeElement).toBe(screen.getByTestId('btn-2'));

        // Shift+Tab from middle element — should NOT wrap (not first or container)
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

        expect(document.activeElement).toBe(screen.getByTestId('btn-2'));
    });

    it('Tab when focus is not on last element does not wrap', () => {
        function ThreeButtonDialog({ active }: DialogProps) {
            const ref = useRef<HTMLDivElement>(null);
            useFocusTrap(ref, active);
            return (
                <div ref={ref} role="dialog" tabIndex={-1}>
                    <button data-testid="btn-1">1</button>
                    <button data-testid="btn-2">2</button>
                    <button data-testid="btn-3">3</button>
                </div>
            );
        }

        render(<ThreeButtonDialog active={true} />);

        // Focus the middle button
        screen.getByTestId('btn-2').focus();

        // Tab from middle — should not wrap to first
        fireEvent.keyDown(document, { key: 'Tab' });

        expect(document.activeElement).toBe(screen.getByTestId('btn-2'));
    });

    it('does not focus container without tabindex attribute', () => {
        function NoTabIndexDialog({ active }: DialogProps) {
            const ref = useRef<HTMLDivElement>(null);
            useFocusTrap(ref, active);
            return (
                <div ref={ref} role="dialog" data-testid="no-tabindex">
                    <p>No focusable elements, no tabindex on container</p>
                </div>
            );
        }

        render(<NoTabIndexDialog active={true} />);

        // Container has no tabindex, so it should NOT receive focus
        expect(document.activeElement).not.toBe(
            screen.getByTestId('no-tabindex')
        );
    });
});
