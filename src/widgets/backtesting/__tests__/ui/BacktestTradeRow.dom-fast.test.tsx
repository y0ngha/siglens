import { render } from '@testing-library/react';
import type { BacktestTrade } from '@y0ngha/siglens-core';

import { toTradeRows } from '@/entities/backtest-case/lib/tradeRows';

import { BacktestTradeRow } from '../../BacktestTradeRow';

const rowOf = (trade: BacktestTrade) => toTradeRows([trade])[0];

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
            reason: 'tp_final',
            returnPct: 3.22,
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
};

describe('BacktestTradeRow', () => {
    it('renders a collapsed one-line summary', () => {
        const { container } = render(<BacktestTradeRow row={rowOf(TRADE)} />);
        const details = container.querySelector('details');
        expect(details).not.toHaveAttribute('open');
        expect(container.querySelector('summary')).toHaveTextContent(
            'NVDA지정가 진입2025-03-12 → 2025-03-19 (5거래일)1차 익절 + 최종 익절+2.60%'
        );
    });

    it('marks the return sign for the list styles', () => {
        const { container, rerender } = render(
            <BacktestTradeRow row={rowOf(TRADE)} />
        );
        expect(container.querySelector('[data-col="return"]')).toHaveAttribute(
            'data-sign',
            'pos'
        );
        rerender(
            <BacktestTradeRow row={rowOf({ ...TRADE, returnPct: -2.57 })} />
        );
        expect(container.querySelector('[data-col="return"]')).toHaveAttribute(
            'data-sign',
            'neg'
        );
    });

    it('leaves an empty detail slot keyed by ticker and entry date', () => {
        const { container } = render(<BacktestTradeRow row={rowOf(TRADE)} />);
        const slot = container.querySelector(
            ':scope details > [data-trade-detail]'
        );
        expect(slot).toHaveAttribute('data-trade-detail', 'NVDA|2025-03-12');
        expect(slot).toBeEmptyDOMElement();
    });

    it('does not render the AI summary or the plan in the server markup', () => {
        const { container } = render(<BacktestTradeRow row={rowOf(TRADE)} />);
        expect(container).not.toHaveTextContent('눌림 구간에서');
        expect(container).not.toHaveTextContent('진입 때 계획');
    });
});
