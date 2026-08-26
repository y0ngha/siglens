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

    /**
     * 월 구분은 **헤딩이어야 한다.** 시각적으로만 제목이고 `<div>`였던 탓에
     * 41,000자짜리 이 페이지에 헤딩이 h1 하나뿐이었고, 스크린리더로 케이스
     * 100개를 훑을 길이 없었다(접근성 감사 SC 1.3.1).
     *
     * 태그를 되돌려도 위 "groups cases by month"는 `getByText`라 그대로
     * 통과한다 — 그래서 **역할(role)**로 따로 단언한다.
     */
    it('월 구분을 헤딩으로 노출한다', () => {
        const cases = [
            makeCase('AAPL', '2024-06-15'),
            makeCase('TSLA', '2024-07-01'),
        ];
        render(<BacktestCaseList cases={cases} />);

        const headings = screen.getAllByRole('heading', { level: 2 });
        expect(headings.map(h => h.textContent)).toEqual([
            '2024년 6월',
            '2024년 7월',
        ]);
    });
});
