import { describe, expect, it } from 'vitest';
import { buildMajorHolderRows } from '../../utils/krMajorHolders';
import {
    makeKrMajorHoldingRecord,
    makeKrSnapshot,
} from '../fixtures/flowsFixtures';

function reportsOf(records: ReturnType<typeof makeKrMajorHoldingRecord>[]) {
    return makeKrSnapshot({ majorHoldings: records }).kr!.majorHolders;
}

describe('buildMajorHolderRows', () => {
    const reports = reportsOf([
        makeKrMajorHoldingRecord({
            rceptNo: '20260901000001',
            receiptDate: '2026-09-01',
            ratioPct: 4.93,
            ratioChangePct: 4.93,
        }),
        makeKrMajorHoldingRecord({
            rceptNo: '20261014000002',
            receiptDate: '2026-10-14',
            ratioPct: 5.12,
            // DART는 이 보고의 증감을 전체 비율로 적지만, 직전 보고와 비교한 값이 쓰인다.
            ratioChangePct: 5.12,
        }),
    ]);

    it('최신 접수일 순 행마다 같은 보고자의 직전 보고 대비 증감을 붙인다', () => {
        const { rows, omittedCount } = buildMajorHolderRows(reports);
        expect(rows.map(r => r.row.receiptDate)).toEqual([
            '2026-10-14',
            '2026-09-01',
        ]);
        expect(rows[0].ratioChangePct).toBeCloseTo(0.19, 2);
        expect(rows[1].ratioChangePct).toBeNull();
        expect(omittedCount).toBe(0);
    });

    it('상한 밖으로 빠진 옛 보고도 증감 비교 대상이다', () => {
        const many = reportsOf(
            Array.from({ length: 12 }, (_, index) =>
                makeKrMajorHoldingRecord({
                    rceptNo: `2026${String(index + 1).padStart(2, '0')}15000001`,
                    receiptDate: `2026-${String(index + 1).padStart(2, '0')}-15`,
                    ratioPct: 5 + index * 0.1,
                    ratioChangePct: 0.1,
                })
            )
        );
        const { rows, omittedCount } = buildMajorHolderRows(many);
        expect(omittedCount).toBe(2);
        expect(rows).toHaveLength(10);
        // 표의 가장 오래된 행도 표에서 잘린 더 옛 보고와 비교해 증감을 가진다.
        expect(rows.at(-1)?.ratioChangePct).toBeCloseTo(0.1, 2);
    });
});
