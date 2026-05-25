import { render, screen } from '@testing-library/react';
import { SectorTabs } from '@/widgets/dashboard/SectorTabs';

vi.mock('@/shared/config/dashboard-tickers', () => ({
    SIGNAL_SECTORS: [
        { symbol: 'XLK', koreanName: '기술' },
        { symbol: 'XLF', koreanName: '금융' },
    ],
}));

vi.mock('@/shared/ui/tabs', () => ({
    TabsUnderline: ({
        tabs,
        activeTab,
        ariaLabel,
    }: {
        tabs: Array<{ value: string; label: string }>;
        activeTab: string;
        ariaLabel: string;
    }) => (
        <div role="tablist" aria-label={ariaLabel}>
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
        render(<SectorTabs activeSector="XLK" onChange={vi.fn()} />);
        expect(screen.getByText('기술')).toBeInTheDocument();
        expect(screen.getByText('금융')).toBeInTheDocument();
    });

    it('marks the active sector tab as selected', () => {
        render(<SectorTabs activeSector="XLK" onChange={vi.fn()} />);
        const tabs = screen.getAllByRole('tab');
        expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
        expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('provides a descriptive aria-label on the tablist', () => {
        render(<SectorTabs activeSector="XLK" onChange={vi.fn()} />);
        expect(screen.getByRole('tablist')).toHaveAttribute(
            'aria-label',
            '섹터 선택'
        );
    });
});
