import { describe, expect, it } from 'vitest';
import { buildAxisEvidence } from '../../../utils/axisEvidence';
import {
    evaluate,
    makeProposedSale,
    makeSnapshot,
    makeTransaction,
} from '../../fixtures/flowsFixtures';

describe('내부자 순매수 근거 줄', () => {
    it('Form 144만 있고 Form 4가 없어 순액이 정확히 0이면 순매수가 아니라 "순매수도 순매도도 아님"으로 말한다', () => {
        const scorecard = evaluate(
            makeSnapshot({
                insider: { transactions: [] },
                proposedSales: [makeProposedSale()],
            })
        );
        expect(scorecard.insider.metrics?.netValueUsd).toBe(0);
        const lines = buildAxisEvidence(scorecard, 'insider', 'en');
        expect(lines[0].id).toBe('insiderNetFlat');
        expect(lines.map(line => line.id)).not.toContain('insiderNetBuy');
    });

    it('순매수면 insiderNetBuy, 순매도면 insiderNetSell이다', () => {
        const buyOnly = evaluate(
            makeSnapshot({
                insider: {
                    transactions: [makeTransaction({ value: 840_000 })],
                },
            })
        );
        const sellOnly = evaluate(
            makeSnapshot({
                insider: {
                    transactions: [
                        makeTransaction({ type: 'sell', value: 840_000 }),
                    ],
                },
            })
        );
        expect(buildAxisEvidence(buyOnly, 'insider', 'en')[0].id).toBe(
            'insiderNetBuy'
        );
        expect(buildAxisEvidence(sellOnly, 'insider', 'en')[0].id).toBe(
            'insiderNetSell'
        );
    });
});
