import { render, screen, within } from '@testing-library/react';
import { BacktestComparison } from '../../BacktestComparison';
import { BENCHMARKS, makeStats, tickerStats } from '../fixtures/statsFixture';

// 실행 순서가 수익률 순서와 일부러 어긋나게 둔다 — 정렬하면 순서가 바뀐다.
const STATS = makeStats({
    perTicker: [
        tickerStats('MSFT', {
            trades: 65,
            winRate: 60.3077,
            strategyPct: 5.0412,
            markToMarketMaxDrawdownPct: -17.2144,
            exposurePct: 66.8663,
            buyHoldPct: 23.6112,
            exposureMatchedHoldPct: 15.8271,
            buyHoldMaxDrawdownPct: -34.9183,
        }),
        tickerStats('SPY', {
            trades: 64,
            winRate: 57.8123,
            strategyPct: 47.0812,
            markToMarketMaxDrawdownPct: -14.8409,
            exposurePct: 64.6921,
            buyHoldPct: 31.7123,
            exposureMatchedHoldPct: 20.5052,
            buyHoldMaxDrawdownPct: -19.0012,
        }),
        tickerStats('QQQ', {
            trades: 65,
            winRate: 46.1538,
            strategyPct: -11.4612,
            markToMarketMaxDrawdownPct: -16.6031,
            exposurePct: 65.2,
            buyHoldPct: 39.6612,
            exposureMatchedHoldPct: 25.8661,
            buyHoldMaxDrawdownPct: -22.8512,
        }),
    ],
});

const rowOf = (name: string) =>
    screen.getByRole('rowheader', { name }).closest('tr') as HTMLElement;

describe('BacktestComparison', () => {
    it('renders a headed table named for the comparison with holding', () => {
        render(<BacktestComparison stats={STATS} />);
        expect(
            screen.getByRole('heading', { level: 2, name: '보유 전략과 비교' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: '보유 전략과 비교 표' })
        ).toBeInTheDocument();
    });

    it('labels all nine columns', () => {
        render(<BacktestComparison stats={STATS} />);
        expect(
            screen.getAllByRole('columnheader').map(h => h.textContent)
        ).toEqual([
            '종목',
            '매매',
            '승률',
            'AI 전략',
            '최대 낙폭 (매일 평가)',
            '투자 비중',
            '계속 보유',
            '비중 맞춘 보유',
            '보유 시 최대 낙폭',
        ]);
    });

    it('puts the portfolio row first with the values from benchmarks', () => {
        render(<BacktestComparison stats={STATS} />);
        const rows = screen.getAllByRole('row');
        expect(rows).toHaveLength(5); // header + portfolio + 3 tickers
        expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent(
            '3종목 포트폴리오'
        );
        expect(
            within(rows[1])
                .getAllByRole('cell')
                .map(cell => cell.textContent)
        ).toEqual([
            '690',
            '57.4%',
            '+29.1%',
            '-12.4%',
            '62.5%',
            '+44.3%',
            '+27.5%',
            '-30.0%',
        ]);
    });

    it('keeps the tickers in run order instead of sorting by return', () => {
        render(<BacktestComparison stats={STATS} />);
        const rows = screen.getAllByRole('row').slice(2);
        expect(
            rows.map(row => within(row).getByRole('rowheader').textContent)
        ).toEqual(['MSFT', 'SPY', 'QQQ']);
    });

    it('renders every ticker row with its own return, drawdown and hold values', () => {
        render(<BacktestComparison stats={STATS} />);
        expect(
            within(rowOf('SPY'))
                .getAllByRole('cell')
                .map(cell => cell.textContent)
        ).toEqual([
            '64',
            '57.8%',
            '+47.1%',
            '-14.8%',
            '64.7%',
            '+31.7%',
            '+20.5%',
            '-19.0%',
        ]);
        expect(
            within(rowOf('QQQ'))
                .getAllByRole('cell')
                .map(cell => cell.textContent)
        ).toEqual([
            '65',
            '46.2%',
            '-11.5%',
            '-16.6%',
            '65.2%',
            '+39.7%',
            '+25.9%',
            '-22.9%',
        ]);
    });

    it('shows the mark-to-market drawdown, not the closed-trade one', () => {
        render(<BacktestComparison stats={STATS} />);
        const portfolio = screen.getAllByRole('row')[1];
        expect(portfolio).toHaveTextContent('-12.4%');
        expect(portfolio).not.toHaveTextContent('-9.3%');
        expect(rowOf('MSFT')).toHaveTextContent('-17.2%');
        expect(rowOf('MSFT')).not.toHaveTextContent('-14.4%');
    });

    it('renders the portfolio hold values straight from the benchmark block', () => {
        const stats = makeStats({
            perTicker: STATS.perTicker,
            benchmarks: {
                ...BENCHMARKS,
                holdPortfolio: { returnPct: 11.2222, maxDrawdownPct: -3.3333 },
                exposureMatchedHold: {
                    ...BENCHMARKS.exposureMatchedHold,
                    returnPct: 7.7777,
                },
            },
        });
        render(<BacktestComparison stats={stats} />);
        const portfolio = screen.getAllByRole('row')[1];
        expect(portfolio).toHaveTextContent('+11.2%');
        expect(portfolio).toHaveTextContent('+7.8%');
        expect(portfolio).toHaveTextContent('-3.3%');
    });

    it('states the basis of the comparison in the note', () => {
        render(<BacktestComparison stats={STATS} />);
        expect(
            screen.getByText(/낙폭은 모두 매일 종가로 평가했어요/)
        ).toBeInTheDocument();
    });

    it('keeps the table scrollable by keyboard', () => {
        render(<BacktestComparison stats={STATS} />);
        expect(
            screen.getByRole('region', { name: '보유 전략과 비교 표' })
        ).toHaveAttribute('tabindex', '0');
    });

    it('names the table by the section heading', () => {
        render(<BacktestComparison stats={STATS} />);
        expect(
            screen.getByRole('table', { name: '보유 전략과 비교' })
        ).toBeInTheDocument();
    });

    it('takes the portfolio exposure from the matched-hold block', () => {
        const stats = makeStats({
            perTicker: STATS.perTicker,
            benchmarks: {
                ...BENCHMARKS,
                exposureMatchedHold: {
                    ...BENCHMARKS.exposureMatchedHold,
                    exposurePct: 33.3,
                },
            },
        });
        render(<BacktestComparison stats={stats} />);
        const portfolio = screen.getAllByRole('row')[1];
        expect(portfolio).toHaveTextContent('33.3%');
    });

    it('colours the hold cells by the printed value', () => {
        const stats = makeStats({
            perTicker: [
                tickerStats('MSFT', {
                    buyHoldPct: -0.04,
                    exposureMatchedHoldPct: 0.04,
                }),
            ],
        });
        render(<BacktestComparison stats={stats} />);
        const cells = within(rowOf('MSFT')).getAllByRole('cell');
        // -0.04는 "+0.0%"로 찍히므로 손실 색도 이익 색도 아닌 중립이다.
        expect(cells[5]).toHaveTextContent('+0.0%');
        expect(cells[5].className).toContain('text-secondary-300');
        expect(cells[6].className).toContain('text-secondary-300');
        expect(cells[5].className).not.toContain('text-ui-danger-text');
    });
});
