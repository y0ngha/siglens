import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpirationChip } from '@/widgets/options/ui/expiration/ExpirationChip';

const TAB = {
    key: '1W',
    label: '1 week',
    value: '2025-06-20',
    sub: '06-20',
};

function setup(active: boolean, tab: { sub?: string } = {}) {
    const onSelect = vi.fn();
    const onKeyDown = vi.fn();
    render(
        <ExpirationChip
            tab={{ ...TAB, ...tab }}
            active={active}
            buttonRef={() => {}}
            onSelect={onSelect}
            onKeyDown={onKeyDown}
        />
    );
    return { onSelect, onKeyDown, chip: screen.getByRole('tab') };
}

describe('ExpirationChip', () => {
    describe('when active', () => {
        it('is selected, tabbable and emphasized beyond color', () => {
            const { chip } = setup(true);
            expect(chip).toHaveAttribute('aria-selected', 'true');
            expect(chip).toHaveAttribute('tabindex', '0');
            expect(chip.className).toContain('font-semibold');
        });
    });

    describe('when inactive', () => {
        it('is unselected and removed from the tab order', () => {
            const { chip } = setup(false);
            expect(chip).toHaveAttribute('aria-selected', 'false');
            expect(chip).toHaveAttribute('tabindex', '-1');
            expect(chip.className).toContain('border-border-control');
        });
    });

    it('shows the label and the sub label', () => {
        setup(false);
        expect(screen.getByText('1 week')).toBeInTheDocument();
        expect(screen.getByText('06-20')).toBeInTheDocument();
    });

    it('omits the sub label when absent', () => {
        const { chip } = setup(false, { sub: undefined });
        expect(chip.querySelectorAll('span')).toHaveLength(1);
    });

    it('calls onSelect on click and onKeyDown on key press', async () => {
        const user = userEvent.setup();
        const { chip, onSelect, onKeyDown } = setup(true);
        await user.click(chip);
        expect(onSelect).toHaveBeenCalledTimes(1);
        await user.keyboard('{ArrowRight}');
        expect(onKeyDown).toHaveBeenCalled();
    });
});
