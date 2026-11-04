import { render, screen } from '@testing-library/react';
import type { BacktestStats } from '@/entities/backtest-case/model';

import { BacktestHero } from '../../BacktestHero';

const STATS: BacktestStats = {
    totalTrades: 690,
    closedTrades: 690,
    winningTrades: 396,
    winRate: 57.39,
    meanReturnPct: 0.39,
    medianReturnPct: 0.43,
    meanHoldingDays: 4.54,
    portfolioReturnPct: 29.09,
    portfolioMaxDrawdownPct: -9.29,
    meanExposurePct: 62.5,
    buyHoldMeanPct: 27.65,
    spy: { buyHoldPct: 31.71, buyHoldMaxDrawdownPct: -19 },
    perTicker: Array.from({ length: 10 }, (_, i) => ({
        ticker: `T${i}`,
        trades: 69,
        winRate: 57,
        strategyPct: 10,
        strategyMaxDrawdownPct: -10,
        exposurePct: 60,
        buyHoldPct: 20,
        buyHoldMaxDrawdownPct: -30,
    })),
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

describe('BacktestHero', () => {
    it('renders the run period as months', () => {
        render(<BacktestHero stats={STATS} />);
        expect(screen.getByText(/2024.11 – 2026.11/)).toBeInTheDocument();
    });

    it('renders the heading and the ticker count in the lead', () => {
        render(<BacktestHero stats={STATS} />);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'AI 분석을 2년 동안 그대로 따랐다면',
            })
        ).toBeInTheDocument();
        expect(screen.getByText(/지수 ETF 10종목이에요/)).toBeInTheDocument();
    });

    it('shows portfolio return and drawdown next to the SPY baseline', () => {
        render(<BacktestHero stats={STATS} />);
        expect(screen.getByText('+29.1%')).toBeInTheDocument();
        expect(
            screen.getByText('10종목 보유 +27.6% · SPY +31.7%')
        ).toBeInTheDocument();
        expect(screen.getByText('-9.3%')).toBeInTheDocument();
        expect(
            screen.getByText('SPY 보유 -19.0% (일별 종가 기준)')
        ).toBeInTheDocument();
        expect(screen.getByText('최대 낙폭 (청산 기준)')).toBeInTheDocument();
    });

    it('shows win rate with its exact counts', () => {
        render(<BacktestHero stats={STATS} />);
        expect(screen.getByText('57.4%')).toBeInTheDocument();
        expect(screen.getByText('396/690건')).toBeInTheDocument();
    });

    it('shows trade count, mean return and mean holding period', () => {
        render(<BacktestHero stats={STATS} />);
        expect(screen.getByText('690건')).toBeInTheDocument();
        expect(screen.getByText('+0.39%')).toBeInTheDocument();
        expect(screen.getByText('4.5거래일')).toBeInTheDocument();
    });

    it('does not render the removed indicator-signal win rate', () => {
        render(<BacktestHero stats={STATS} />);
        expect(screen.queryByText(/지표 신호/)).not.toBeInTheDocument();
    });
});
