import { describe, expect, it } from 'vitest';
import {
    krReportCandidates,
    reportPeriodEnd,
} from '../../lib/krReportCandidates';
import { shareReportOrder } from '../../lib/shareReportOrder';

describe('reportPeriodEnd', () => {
    it.each([
        ['11011', '2025-12-31'],
        ['11012', '2025-06-30'],
        ['11013', '2025-03-31'],
        ['11014', '2025-09-30'],
    ] as const)('%s → %s', (reportCode, expected) => {
        expect(reportPeriodEnd(2025, reportCode)).toBe(expected);
    });
});

describe('krReportCandidates', () => {
    const ids = (today: string) =>
        krReportCandidates(today).map(c => `${c.year}/${c.reportCode}`);

    it('공시 창은 마감 3주 전에 열린다 — 3분기(마감 11/14)는 10/24부터 후보다', () => {
        expect(ids('2026-10-23')[0]).toBe('2026/11012');
        expect(ids('2026-10-24')[0]).toBe('2026/11014');
    });

    it.each([
        // [창이 열리기 전 마지막 날, 창이 열리는 날, 열리기 전 맨 앞, 열린 뒤 맨 앞]
        [
            '1분기(마감 5/15)',
            '2026-04-23',
            '2026-04-24',
            '2025/11011',
            '2026/11013',
        ],
        [
            '반기(마감 8/14)',
            '2026-07-23',
            '2026-07-24',
            '2026/11013',
            '2026/11012',
        ],
        [
            '사업보고서(마감 다음 해 3/31)',
            '2026-03-09',
            '2026-03-10',
            '2025/11014',
            '2025/11011',
        ],
    ])(
        '%s도 마감 3주 전에 후보가 된다',
        (_, before, opens, firstBefore, firstAfter) => {
            expect(ids(before)[0]).toBe(firstBefore);
            expect(ids(opens)[0]).toBe(firstAfter);
        }
    );

    it('마감일 앞뒤로도 후보 순서는 그대로다(마감이 지나도 가장 최신 열린 보고서가 먼저다)', () => {
        expect(ids('2026-11-14')).toEqual([
            '2026/11014',
            '2026/11012',
            '2026/11013',
        ]);
        expect(ids('2026-11-15')).toEqual([
            '2026/11014',
            '2026/11012',
            '2026/11013',
        ]);
        expect(ids('2026-08-14')).toEqual([
            '2026/11012',
            '2026/11013',
            '2025/11011',
        ]);
        expect(ids('2026-08-15')).toEqual([
            '2026/11012',
            '2026/11013',
            '2025/11011',
        ]);
        expect(ids('2026-05-15')).toEqual([
            '2026/11013',
            '2025/11011',
            '2025/11014',
        ]);
        expect(ids('2026-05-16')).toEqual([
            '2026/11013',
            '2025/11011',
            '2025/11014',
        ]);
        expect(ids('2026-03-31')).toEqual([
            '2025/11011',
            '2025/11014',
            '2025/11012',
        ]);
        expect(ids('2026-04-01')).toEqual([
            '2025/11011',
            '2025/11014',
            '2025/11012',
        ]);
    });

    it('창이 닫혀 있는 구간(1~3월 초)은 직전 해 3분기부터 후보로 쓴다', () => {
        expect(ids('2026-01-10')).toEqual([
            '2025/11014',
            '2025/11012',
            '2025/11013',
        ]);
    });

    it('기간 말 당일에는 그 보고서가 후보가 아니다', () => {
        expect(ids('2026-12-31')).not.toContain('2026/11011');
        expect(ids('2027-03-10')[0]).toBe('2026/11011');
    });

    it('후보마다 결산 기간 말과 마감일을 싣는다', () => {
        expect(krReportCandidates('2026-11-22', 1)).toEqual([
            {
                year: 2026,
                reportCode: '11014',
                periodEnd: '2026-09-30',
                deadline: '2026-11-14',
            },
        ]);
        expect(krReportCandidates('2026-03-15', 1)).toEqual([
            {
                year: 2025,
                reportCode: '11011',
                periodEnd: '2025-12-31',
                deadline: '2026-03-31',
            },
        ]);
    });

    it('limit만큼만 돌려준다', () => {
        expect(krReportCandidates('2026-11-22', 2)).toHaveLength(2);
    });
});

describe('shareReportOrder', () => {
    it('사업보고서는 그 보고서 → 전년 사업보고서', () => {
        expect(shareReportOrder(2025, '11011')).toEqual([
            { year: 2025, reportCode: '11011' },
            { year: 2024, reportCode: '11011' },
        ]);
    });

    it('반기보고서는 그 보고서 → 전년 사업보고서', () => {
        expect(shareReportOrder(2026, '11012')).toEqual([
            { year: 2026, reportCode: '11012' },
            { year: 2025, reportCode: '11011' },
        ]);
    });

    it('3분기는 주식 표가 없어 같은 해 반기 → 전년 사업보고서를 본다', () => {
        expect(shareReportOrder(2026, '11014')).toEqual([
            { year: 2026, reportCode: '11012' },
            { year: 2025, reportCode: '11011' },
        ]);
    });

    it('1분기는 같은 해 반기가 아직 없으니 전년 사업보고서 하나다', () => {
        expect(shareReportOrder(2026, '11013')).toEqual([
            { year: 2025, reportCode: '11011' },
        ]);
    });
});
