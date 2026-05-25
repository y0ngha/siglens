import { render, screen, fireEvent } from '@testing-library/react';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

vi.mock('@/shared/hooks/useEscapeKey', () => ({
    useEscapeKey: vi.fn(),
}));

vi.mock('@/shared/hooks/useOnClickOutside', () => ({
    useOnClickOutside: vi.fn(),
}));

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
});
