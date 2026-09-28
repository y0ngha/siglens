import { render, screen, fireEvent } from '@testing-library/react';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

// useEscapeKey/useOnClickOutside are left real (not mocked) so the tests below
// can exercise the actual Escape/click-outside close paths, the same style
// ThemeToggle's test uses for its sibling popover.
vi.mock('@/shared/lib/tooltipPosition', () => ({
    getTooltipPosition: () => ({ top: 100, left: 200 }),
}));

describe('InfoTooltip', () => {
    it('renders the trigger button', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        expect(
            screen.getByRole('button', { name: '추가 정보' })
        ).toBeInTheDocument();
    });

    it('does not show tooltip content initially', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows tooltip on click', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        fireEvent.click(screen.getByRole('button', { name: '추가 정보' }));
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Tooltip content')).toBeInTheDocument();
    });

    it('hides tooltip on second click', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        const trigger = screen.getByRole('button', { name: '추가 정보' });
        fireEvent.click(trigger);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        fireEvent.click(trigger);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('sets aria-expanded based on open state', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        const trigger = screen.getByRole('button', { name: '추가 정보' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('sets aria-describedby when tooltip is open', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        const trigger = screen.getByRole('button', { name: '추가 정보' });
        expect(trigger).not.toHaveAttribute('aria-describedby');
        fireEvent.click(trigger);
        const tooltipId = screen.getByRole('tooltip').getAttribute('id');
        expect(trigger).toHaveAttribute('aria-describedby', tooltipId);
    });

    it('applies additional className', () => {
        render(<InfoTooltip className="custom-class">Content</InfoTooltip>);
        expect(screen.getByRole('button').className).toContain('custom-class');
    });

    it('shows tooltip on pointer enter (mouse) and hides on pointer leave', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        const trigger = screen.getByRole('button', { name: '추가 정보' });

        fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('touch pointer enter/leave does not open the tooltip (touch already opens via tap/click)', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        const trigger = screen.getByRole('button', { name: '추가 정보' });

        fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('Escape closes an open tooltip', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        fireEvent.click(screen.getByRole('button', { name: '추가 정보' }));
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does not close on Escape while composing (IME cancel key)', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        fireEvent.click(screen.getByRole('button', { name: '추가 정보' }));
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape', isComposing: true });
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('clicking outside the trigger and tooltip closes it', () => {
        render(
            <div>
                <InfoTooltip>Tooltip content</InfoTooltip>
                <button type="button">outside</button>
            </div>
        );
        fireEvent.click(screen.getByRole('button', { name: '추가 정보' }));
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('clicking inside the open tooltip does not close it', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        fireEvent.click(screen.getByRole('button', { name: '추가 정보' }));
        const tooltip = screen.getByRole('tooltip');

        fireEvent.pointerDown(tooltip);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('positions the tooltip via CSS vars computed from the trigger rect and marks it visible once positioned', () => {
        render(<InfoTooltip>Tooltip content</InfoTooltip>);
        fireEvent.click(screen.getByRole('button', { name: '추가 정보' }));

        const tooltip = screen.getByRole('tooltip');
        expect(tooltip.style.getPropertyValue('--tt')).toBe('100px');
        expect(tooltip.style.getPropertyValue('--tl')).toBe('200px');
        expect(tooltip.classList.contains('visible')).toBe(true);
        expect(tooltip.classList.contains('invisible')).toBe(false);
    });
});
