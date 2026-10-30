import { describe, expect, it } from 'vitest';
import { krLargeHolderLines } from '../../../utils/axis-evidence/krLargeHolderEvidence';
import {
    evaluate,
    makeKrMajorHoldingRecord,
    makeKrSnapshot,
    makeSnapshot,
} from '../../fixtures/flowsFixtures';

describe('krLargeHolderLines', () => {
    it('보고 건수와 상세 보고 건수 줄을 만든다', () => {
        expect(krLargeHolderLines(evaluate(makeKrSnapshot()), 'en')).toEqual([
            {
                id: 'krMajorHolderReports',
                values: { days: '90', reports: '2', reporters: '2' },
            },
            { id: 'krMajorHolderDetailed', values: { count: '1' } },
        ]);
    });

    it('변동이 없으면 최대 변동폭과 함께 변동 없음 줄을 낸다', () => {
        const scorecard = evaluate(
            makeKrSnapshot({
                majorHoldings: [
                    makeKrMajorHoldingRecord({
                        ratioPct: 19.69,
                        ratioChangePct: 0,
                        sharesChange: 0,
                        reason: '보유주식등의 수 변동',
                    }),
                ],
            })
        );
        expect(krLargeHolderLines(scorecard, 'en')).toEqual([
            {
                id: 'krMajorHolderReports',
                values: { days: '90', reports: '1', reporters: '1' },
            },
            { id: 'krMajorHolderNoChange', values: { pct: '0.00' } },
        ]);
    });

    it('미국 점수표처럼 한국 지표가 없으면 빈 배열이다', () => {
        expect(krLargeHolderLines(evaluate(makeSnapshot()), 'en')).toEqual([]);
    });
});
