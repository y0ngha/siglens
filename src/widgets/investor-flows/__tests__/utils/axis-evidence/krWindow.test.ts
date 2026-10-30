import { describe, expect, it } from 'vitest';
import { krNoReportsInWindow } from '../../../utils/axis-evidence/krWindow';
import {
    evaluate,
    makeEmptySnapshot,
    makeKrInsiderRecord,
    makeKrMajorHoldingRecord,
    makeKrSnapshot,
} from '../../fixtures/flowsFixtures';

describe('krNoReportsInWindow', () => {
    // 기준일(2026-10-16)에서 90일 창보다 오래된 접수일.
    const OUTSIDE_WINDOW = '2026-05-04';

    it('보고가 모두 창 밖이면 창 길이와 최신 접수일을 돌려준다', () => {
        const scorecard = evaluate(
            makeKrSnapshot({
                majorHoldings: [
                    makeKrMajorHoldingRecord({ receiptDate: OUTSIDE_WINDOW }),
                ],
                insiderReports: [
                    makeKrInsiderRecord({ receiptDate: OUTSIDE_WINDOW }),
                ],
                tradingPlans: [],
            })
        );
        expect(krNoReportsInWindow(scorecard, 'largeHolders', 'ko')).toEqual({
            days: String(scorecard.freshness.largeHolderWindow.days),
            latestReceiptDate: OUTSIDE_WINDOW,
        });
        expect(krNoReportsInWindow(scorecard, 'insider', 'ko')).toEqual({
            days: String(scorecard.freshness.insiderWindow.days),
            latestReceiptDate: OUTSIDE_WINDOW,
        });
    });

    it('쓸 수 있는 보고가 하나도 없으면 null이다(데이터 부족)', () => {
        const scorecard = evaluate(
            makeKrSnapshot({ majorHoldings: [], insiderReports: [] })
        );
        expect(krNoReportsInWindow(scorecard, 'largeHolders', 'ko')).toBeNull();
        expect(krNoReportsInWindow(scorecard, 'insider', 'ko')).toBeNull();
    });

    it('채점된 축은 null이다', () => {
        const scorecard = evaluate(makeKrSnapshot());
        expect(krNoReportsInWindow(scorecard, 'largeHolders', 'ko')).toBeNull();
    });

    it('미국 점수표는 null이다', () => {
        expect(
            krNoReportsInWindow(
                evaluate(makeEmptySnapshot()),
                'largeHolders',
                'ko'
            )
        ).toBeNull();
    });
});
