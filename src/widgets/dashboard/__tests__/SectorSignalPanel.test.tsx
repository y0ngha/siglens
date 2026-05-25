import { render, screen } from '@testing-library/react';
import { SectorSignalPanel } from '@/widgets/dashboard/SectorSignalPanel';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';

const mockReturn = {
    activeSector: 'XLK',
    activeTimeframe: '1Day' as const,
    quadrants: {
        bullishConfirmed: [],
        bullishExpected: [],
        bearishExpected: [],
        bearishConfirmed: [],
    },
    mixedStocks: [],
    handleSectorChange: vi.fn(),
    handleTimeframeChange: vi.fn(),
};

vi.mock('@/widgets/dashboard/hooks/useSectorSignalState', () => ({
    useSectorSignalState: () => mockReturn,
}));

vi.mock('@/widgets/dashboard/SectorTabs', () => ({
    SectorTabs: () => <div data-testid="sector-tabs" />,
}));

vi.mock('@/widgets/dashboard/TimeframeSelector', () => ({
    TimeframeSelector: () => <div data-testid="timeframe-selector" />,
}));

vi.mock('@/widgets/dashboard/SignalSubsection', () => ({
    SignalSubsection: ({ title }: { title: string }) => (
        <div data-testid={`subsection-${title}`}>{title}</div>
    ),
}));

const DATA: SectorSignalsResult = {
    stocks: [],
    computedAt: '2025-01-01T00:00:00Z',
};

describe('SectorSignalPanel', () => {
    it('renders the section heading', () => {
        render(
            <SectorSignalPanel
                data={DATA}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );
        expect(screen.getByText('섹터별 신호 모아보기')).toBeInTheDocument();
    });

    it('renders SectorTabs and TimeframeSelector', () => {
        render(
            <SectorSignalPanel
                data={DATA}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );
        expect(screen.getByTestId('sector-tabs')).toBeInTheDocument();
        expect(screen.getByTestId('timeframe-selector')).toBeInTheDocument();
    });

    it('renders all five signal subsections', () => {
        render(
            <SectorSignalPanel
                data={DATA}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );
        expect(screen.getByText('상승 신호')).toBeInTheDocument();
        expect(screen.getByText('상승 조짐')).toBeInTheDocument();
        expect(screen.getByText('혼재')).toBeInTheDocument();
        expect(screen.getByText('하락 조짐')).toBeInTheDocument();
        expect(screen.getByText('하락 신호')).toBeInTheDocument();
    });

    it('renders tabpanel with correct aria attributes', () => {
        render(
            <SectorSignalPanel
                data={DATA}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );
        const panel = screen.getByRole('tabpanel');
        expect(panel).toHaveAttribute('aria-labelledby', 'sector-tab-XLK');
    });
});
