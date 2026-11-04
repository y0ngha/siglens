import { render, screen, within } from '@testing-library/react';
import type { BacktestStats } from '@/entities/backtest-case/model';

import { BacktestComparison } from '../../BacktestComparison';

const ticker = (name: string, strategyPct: number) => ({
    ticker: name,
    trades: 65,
    winRate: 60,
    strategyPct,
    strategyMaxDrawdownPct: -14.44,
    exposurePct: 66.87,
});

const STATS: BacktestStats = {
    totalTrades: 130,
    closedTrades: 130,
    winningTrades: 78,
    winRate: 60,
    meanReturnPct: 0.5,
    medianReturnPct: 0.4,
    meanHoldingDays: 5,
    portfolioReturnPct: 29.09,
    portfolioMaxDrawdownPct: -9.29,
    meanExposurePct: 62.5,
    perTicker: [ticker('MSFT', 47.08), ticker('SPY', 4.95)],
    exitPaths: [],
    trendRecognition: {
        windowDays: 10,
        directionalCalls: 0,
        matchRatePct: 0,
        byTrend: {
            bullish: { calls: 0, priorMeanPct: 0, priorUpRatePct: 0 },
            bearish: { calls: 0, priorMeanPct: 0, priorUpRatePct: 0 },
            neutral: { calls: 0, priorMeanPct: 0, priorUpRatePct: 0 },
        },
    },
    periodStart: '2024-11-01',
    periodEnd: '2026-11-02',
};

describe('BacktestComparison', () => {
    it('renders a headed table with the portfolio row first', () => {
        render(<BacktestComparison stats={STATS} />);
        expect(
            screen.getByRole('heading', { level: 2, name: '종목별 결과' })
        ).toBeInTheDocument();
        const rows = screen.getAllByRole('row');
        expect(rows).toHaveLength(4); // header + portfolio + 2 tickers
        expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent(
            '2종목 포트폴리오'
        );
        expect(rows[1]).toHaveTextContent('+29.1%');
        expect(rows[1]).toHaveTextContent('-9.3%');
    });

    it('renders one row per ticker including SPY', () => {
        render(<BacktestComparison stats={STATS} />);
        const msft = screen
            .getByRole('rowheader', { name: 'MSFT' })
            .closest('tr');
        expect(msft).toHaveTextContent('+47.1%');
        expect(
            screen.getByRole('rowheader', { name: 'SPY' })
        ).toBeInTheDocument();
    });

    it('keeps the table scrollable by keyboard', () => {
        render(<BacktestComparison stats={STATS} />);
        expect(
            screen.getByRole('region', { name: '종목별 결과 표' })
        ).toHaveAttribute('tabindex', '0');
    });

    it('labels every column', () => {
        render(<BacktestComparison stats={STATS} />);
        expect(
            screen.getAllByRole('columnheader').map(h => h.textContent)
        ).toEqual([
            '종목',
            '매매',
            '승률',
            'AI 전략',
            '최대 낙폭',
            '투자 비중',
        ]);
    });
});
