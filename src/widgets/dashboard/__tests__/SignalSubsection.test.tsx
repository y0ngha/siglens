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

/*
 * 목이 `tickerIsReadable`을 DOM으로 흘려보낸다. 삼키면 SignalSubsection이 그 값을
 * 카드에 넘기지 않아도(=한국 신호 카드 제목이 다시 KRX 숫자가 되는 회귀)
 * 아무 테스트가 안 깨진다.
 */
vi.mock('@/widgets/dashboard/SignalStockCard', () => ({
    SignalStockCard: ({
        data,
        tickerIsReadable,
    }: {
        data: { symbol: string };
        tickerIsReadable: boolean;
    }) => (
        <div
            data-testid={`stock-${data.symbol}`}
            data-ticker-readable={String(tickerIsReadable)}
        >
            {data.symbol}
        </div>
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
                tickerIsReadable
                currencySymbol="$"
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                stocks={[STOCK]}
            />
        );
        expect(screen.getByText('상승 신호')).toBeInTheDocument();
        expect(screen.getByText('▲')).toBeInTheDocument();
    });

    /** 이 prop이 카드까지 닿지 않으면 한국 신호 카드 제목이 KRX 숫자로 남는다. */
    it('tickerIsReadable을 카드에 그대로 넘긴다', () => {
        render(
            <SignalSubsection
                tickerIsReadable={false}
                currencySymbol="₩"
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                stocks={[STOCK]}
            />
        );

        expect(screen.getByTestId('stock-AAPL')).toHaveAttribute(
            'data-ticker-readable',
            'false'
        );
    });

    it('renders zero-padded stock count', () => {
        render(
            <SignalSubsection
                tickerIsReadable
                currencySymbol="$"
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
                tickerIsReadable
                currencySymbol="$"
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
                tickerIsReadable
                currencySymbol="$"
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
                tickerIsReadable
                currencySymbol="$"
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
                tickerIsReadable
                currencySymbol="$"
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                stocks={[]}
            />
        );
        expect(screen.queryByTestId('info-tooltip')).not.toBeInTheDocument();
    });
});
