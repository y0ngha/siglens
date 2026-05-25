import { render, screen } from '@testing-library/react';
import { SignalSubsection } from '@/widgets/dashboard/SignalSubsection';
import type { StockWithConflict } from '@y0ngha/siglens-core';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));

vi.mock('@/widgets/dashboard/SignalStockCard', () => ({
    SignalStockCard: ({ data }: { data: { symbol: string } }) => (
        <div data-testid={`stock-${data.symbol}`}>{data.symbol}</div>
    ),
}));

const STOCK: StockWithConflict = {
    symbol: 'AAPL',
    koreanName: '애플',
    sectorSymbol: 'XLK',
    price: 180,
    changePercent: 1,
    trend: 'uptrend',
    signals: [],
};

describe('SignalSubsection', () => {
    it('renders title and marker', () => {
        render(
            <SignalSubsection
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                stocks={[STOCK]}
            />
        );
        expect(screen.getByText('상승 신호')).toBeInTheDocument();
        expect(screen.getByText('▲')).toBeInTheDocument();
    });

    it('renders zero-padded stock count', () => {
        render(
            <SignalSubsection
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                stocks={[STOCK]}
            />
        );
        expect(screen.getByText('01')).toBeInTheDocument();
    });

    it('renders empty message when no stocks', () => {
        render(
            <SignalSubsection
                title="하락 신호"
                marker="▼"
                variant="confirmed"
                stocks={[]}
            />
        );
        expect(
            screen.getByText(/이 신호가 잡힌 종목이 없어요/)
        ).toBeInTheDocument();
    });

    it('renders stock cards when stocks are present', () => {
        render(
            <SignalSubsection
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                stocks={[STOCK]}
            />
        );
        expect(screen.getByTestId('stock-AAPL')).toBeInTheDocument();
    });

    it('renders info tooltip when infoMessage is provided', () => {
        render(
            <SignalSubsection
                title="혼재"
                marker="◈"
                variant="mixed"
                stocks={[]}
                infoMessage={<p>Test info</p>}
            />
        );
        expect(screen.getByTestId('info-tooltip')).toBeInTheDocument();
        expect(screen.getByText('Test info')).toBeInTheDocument();
    });

    it('does not render info tooltip when infoMessage is undefined', () => {
        render(
            <SignalSubsection
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                stocks={[]}
            />
        );
        expect(screen.queryByTestId('info-tooltip')).not.toBeInTheDocument();
    });
});
