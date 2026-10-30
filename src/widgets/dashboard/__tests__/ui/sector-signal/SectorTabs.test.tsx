import { render, screen } from '@testing-library/react';
import { SectorTabs } from '@/widgets/dashboard/ui/sector-signal/SectorTabs';
import { TEST_SCOPE } from '../../helpers/testScope';

vi.mock('@/shared/ui/tabs/TabsUnderline', () => ({
    TabsUnderline: ({
        tabs,
        activeTab,
        ariaLabel,
        panelMounting,
    }: {
        tabs: Array<{ value: string; label: string }>;
        activeTab: string;
        ariaLabel: string;
        panelMounting?: string;
    }) => (
        <div
            role="tablist"
            aria-label={ariaLabel}
            data-panel-mounting={panelMounting}
        >
            {tabs.map(t => (
                <button
                    key={t.value}
                    role="tab"
                    aria-selected={t.value === activeTab}
                >
                    {t.label}
                </button>
            ))}
        </div>
    ),
}));

describe('SectorTabs', () => {
    it('renders tabs for each sector with correct labels', () => {
        render(
            <SectorTabs
                sectors={TEST_SCOPE.signalSectors}
                activeSector="XLK"
                onChange={vi.fn()}
            />
        );
        expect(screen.getByText('기술')).toBeInTheDocument();
        expect(screen.getByText('금융')).toBeInTheDocument();
    });

    it('marks the active sector tab as selected', () => {
        render(
            <SectorTabs
                sectors={TEST_SCOPE.signalSectors}
                activeSector="XLK"
                onChange={vi.fn()}
            />
        );
        const tabs = screen.getAllByRole('tab');
        expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
        expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('provides a descriptive aria-label on the tablist', () => {
        render(
            <SectorTabs
                sectors={TEST_SCOPE.signalSectors}
                activeSector="XLK"
                onChange={vi.fn()}
            />
        );
        expect(screen.getByRole('tablist')).toHaveAttribute(
            'aria-label',
            '섹터 선택'
        );
    });

    it('panels render only for the active sector, so it requests active-only panel mounting', () => {
        render(
            <SectorTabs
                sectors={TEST_SCOPE.signalSectors}
                activeSector="XLK"
                onChange={vi.fn()}
            />
        );
        expect(screen.getByRole('tablist')).toHaveAttribute(
            'data-panel-mounting',
            'active'
        );
    });
});
