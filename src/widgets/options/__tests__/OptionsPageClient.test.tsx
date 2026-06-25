import { render, screen } from '@testing-library/react';
import { OptionsPageClient } from '@/widgets/options/OptionsPageClient';
import type { OptionsSnapshot, SlotMapping } from '@y0ngha/siglens-core';

vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}));

vi.mock('@/features/symbol-model', () => ({
    useSymbolModel: () => ({ modelId: 'gemini-2.5-flash-lite' }),
}));

vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => <div data-testid="cross-links" />,
}));

vi.mock('@/widgets/options/ExpirationSelector', () => ({
    ExpirationSelector: () => <div data-testid="exp-selector" />,
}));

vi.mock('@/widgets/options/OptionsAiAnalysis', () => ({
    OptionsAiAnalysis: () => <div data-testid="ai-analysis" />,
}));

vi.mock('@/widgets/options/OptionsAiAnalysisError', () => ({
    OptionsAiAnalysisError: () => <div>Error</div>,
}));

vi.mock('@/widgets/options/OptionsAiAnalysisStaleNotice', () => ({
    OptionsAiAnalysisStaleNotice: () => <div data-testid="stale-notice" />,
}));

vi.mock('@/widgets/options/OptionsChainTable', () => ({
    OptionsChainTable: () => <div data-testid="chain-table" />,
}));

vi.mock('@/widgets/options/OpenInterestChart', () => ({
    OpenInterestChart: () => <div data-testid="oi-chart" />,
}));

vi.mock('@/widgets/options/StrikeVolumeChart', () => ({
    StrikeVolumeChart: () => <div data-testid="volume-chart" />,
}));

vi.mock('@/widgets/options/OptionsMetricsRow', () => ({
    OptionsMetricsRow: () => <div data-testid="metrics-row" />,
}));

vi.mock('@/widgets/options/OptionsStaleDataBanner', () => ({
    OptionsStaleDataBanner: () => <div data-testid="stale-banner" />,
}));

vi.mock('@/widgets/options/hooks/useOptionsChainMetrics', () => ({
    useOptionsChainMetrics: () => ({ chain: null, metrics: null }),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    isEtRegularSessionOpen: () => true,
}));

vi.mock('@/shared/lib/options/openInterestStale', () => ({
    isOpenInterestSnapshotStale: () => false,
}));

const SNAPSHOT: OptionsSnapshot = {
    symbol: 'AAPL',
    underlyingPrice: 150,
    capturedAt: '2025-01-15T10:00:00Z',
    chains: [
        {
            expirationDate: '2025-06-20',
            daysToExpiration: 30,
            calls: [],
            puts: [],
        },
    ],
};

const SLOTS: Array<SlotMapping | null> = [
    {
        slot: { key: '1W', label: '근월', targetDays: 7 },
        expirationDate: '2025-06-20',
    },
    null,
];

describe('OptionsPageClient', () => {
    it('renders ExpirationSelector', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('exp-selector')).toBeInTheDocument();
    });

    it('renders AI analysis section', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('ai-analysis')).toBeInTheDocument();
    });

    it('renders metrics row', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('metrics-row')).toBeInTheDocument();
    });

    it('renders charts', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('oi-chart')).toBeInTheDocument();
        expect(screen.getByTestId('volume-chart')).toBeInTheDocument();
    });

    it('renders chain table and cross links', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('chain-table')).toBeInTheDocument();
        expect(screen.getByTestId('cross-links')).toBeInTheDocument();
    });
});
