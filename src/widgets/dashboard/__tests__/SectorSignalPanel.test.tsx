import { render, screen } from '@testing-library/react';
import { SectorSignalPanel } from '@/widgets/dashboard/SectorSignalPanel';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';

// spy로 두어 initialData/initialSector/initialTimeframe가 훅으로 전달되는지(panel 배선) 검증.
const { mockUseSectorSignalState } = vi.hoisted(() => ({
    mockUseSectorSignalState: vi.fn(),
}));

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
    useSectorSignalState: mockUseSectorSignalState,
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

describe('SectorSignalPanel', () => {
    beforeEach(() => {
        mockUseSectorSignalState.mockReset();
        mockUseSectorSignalState.mockReturnValue(mockReturn);
    });

    it('renders the section heading', () => {
        render(
            <SectorSignalPanel initialSector="XLK" initialTimeframe="1Day" />
        );
        expect(screen.getByText('섹터별 신호 모아보기')).toBeInTheDocument();
    });

    it('renders SectorTabs and TimeframeSelector', () => {
        render(
            <SectorSignalPanel initialSector="XLK" initialTimeframe="1Day" />
        );
        expect(screen.getByTestId('sector-tabs')).toBeInTheDocument();
        expect(screen.getByTestId('timeframe-selector')).toBeInTheDocument();
    });

    it('renders all five signal subsections', () => {
        render(
            <SectorSignalPanel initialSector="XLK" initialTimeframe="1Day" />
        );
        expect(screen.getByText('상승 신호')).toBeInTheDocument();
        expect(screen.getByText('상승 조짐')).toBeInTheDocument();
        expect(screen.getByText('혼재')).toBeInTheDocument();
        expect(screen.getByText('하락 조짐')).toBeInTheDocument();
        expect(screen.getByText('하락 신호')).toBeInTheDocument();
    });

    it('renders tabpanel with correct aria attributes', () => {
        render(
            <SectorSignalPanel initialSector="XLK" initialTimeframe="1Day" />
        );
        const panel = screen.getByRole('tabpanel');
        expect(panel).toHaveAttribute('aria-labelledby', 'sector-tab-XLK');
    });

    it('initialData/initialSector/initialTimeframe를 useSectorSignalState로 전달한다', () => {
        const initialData: SectorSignalsResult = {
            computedAt: '2026-06-04T00:00:00Z',
            stocks: [],
        };
        render(
            <SectorSignalPanel
                initialSector="XLF"
                initialTimeframe="1Hour"
                initialData={initialData}
            />
        );
        expect(mockUseSectorSignalState).toHaveBeenCalledWith({
            initialSector: 'XLF',
            initialTimeframe: '1Hour',
            initialData,
        });
    });
});
