vi.mock('../BacktestCaseCard', () => ({
    BacktestCaseCard: ({ case_ }: { case_: { ticker: string } }) => (
        <div data-testid={`case-${case_.ticker}`}>{case_.ticker}</div>
    ),
}));

import { render, screen } from '@testing-library/react';
import type { BacktestCase } from '@y0ngha/siglens-core';

import { BacktestCaseList } from '../BacktestCaseList';

function makeCase(ticker: string, entryDate: string): BacktestCase {
    return {
        ticker,
        entryDate,
        exitDate: '2024-07-01',
        entryPrice: 100,
        exitPrice: 110,
        returnPct: 10,
        holdingDays: 15,
        result: 'win',
        signalType: 'buy',
        exitReason: 'take_profit',
        aiTrendHit: false,
        aiAnalysis: {
            summary: '',
            tags: [],
            entryRecommendation: 'enter',
            bullishTargets: [],
        },
    } as unknown as BacktestCase;
}

describe('BacktestCaseList', () => {
    it('renders empty message when no cases', () => {
        render(<BacktestCaseList cases={[]} />);

        expect(
            screen.getByText(/해당 종목의 케이스가 없습니다/)
        ).toBeInTheDocument();
    });

    it('renders case cards for each item', () => {
        const cases = [
            makeCase('AAPL', '2024-06-15'),
            makeCase('NVDA', '2024-06-20'),
        ];
        render(<BacktestCaseList cases={cases} />);

        expect(screen.getByTestId('case-AAPL')).toBeInTheDocument();
        expect(screen.getByTestId('case-NVDA')).toBeInTheDocument();
    });

    it('groups cases by month', () => {
        const cases = [
            makeCase('AAPL', '2024-06-15'),
            makeCase('NVDA', '2024-06-20'),
            makeCase('TSLA', '2024-07-01'),
        ];
        render(<BacktestCaseList cases={cases} />);

        expect(screen.getByText('2024년 6월')).toBeInTheDocument();
        expect(screen.getByText('2024년 7월')).toBeInTheDocument();
    });
});
