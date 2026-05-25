import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabsUnderline } from '@/shared/ui/tabs/TabsUnderline';

const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'chart', label: 'Chart' },
    { value: 'news', label: 'News' },
] as const;

describe('TabsUnderline', () => {
    it('renders a tablist with all tabs', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="xs"
            />
        );
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('sets aria-label on the tablist', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="xs"
            />
        );
        expect(screen.getByRole('tablist')).toHaveAttribute(
            'aria-label',
            'Navigation'
        );
    });

    it('marks the active tab as selected', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="chart"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="sm"
            />
        );
        expect(screen.getByText('Chart')).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByText('Overview')).toHaveAttribute(
            'aria-selected',
            'false'
        );
    });

    it('calls onChange when clicking a tab', async () => {
        const handleChange = vi.fn();
        const user = userEvent.setup();
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={handleChange}
                ariaLabel="Navigation"
                size="xs"
            />
        );
        await user.click(screen.getByText('News'));
        expect(handleChange).toHaveBeenCalledWith('news');
    });

    it('renders with xs size', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="xs"
            />
        );
        // xs size wraps buttons in an inner div
        const tablist = screen.getByRole('tablist');
        expect(tablist.querySelector('div')).toBeInTheDocument();
    });

    it('renders with sm size (no inner wrapper)', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="sm"
            />
        );
        // sm size renders buttons directly in the tablist
        const tablist = screen.getByRole('tablist');
        const buttons = tablist.querySelectorAll('button');
        expect(buttons).toHaveLength(3);
    });
});
