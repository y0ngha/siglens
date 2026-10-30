import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabsPill } from '@/shared/ui/tabs/TabsPill';

const tabs = [
    { value: 'a', label: 'Tab A' },
    { value: 'b', label: 'Tab B' },
    { value: 'c', label: 'Tab C' },
] as const;

describe('TabsPill', () => {
    it('renders a tablist with all tabs', () => {
        render(
            <TabsPill
                tabs={tabs}
                activeTab="a"
                onChange={vi.fn()}
                ariaLabel="Test tabs"
            />
        );
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('sets aria-label on the tablist', () => {
        render(
            <TabsPill
                tabs={tabs}
                activeTab="a"
                onChange={vi.fn()}
                ariaLabel="Test tabs"
            />
        );
        expect(screen.getByRole('tablist')).toHaveAttribute(
            'aria-label',
            'Test tabs'
        );
    });

    it('marks the active tab as selected', () => {
        render(
            <TabsPill
                tabs={tabs}
                activeTab="b"
                onChange={vi.fn()}
                ariaLabel="Test tabs"
            />
        );
        expect(screen.getByText('Tab B')).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByText('Tab A')).toHaveAttribute(
            'aria-selected',
            'false'
        );
    });

    it('sets tabIndex=0 on active tab and tabIndex=-1 on others', () => {
        render(
            <TabsPill
                tabs={tabs}
                activeTab="a"
                onChange={vi.fn()}
                ariaLabel="Test tabs"
            />
        );
        expect(screen.getByText('Tab A')).toHaveAttribute('tabindex', '0');
        expect(screen.getByText('Tab B')).toHaveAttribute('tabindex', '-1');
    });

    it('calls onChange when clicking a tab', async () => {
        const handleChange = vi.fn();
        const user = userEvent.setup();
        render(
            <TabsPill
                tabs={tabs}
                activeTab="a"
                onChange={handleChange}
                ariaLabel="Test tabs"
            />
        );
        await user.click(screen.getByText('Tab B'));
        expect(handleChange).toHaveBeenCalledWith('b');
    });

    it('applies additional className', () => {
        render(
            <TabsPill
                tabs={tabs}
                activeTab="a"
                onChange={vi.fn()}
                ariaLabel="Test tabs"
                className="mt-4"
            />
        );
        expect(screen.getByRole('tablist').className).toContain('mt-4');
    });

    describe('panelMounting', () => {
        it("기본값 'all'이면 모든 탭이 자기 패널을 aria-controls로 가리킨다", () => {
            render(
                <TabsPill
                    tabs={tabs}
                    activeTab="a"
                    onChange={vi.fn()}
                    ariaLabel="Test tabs"
                    idPrefix="pill"
                />
            );
            expect(screen.getByText('Tab A')).toHaveAttribute(
                'aria-controls',
                'pill-panel-a'
            );
            expect(screen.getByText('Tab B')).toHaveAttribute(
                'aria-controls',
                'pill-panel-b'
            );
        });

        it("'active'면 비활성 탭은 존재하지 않는 패널을 가리키지 않는다", () => {
            render(
                <TabsPill
                    tabs={tabs}
                    activeTab="a"
                    onChange={vi.fn()}
                    ariaLabel="Test tabs"
                    idPrefix="pill"
                    panelMounting="active"
                />
            );
            expect(screen.getByText('Tab A')).toHaveAttribute(
                'aria-controls',
                'pill-panel-a'
            );
            expect(screen.getByText('Tab B')).not.toHaveAttribute(
                'aria-controls'
            );
        });
    });
});
