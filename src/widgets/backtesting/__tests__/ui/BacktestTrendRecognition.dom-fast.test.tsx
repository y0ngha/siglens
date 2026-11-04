import { render, screen } from '@testing-library/react';
import type { BacktestStats } from '@/entities/backtest-case/model';

import { BacktestTrendRecognition } from '../../BacktestTrendRecognition';

const STATS = {
    trendRecognition: {
        windowDays: 10,
        directionalCalls: 2284,
        matchRatePct: 89.19,
        byTrend: {
            bullish: { calls: 1562, priorMeanPct: 5.47, priorUpRatePct: 90.72 },
            bearish: { calls: 722, priorMeanPct: -5.28, priorUpRatePct: 14.13 },
            neutral: { calls: 1377, priorMeanPct: 0.57, priorUpRatePct: 50.11 },
        },
    },
} as unknown as BacktestStats;

describe('BacktestTrendRecognition', () => {
    it('states that it measures the move so far, not a forecast', () => {
        render(<BacktestTrendRecognition stats={STATS} />);
        expect(
            screen.getByRole('heading', { level: 2, name: '추세 파악' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/판단 직전 10거래일의 실제 흐름/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/앞으로의 방향을 맞혔는지가 아니라/)
        ).toBeInTheDocument();
    });

    it('shows the match rate with its denominator', () => {
        render(<BacktestTrendRecognition stats={STATS} />);
        expect(screen.getByText('89.2%')).toBeInTheDocument();
        expect(
            screen.getByText('추세 파악 일치율 (상승·하락 판단 2284회)')
        ).toBeInTheDocument();
    });

    it('lists each trend label with the move that preceded it', () => {
        render(<BacktestTrendRecognition stats={STATS} />);
        const bearish = screen
            .getByRole('rowheader', { name: '하락 추세' })
            .closest('tr');
        expect(bearish).toHaveTextContent('722');
        expect(bearish).toHaveTextContent('-5.28%');
        expect(bearish).toHaveTextContent('14.1%');
        expect(
            screen.getByRole('columnheader', { name: '직전 10거래일 평균' })
        ).toBeInTheDocument();
    });

    it('does not present a forward direction hit rate', () => {
        render(<BacktestTrendRecognition stats={STATS} />);
        expect(screen.queryByText(/방향 적중/)).not.toBeInTheDocument();
        expect(screen.queryByText(/이후/)).not.toBeInTheDocument();
    });
});
