import { describe, expect, it } from 'vitest';
import { institutionalLines } from '../../../utils/axis-evidence/institutionalEvidence';
import { evaluate, makeSnapshot } from '../../fixtures/flowsFixtures';

const scorecard = evaluate(makeSnapshot());

function withMetrics(
    overrides: Partial<typeof scorecard.institutional.metrics>
) {
    return {
        ...scorecard,
        institutional: {
            ...scorecard.institutional,
            metrics: { ...scorecard.institutional.metrics, ...overrides },
        },
    };
}

describe('institutionalLines', () => {
    it('보유 기관 수·순변화·신규/이탈 줄을 만든다', () => {
        expect(institutionalLines(scorecard, 'en')).toEqual([
            {
                id: 'holders',
                values: { count: '5,240', change: '+2.5%' },
            },
            { id: 'netSharesOutstanding', values: { pct: '+0.95%' } },
            { id: 'newExited', values: { added: '310', exited: '180' } },
        ]);
    });

    it('보유 기관 수 변화율이 없으면 변화 없이 수만 보인다(holdersOnly)', () => {
        const lines = institutionalLines(
            withMetrics({ holderCountChangePct: null }),
            'en'
        );
        expect(lines[0]).toEqual({
            id: 'holdersOnly',
            values: { count: '5,240', change: '' },
        });
    });

    it('순변화 분모가 직전 보유이면 netSharesPrior 문구를 쓴다', () => {
        const lines = institutionalLines(
            withMetrics({ netShareChangeBasis: 'priorHoldings' }),
            'en'
        );
        expect(lines.map(l => l.id)).toContain('netSharesPrior');
        expect(lines.map(l => l.id)).not.toContain('netSharesOutstanding');
    });

    it('값이 없는 줄은 만들지 않는다', () => {
        const lines = institutionalLines(
            withMetrics({
                holders: null,
                netShareChangePct: null,
                newHolders: null,
                putCallValueRatio: null,
            }),
            'en'
        );
        expect(lines).toEqual([]);
    });

    it('풋/콜 비율이 있으면 소수 둘째 자리까지 줄로 낸다', () => {
        const lines = institutionalLines(
            withMetrics({ putCallValueRatio: 0.8 }),
            'en'
        );
        expect(lines.at(-1)).toEqual({
            id: 'putCallRatio',
            values: { ratio: '0.80' },
        });
    });
});
