import { render, screen } from '@testing-library/react';
import { OptionsMetricsRow } from '@/widgets/options/OptionsMetricsRow';
import type { OptionsExpirationMetrics } from '@y0ngha/siglens-core';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

vi.mock('@/widgets/options/utils/optionsTooltips', () => ({
    MaxPainTooltip: 'Max Pain info',
    PutCallRatioTooltip: 'P/C info',
    AtmIvTooltip: () => 'ATM IV info',
    ImpliedMoveTooltip: () => 'Imp Move info',
}));

vi.mock('@/entities/options-chain', () => ({
    formatMaxPain: (v: number | null) =>
        v === null ? '—' : `$${v.toFixed(0)}`,
    formatPutCallRatio: (v: number | null) => (v === null ? '—' : v.toFixed(2)),
    formatAtmIv: (v: number | null) =>
        v === null ? '—' : `${(v * 100).toFixed(1)}%`,
    formatImpliedMove: (v: number | null) =>
        v === null ? '—' : `±${v.toFixed(1)}%`,
    METRIC_PLACEHOLDER: '—',
}));

const METRICS: OptionsExpirationMetrics = {
    expirationDate: '2025-06-20',
    maxPain: 150,
    putCallRatio: 0.8,
    atmImpliedVolatility: 0.35,
    impliedMovePercent: 4.2,
    topOpenInterestStrikes: [],
    topVolumeStrikes: [],
    topOiBidAskSummary: [],
};
describe('OptionsMetricsRow', () => {
    it('renders all four metric cards', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={false}
            />
        );
        expect(screen.getByText('Max Pain')).toBeInTheDocument();
        expect(screen.getByText('P/C Ratio')).toBeInTheDocument();
        expect(screen.getByText('ATM IV')).toBeInTheDocument();
        expect(screen.getByText('Imp. Move')).toBeInTheDocument();
    });

    it('renders formatted metric values', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={false}
            />
        );
        expect(screen.getByText('$150')).toBeInTheDocument();
        expect(screen.getByText('0.80')).toBeInTheDocument();
        expect(screen.getByText('35.0%')).toBeInTheDocument();
        expect(screen.getByText('±4.2%')).toBeInTheDocument();
    });

    it('renders placeholders when oiStale is true', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={true}
            />
        );
        const dashes = screen.getAllByText('—');
        expect(dashes).toHaveLength(4);
    });

    it('renders aggregate note when expirationDate is all', () => {
        render(
            <OptionsMetricsRow
                expirationDate="all"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={false}
            />
        );
        expect(screen.getByText(/전체 만기 합산/)).toBeInTheDocument();
    });

    it('does not render aggregate note for specific expiration', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={false}
            />
        );
        expect(screen.queryByText(/전체 만기 합산/)).not.toBeInTheDocument();
    });
});
