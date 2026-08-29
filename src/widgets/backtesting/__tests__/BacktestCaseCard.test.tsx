vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/shared/lib/priceFormat', () => ({
    formatUsdCurrency: (n: number) => `$${n.toFixed(2)}`,
}));

import { render, screen } from '@testing-library/react';
import type { BacktestCase } from '@y0ngha/siglens-core';

import { BacktestCaseCard } from '../BacktestCaseCard';

function makeCase(overrides: Partial<BacktestCase> = {}): BacktestCase {
    return {
        ticker: 'AAPL',
        entryDate: '2024-06-15',
        exitDate: '2024-07-01',
        entryPrice: 190,
        exitPrice: 200,
        returnPct: 5.26,
        holdingDays: 16,
        result: 'win',
        signalType: 'buy',
        exitReason: 'take_profit',
        aiResult: 'win',
        aiTrendHit: true,
        aiAnalysis: {
            summary: 'AI 분석 요약',
            tags: ['골든크로스', 'RSI 과매도'],
            entryRecommendation: 'enter',
            riskLevel: 'low',
            bullishTargets: [{ price: 210, basis: '이전 고점 돌파' }],
            stopLoss: 185,
            takeProfit: 210,
        },
        ...overrides,
    };
}

describe('BacktestCaseCard', () => {
    it('renders the ticker badge', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('renders the return percentage', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('+5.3%')).toBeInTheDocument();
    });

    it('renders the AI analysis summary', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('AI 분석 요약')).toBeInTheDocument();
    });

    it('renders tags', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('골든크로스')).toBeInTheDocument();
        expect(screen.getByText('RSI 과매도')).toBeInTheDocument();
    });

    it('renders entry recommendation badge', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('AI 진입 권고')).toBeInTheDocument();
    });

    it('renders risk badge', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('low')).toBeInTheDocument();
    });

    it('renders formatted prices', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('$190.00')).toBeInTheDocument();
        expect(screen.getByText('$200.00')).toBeInTheDocument();
    });

    it('renders loss variant for negative returns', () => {
        render(
            <BacktestCaseCard
                case_={makeCase({
                    result: 'loss',
                    returnPct: -3.2,
                    exitReason: 'stop_loss',
                })}
            />
        );

        expect(screen.getByText('-3.2%')).toBeInTheDocument();
    });

    it('has an accessible article label', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(
            screen.getByRole('article', { name: /AAPL 2024-06-15 수익/ })
        ).toBeInTheDocument();
    });
});

/**
 * 청산 칩이 결과와 무관하게 항상 danger 배색이면, 수익 케이스가
 * "초록 진입 → 빨강 청산"으로 읽힌다. 이 페이지의 논지가 승률(70%)인데
 * 배색이 그 반대를 말하는 셈이다. 손절만 빨강이어야 한다.
 */
describe('청산 칩 배색', () => {
    it('손절은 danger 배색이다', () => {
        const { container } = render(
            <BacktestCaseCard case_={makeCase({ exitReason: 'stop_loss' })} />
        );
        const chip = screen.getByText('손절').parentElement as HTMLElement;
        expect(chip.className).toContain('chart-bearish');
        expect(container).toBeTruthy();
    });

    it.each(['take_profit', 'time'] as const)(
        '%s 청산은 danger 배색이 아니다',
        reason => {
            render(
                <BacktestCaseCard
                    case_={makeCase({ exitReason: reason, result: 'win' })}
                />
            );
            const chip = screen.getByText('매도').parentElement as HTMLElement;
            expect(chip.className).not.toContain('chart-bearish');
        }
    );
});

/**
 * 10개 종목을 다루면서 심볼 페이지로 나가는 내부 링크가 하나도 없었다
 * (감사 실측: 앵커 43개가 전부 전역 nav/footer 크롬). 배지를 링크로 되돌려
 * 놓아도 화면상 차이가 거의 없어 조용히 회귀한다.
 */
describe('티커 링크', () => {
    it('티커 배지가 종목 페이지로 간다', () => {
        render(<BacktestCaseCard case_={makeCase({ ticker: 'GOOGL' })} />);
        expect(screen.getByText('GOOGL')).toHaveAttribute('href', '/GOOGL');
    });
});
