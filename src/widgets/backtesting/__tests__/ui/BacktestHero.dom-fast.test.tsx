import { render, screen } from '@testing-library/react';
import { BacktestHero } from '../../BacktestHero';
import { makeStats, tickerStats } from '../fixtures/statsFixture';

const STATS = makeStats({
    perTicker: Array.from({ length: 10 }, (_, i) => tickerStats(`T${i}`)),
});

describe('BacktestHero', () => {
    it('renders the run period as months', () => {
        render(<BacktestHero stats={STATS} />);
        expect(screen.getByText(/2024\.11~2026\.11/)).toBeInTheDocument();
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

    it('shows the portfolio return with both hold baselines in the same card', () => {
        render(<BacktestHero stats={STATS} />);
        const card = screen.getByText('+29.1%').closest('div')?.parentElement;
        expect(card).toHaveTextContent(
            '같은 10종목을 계속 들고 있었다면 +44.3%, AI 전략의 투자 비중(62.5%)만큼만 들고 있었다면 +27.5%'
        );
    });

    it('headlines the mark-to-market drawdown and keeps the closed-trade and hold values as sub-label', () => {
        render(<BacktestHero stats={STATS} />);
        const card = screen
            .getByText('최대 낙폭 (매일 평가 기준)')
            .closest('div')?.parentElement;
        expect(card).toHaveTextContent('-12.4%');
        expect(card).toHaveTextContent('청산 기준 -9.3%, 계속 보유 -30.0%');
        expect(screen.queryByText('최대 낙폭 (청산 기준)')).toBeNull();
    });

    it('shows win rate with its counts and the bracket placebo that is comparable to it', () => {
        render(<BacktestHero stats={STATS} />);
        expect(screen.getByText('57.4%')).toBeInTheDocument();
        const card = screen.getByText('57.4%').closest('div')?.parentElement;
        expect(card).toHaveTextContent(
            '395/688건. 처음 세운 1차 목표가가 손절가보다 먼저 닿은 비율은 52.7%(641건 중), 같은 폭의 목표가와 손절가를 임의의 날에 두면 49.1%(1,919번 중)'
        );
        expect(card).not.toHaveTextContent('56.6%');
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

    it('shows the per-trade mean with the same-days baseline value and the difference from it', () => {
        render(<BacktestHero stats={STATS} />);
        const card = screen.getByText('+0.39%').closest('div')?.parentElement;
        // 기준선 값은 baselineMeanPct(0.4457)를 두 자리로 찍은 +0.45%다. 이 픽스처에서는 평균에서
        // 차이를 빼도 같은 값이 나오므로, 재계산하지 않는다는 것은 아래 테스트가 따로 본다.
        expect(card).toHaveTextContent(
            '같은 종목을 기간 중 아무 날에나 사서 같은 날수만큼 들고 있었을 때의 평균(+0.45%)과 비교하면 거래당 평균 차이는 -0.06% (95% 범위 -0.40%~+0.30%)'
        );
    });

    it('prints the baseline from the benchmark block, not from the mean minus the difference', () => {
        const stats = makeStats({
            perTicker: STATS.perTicker,
            benchmarks: {
                ...STATS.benchmarks,
                perTradeExcess: {
                    ...STATS.benchmarks.perTradeExcess,
                    baselineMeanPct: 1.2345,
                },
            },
        });
        render(<BacktestHero stats={stats} />);
        const card = screen.getByText('+0.39%').closest('div')?.parentElement;
        expect(card).toHaveTextContent(
            '들고 있었을 때의 평균(+1.23%)과 비교하면'
        );
    });

    it('renders a baseline in every card that shows a return', () => {
        render(<BacktestHero stats={STATS} />);
        const cards = screen
            .getAllByTestId('stat-sub-label')
            .map(sub => sub.parentElement);
        const withReturn = cards.filter(card =>
            /^[+-]\d+\.\d+%/.test(card?.textContent ?? '')
        );
        // 포트폴리오 수익률, 최대 낙폭(음수라 부호로 시작), 거래당 평균 수익률 카드.
        expect(withReturn).toHaveLength(3);
        withReturn.forEach(card => {
            expect(
                card?.querySelector('[data-testid="stat-sub-label"]')
                    ?.textContent
            ).toMatch(/[+-]\d+\.\d+%/);
        });
    });

    it('colours the mean return by the printed value, not the raw one', () => {
        // -0.004는 두 자리로 찍으면 +0.00%다 — 손실 색이어도 이익 색이어도 안 되고 중립이다.
        render(<BacktestHero stats={{ ...STATS, meanReturnPct: -0.004 }} />);
        expect(screen.getByText('+0.00%').className).toContain(
            'text-secondary-300'
        );
    });
});
