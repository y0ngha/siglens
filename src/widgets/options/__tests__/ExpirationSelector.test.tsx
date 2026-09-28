import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpirationSelector } from '@/widgets/options/ExpirationSelector';
import type { SlotMapping } from '@y0ngha/siglens-core';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const SLOTS: SlotMapping[] = [
    {
        slot: { key: '1W', label: '근월', targetDays: 7 },
        expirationDate: '2025-06-20',
    },
    {
        slot: { key: '1M', label: '차월', targetDays: 30 },
        expirationDate: '2025-07-18',
    },
];

describe('ExpirationSelector', () => {
    it('renders tabs for each slot plus the aggregate tab', () => {
        render(
            <ExpirationSelector
                slots={SLOTS}
                value="2025-06-20"
                onChange={vi.fn()}
            />
        );
        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(3);
    });

    it('marks the active tab as selected', () => {
        render(
            <ExpirationSelector
                slots={SLOTS}
                value="2025-06-20"
                onChange={vi.fn()}
            />
        );
        const tabs = screen.getAllByRole('tab');
        expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
        expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
        expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onChange with the correct value when a tab is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <ExpirationSelector
                slots={SLOTS}
                value="2025-06-20"
                onChange={onChange}
            />
        );
        await user.click(screen.getByText('종합'));
        expect(onChange).toHaveBeenCalledWith('all');
    });

    it('renders date substring for slot tabs', () => {
        render(
            <ExpirationSelector
                slots={SLOTS}
                value="2025-06-20"
                onChange={vi.fn()}
            />
        );
        expect(screen.getByText('06-20')).toBeInTheDocument();
        expect(screen.getByText('07-18')).toBeInTheDocument();
    });

    it('provides tablist with aria-label', () => {
        render(
            <ExpirationSelector
                slots={SLOTS}
                value="2025-06-20"
                onChange={vi.fn()}
            />
        );
        expect(screen.getByRole('tablist')).toHaveAttribute(
            'aria-label',
            '옵션 만기 선택'
        );
    });

    it('sets roving tabIndex (active=0, inactive=-1)', () => {
        render(
            <ExpirationSelector
                slots={SLOTS}
                value="2025-07-18"
                onChange={vi.fn()}
            />
        );
        const tabs = screen.getAllByRole('tab');
        expect(tabs[0]).toHaveAttribute('tabindex', '-1');
        expect(tabs[1]).toHaveAttribute('tabindex', '0');
    });

    describe('keyboard navigation (WAI-ARIA tabs pattern)', () => {
        it('ArrowRight moves selection to the next tab and moves focus with it', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            render(
                <ExpirationSelector
                    slots={SLOTS}
                    value="2025-06-20"
                    onChange={onChange}
                />
            );
            const tabs = screen.getAllByRole('tab');
            tabs[0]!.focus();
            await user.keyboard('{ArrowRight}');
            expect(onChange).toHaveBeenCalledWith('2025-07-18');
            expect(tabs[1]).toHaveFocus();
        });

        it('ArrowRight wraps from the last tab back to the first', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            render(
                <ExpirationSelector
                    slots={SLOTS}
                    value="all"
                    onChange={onChange}
                />
            );
            const tabs = screen.getAllByRole('tab');
            tabs[2]!.focus();
            await user.keyboard('{ArrowRight}');
            expect(onChange).toHaveBeenCalledWith('2025-06-20');
            expect(tabs[0]).toHaveFocus();
        });

        it('ArrowLeft moves selection to the previous tab and wraps from the first tab to the last', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            render(
                <ExpirationSelector
                    slots={SLOTS}
                    value="2025-06-20"
                    onChange={onChange}
                />
            );
            const tabs = screen.getAllByRole('tab');
            tabs[0]!.focus();
            await user.keyboard('{ArrowLeft}');
            expect(onChange).toHaveBeenCalledWith('all');
            expect(tabs[2]).toHaveFocus();
        });

        it('Home moves selection and focus to the first tab', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            render(
                <ExpirationSelector
                    slots={SLOTS}
                    value="all"
                    onChange={onChange}
                />
            );
            const tabs = screen.getAllByRole('tab');
            tabs[2]!.focus();
            await user.keyboard('{Home}');
            expect(onChange).toHaveBeenCalledWith('2025-06-20');
            expect(tabs[0]).toHaveFocus();
        });

        it('End moves selection and focus to the last (aggregate) tab', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            render(
                <ExpirationSelector
                    slots={SLOTS}
                    value="2025-06-20"
                    onChange={onChange}
                />
            );
            const tabs = screen.getAllByRole('tab');
            tabs[0]!.focus();
            await user.keyboard('{End}');
            expect(onChange).toHaveBeenCalledWith('all');
            expect(tabs[2]).toHaveFocus();
        });

        it('ignores unrelated keys (does not call onChange)', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            render(
                <ExpirationSelector
                    slots={SLOTS}
                    value="2025-06-20"
                    onChange={onChange}
                />
            );
            const tabs = screen.getAllByRole('tab');
            tabs[0]!.focus();
            await user.keyboard('{Escape}');
            expect(onChange).not.toHaveBeenCalled();
        });
    });
});
