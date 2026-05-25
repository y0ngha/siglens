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
