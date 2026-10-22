import type { KrMajorHolderReport } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import {
    majorHolderRatioChange,
    withPreviousReportRatioChanges,
} from '../../lib/krMajorHolderRatioChange';

function report(over: Partial<KrMajorHolderReport>): KrMajorHolderReport {
    return {
        receiptDate: '2026-10-01',
        reporter: 'A운용',
        reportForm: 'detailed',
        shares: 1000,
        sharesChange: 0,
        ratioPct: 5,
        ratioChangePct: 0,
        reason: '',
        url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261001000001',
        ...over,
    } as KrMajorHolderReport;
}

describe('majorHolderRatioChange', () => {
    describe('같은 보고자의 이전 보고가 있으면', () => {
        it('가장 최근 이전 보고와 비교한다(4.80 → 4.93 → 5.12면 +0.19, +0.32가 아니다)', () => {
            const rows = [
                report({
                    receiptDate: '2026-03-01',
                    ratioPct: 4.8,
                    url: 'x?rcpNo=20260301000001',
                }),
                report({
                    receiptDate: '2026-06-01',
                    ratioPct: 4.93,
                    url: 'x?rcpNo=20260601000001',
                }),
                report({
                    receiptDate: '2026-08-18',
                    ratioPct: 5.12,
                    ratioChangePct: 5.12,
                    url: 'x?rcpNo=20260818000001',
                }),
            ];
            expect(majorHolderRatioChange(rows[2], rows)).toBe(0.19);
            expect(majorHolderRatioChange(rows[1], rows)).toBe(0.13);
        });

        it('같은 날 두 보고는 접수번호 순서로 직전을 정한다(증감을 두 번 세지 않는다)', () => {
            const early = report({
                receiptDate: '2026-10-16',
                ratioPct: 6.0,
                ratioChangePct: 1.0,
                url: 'x?rcpNo=20261016000100',
            });
            const late = report({
                receiptDate: '2026-10-16',
                ratioPct: 6.5,
                ratioChangePct: 1.5,
                url: 'x?rcpNo=20261016000200',
            });
            const prior = report({
                receiptDate: '2026-09-01',
                ratioPct: 5.0,
                url: 'x?rcpNo=20260901000001',
            });
            const rows = [late, early, prior];
            expect(majorHolderRatioChange(early, rows)).toBe(1);
            expect(majorHolderRatioChange(late, rows)).toBe(0.5);
        });
    });

    describe('이전 보고가 없으면', () => {
        it('DART 증감이 보유비율 전체와 같으면(최초 보고) 계산할 수 없어 null', () => {
            const first = report({ ratioPct: 5.12, ratioChangePct: 5.12 });
            expect(majorHolderRatioChange(first, [first])).toBeNull();
        });

        it('오차(0.005) 안이면 최초 보고로 보고, 넘으면 DART 증감을 쓴다', () => {
            const near = report({ ratioPct: 5.12, ratioChangePct: 5.116 });
            expect(majorHolderRatioChange(near, [near])).toBeNull();
            const routine = report({ ratioPct: 5.12, ratioChangePct: 0.3 });
            expect(majorHolderRatioChange(routine, [routine])).toBe(0.3);
        });

        it('다른 보고자의 보고는 직전 보고가 아니다', () => {
            const other = report({
                reporter: 'B운용',
                receiptDate: '2026-01-01',
                ratioPct: 9,
            });
            const first = report({ ratioPct: 5.5, ratioChangePct: 5.5 });
            expect(majorHolderRatioChange(first, [other, first])).toBeNull();
        });
    });
});

describe('withPreviousReportRatioChanges', () => {
    it('계산된 증감으로 바꾸고, 바뀌지 않는 행은 같은 객체를 돌려준다', () => {
        const prior = report({
            receiptDate: '2026-03-05',
            ratioPct: 4.93,
            ratioChangePct: 0.2,
            url: 'x?rcpNo=20260305000001',
        });
        const latest = report({
            receiptDate: '2026-08-18',
            ratioPct: 5.12,
            ratioChangePct: 5.12,
            url: 'x?rcpNo=20260818000001',
        });
        const out = withPreviousReportRatioChanges([prior, latest]);
        expect(out[1].ratioChangePct).toBe(0.19);
        expect(out[0]).toBe(prior);
    });

    it('계산할 수 없는 최초 보고는 core가 5% 신규 진입을 판정하도록 DART 값을 그대로 둔다', () => {
        const first = report({ ratioPct: 5.12, ratioChangePct: 5.12 });
        const [out] = withPreviousReportRatioChanges([first]);
        expect(out).toBe(first);
        expect(out.ratioChangePct).toBe(5.12);
    });
});
