import { render, screen } from '@testing-library/react';
import type { BacktestTrade } from '@y0ngha/siglens-core';

import { TradeDetails } from '../../ui/trade-row/TradeDetails';

const TRADE: BacktestTrade = {
    ticker: 'NVDA',
    entryType: 'wait_limit',
    decisionDate: '2025-03-11',
    entryDate: '2025-03-12',
    entryPrice: 112.5,
    exitDate: '2025-03-19',
    holdingDays: 5,
    returnPct: 2.6,
    legs: [
        {
            name: 'A',
            size: 0.5,
            exitDate: '2025-03-14',
            exitPrice: 114.73,
            reason: 'tp1',
            returnPct: 1.98,
        },
        {
            name: 'B',
            size: 0.5,
            exitDate: '2025-03-19',
            exitPrice: 116.12,
            reason: 'breakeven',
            returnPct: 0,
        },
    ],
    initialPlan: {
        tp1: 114.73,
        tpFinal: 116.12,
        sl1: 108,
        sl2: 105.5,
        source: 'ai',
    },
    holdingReviews: 4,
    summary: '눌림 구간에서 지지가 확인됐습니다.',
    promptFile: 'prompts/NVDA/2025-03-11_entry.json',
    responseFile: 'responses/NVDA/2025-03-11_entry.json',
};

describe('TradeDetails', () => {
    it('describes the decision and each half of the exit', () => {
        render(<TradeDetails trade={TRADE} />);
        expect(
            screen.getByText(
                '2025-03-11 장 마감 뒤 판단, 2025-03-12 112.50달러에 매수'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '절반 A: 2025-03-14 114.73달러에 정리 (1차 목표가 익절) +1.98%'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '절반 B: 2025-03-19 116.12달러에 정리 (본전 정리) +0.00%'
            )
        ).toBeInTheDocument();
    });

    it('shows the plan, AI summary, review count and archive paths', () => {
        render(<TradeDetails trade={TRADE} />);
        expect(
            screen.getByText(
                '진입 때 계획: 1차 목표가 114.73달러, 최종 목표가 116.12달러, 손절가 108.00달러, 2차 손절선 105.50달러'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('눌림 구간에서 지지가 확인됐습니다.')
        ).toBeInTheDocument();
        expect(screen.getByText('보유 중 재분석 4회')).toBeInTheDocument();
        expect(
            screen.getByText(
                '프롬프트 prompts/NVDA/2025-03-11_entry.json · 응답 responses/NVDA/2025-03-11_entry.json'
            )
        ).toBeInTheDocument();
    });

    it('links to the symbol page with a descriptive label', () => {
        render(<TradeDetails trade={TRADE} />);
        expect(
            screen.getByRole('link', { name: 'NVDA 분석 보기' })
        ).toHaveAttribute('href', '/NVDA');
    });

    it('omits the archive paths when the trade has none', () => {
        const { promptFile: _p, responseFile: _r, ...rest } = TRADE;
        render(<TradeDetails trade={rest} />);
        expect(screen.queryByText(/prompts\//)).not.toBeInTheDocument();
    });
});
