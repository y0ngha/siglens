import { describe, expect, it } from 'vitest';
import { dilutionLines } from '../../../utils/axis-evidence/dilutionEvidence';
import {
    evaluate,
    makeEmptySnapshot,
    makeExpandedSnapshot,
    makeOffering,
} from '../../fixtures/flowsFixtures';

describe('dilutionLines', () => {
    it('증자 공시가 없으면 "공시 없음" 한 줄만 낸다', () => {
        const scorecard = evaluate(makeExpandedSnapshot({ offerings: [] }));
        expect(dilutionLines(scorecard, 'en')).toEqual([
            { id: 'dilutionNoneOnRecord', values: {} },
        ]);
    });

    it('ATM 공시가 있으면 건수 줄과 ATM/모집 공시 줄을 낸다', () => {
        const scorecard = evaluate(makeExpandedSnapshot());
        expect(dilutionLines(scorecard, 'en')).toEqual([
            { id: 'dilutionFilings', values: { count: '2', days: '180' } },
            { id: 'dilutionIssuance', values: { atm: '1', marketed: '0' } },
        ]);
    });

    it('ATM·모집 공시가 없으면 건수 줄만 낸다', () => {
        const scorecard = evaluate(
            makeExpandedSnapshot({
                offerings: [makeOffering({ kind: 'shelf' })],
            })
        );
        expect(dilutionLines(scorecard, 'en')).toEqual([
            { id: 'dilutionFilings', values: { count: '1', days: '180' } },
        ]);
    });

    it('증자 지표가 없는 스냅샷이면 빈 배열이다', () => {
        expect(dilutionLines(evaluate(makeEmptySnapshot()), 'en')).toEqual([]);
    });
});
