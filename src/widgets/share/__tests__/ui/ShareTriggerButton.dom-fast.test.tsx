import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ShareTriggerButton } from '../../ui/button/ShareTriggerButton';

function renderTrigger(
    overrides: Partial<Parameters<typeof ShareTriggerButton>[0]> = {}
) {
    const props = {
        buttonRef: createRef<HTMLButtonElement>(),
        pending: false,
        describedById: undefined,
        onClick: vi.fn(),
        onPreload: vi.fn(),
        ...overrides,
    };
    render(<ShareTriggerButton {...props} />);
    return { ...props, button: screen.getByRole('button') };
}

describe('ShareTriggerButton', () => {
    it('is named "분석 결과 공유"', () => {
        const { button } = renderTrigger();
        expect(button).toHaveAccessibleName('분석 결과 공유');
    });

    it('attaches the forwarded ref to the button', () => {
        const { buttonRef, button } = renderTrigger();
        expect(buttonRef.current).toBe(button);
    });

    it('calls onClick when clicked', () => {
        const { onClick, button } = renderTrigger();
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onPreload on pointer enter and on focus', () => {
        const { onPreload, button } = renderTrigger();
        fireEvent.pointerEnter(button);
        fireEvent.focus(button);
        expect(onPreload).toHaveBeenCalledTimes(2);
    });

    it('links aria-describedby only when an id is passed', () => {
        const { button } = renderTrigger({ describedById: 'share-notice' });
        expect(button).toHaveAttribute('aria-describedby', 'share-notice');
    });

    it('has no aria-describedby without an id', () => {
        const { button } = renderTrigger();
        expect(button).not.toHaveAttribute('aria-describedby');
    });

    describe('when pending', () => {
        it('marks the button busy and aria-disabled', () => {
            const { button } = renderTrigger({ pending: true });
            expect(button).toHaveAttribute('aria-busy', 'true');
            expect(button).toHaveAttribute('aria-disabled', 'true');
        });

        it('keeps the button focusable (no disabled attribute)', () => {
            const { button } = renderTrigger({ pending: true });
            expect(button).not.toHaveAttribute('disabled');
        });

        it('replaces the share icon with the spinner', () => {
            const { button } = renderTrigger({ pending: true });
            expect(button.querySelector('svg')).toBeNull();
            expect(button.querySelector('.animate-spin')).not.toBeNull();
        });
    });

    describe('when idle', () => {
        it('sets neither aria-busy nor aria-disabled', () => {
            const { button } = renderTrigger();
            expect(button).not.toHaveAttribute('aria-busy');
            expect(button).not.toHaveAttribute('aria-disabled');
        });

        it('shows the share icon', () => {
            const { button } = renderTrigger();
            expect(button.querySelector('svg')).not.toBeNull();
            expect(button.querySelector('.animate-spin')).toBeNull();
        });
    });
});
