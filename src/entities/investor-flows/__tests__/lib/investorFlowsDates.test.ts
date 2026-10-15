import { describe, expect, it } from 'vitest';
import {
    addDays,
    compareIsoDate,
    eachDate,
    isPeriodComplete,
    isQuarterEnd,
    isWeekend,
    latestCompletePeriod,
    latestQuarterEndOnOrBefore,
    nextQuarterEnd,
    positionsRetentionFloor,
    previousQuarterEnd,
} from '../../lib/investorFlowsDates';

describe('investorFlowsDates', () => {
    describe('addDays / eachDate', () => {
        it('adds days across month and year boundaries', () => {
            expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
            expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
        });

        it('lists dates inclusive of both ends, ascending', () => {
            expect(eachDate('2026-10-13', '2026-10-15')).toEqual([
                '2026-10-13',
                '2026-10-14',
                '2026-10-15',
            ]);
        });

        it('returns an empty list when from is after to', () => {
            expect(eachDate('2026-10-16', '2026-10-15')).toEqual([]);
        });
    });

    describe('isWeekend', () => {
        it('flags Saturday and Sunday only', () => {
            expect(isWeekend('2026-10-17')).toBe(true); // Sat
            expect(isWeekend('2026-10-18')).toBe(true); // Sun
            expect(isWeekend('2026-10-16')).toBe(false); // Fri
            expect(isWeekend('2026-10-19')).toBe(false); // Mon
        });
    });

    describe('quarter ends', () => {
        it('recognises only the four quarter-end dates', () => {
            expect(isQuarterEnd('2026-09-30')).toBe(true);
            expect(isQuarterEnd('2026-12-31')).toBe(true);
            expect(isQuarterEnd('2026-09-29')).toBe(false);
        });

        it('steps to the previous quarter end across the year boundary', () => {
            expect(previousQuarterEnd('2026-03-31')).toBe('2025-12-31');
            expect(previousQuarterEnd('2026-09-30')).toBe('2026-06-30');
        });

        it('steps to the next quarter end across the year boundary', () => {
            expect(nextQuarterEnd('2026-12-31')).toBe('2027-03-31');
            expect(nextQuarterEnd('2026-06-30')).toBe('2026-09-30');
        });

        it('rejects a date that is not a quarter end', () => {
            expect(() => previousQuarterEnd('2026-09-29')).toThrow(
                'not a quarter end'
            );
            expect(() => nextQuarterEnd('2026-09-29')).toThrow(
                'not a quarter end'
            );
        });

        it('finds the latest quarter end on or before a date (inclusive)', () => {
            expect(latestQuarterEndOnOrBefore('2026-10-15')).toBe('2026-09-30');
            expect(latestQuarterEndOnOrBefore('2026-09-30')).toBe('2026-09-30');
            expect(latestQuarterEndOnOrBefore('2026-01-02')).toBe('2025-12-31');
        });
    });

    describe('completeness and retention', () => {
        it('treats a quarter as complete only after the 45-day deadline plus grace', () => {
            // 2026-06-30 + 50 days = 2026-08-19
            expect(isPeriodComplete('2026-06-30', '2026-08-19')).toBe(false);
            expect(isPeriodComplete('2026-06-30', '2026-08-20')).toBe(true);
        });

        it('keeps the in-progress quarter out of the complete set', () => {
            expect(latestCompletePeriod('2026-10-15')).toBe('2026-06-30');
            expect(latestCompletePeriod('2026-11-30')).toBe('2026-09-30');
        });

        it('retains the two latest complete quarters plus the in-progress one (the latest complete quarter uses its prior as the baseline)', () => {
            expect(positionsRetentionFloor('2026-10-15')).toBe('2026-03-31');
            expect(positionsRetentionFloor('2026-11-30')).toBe('2026-06-30');
        });
    });
});

describe('compareIsoDate', () => {
    it('오름차순: 앞이 이르면 -1, 늦으면 1, 같으면 0', () => {
        expect(compareIsoDate('2026-06-30', '2026-09-30')).toBe(-1);
        expect(compareIsoDate('2026-09-30', '2026-06-30')).toBe(1);
        expect(compareIsoDate('2026-06-30', '2026-06-30')).toBe(0);
    });

    it('월·연 경계에서도 사전순이 시간순이다', () => {
        expect(compareIsoDate('2025-12-31', '2026-01-01')).toBe(-1);
        expect(compareIsoDate('2026-02-09', '2026-02-10')).toBe(-1);
    });

    it('인자를 바꿔 쓰면 내림차순 정렬이 된다', () => {
        expect(
            ['2026-03-31', '2026-09-30', '2026-06-30'].toSorted((a, b) =>
                compareIsoDate(b, a)
            )
        ).toEqual(['2026-09-30', '2026-06-30', '2026-03-31']);
    });

    it('같은 키는 입력 순서를 유지한다(안정 정렬 — 0을 돌려주기 때문)', () => {
        const rows = [
            { d: '2026-01-01', n: 1 },
            { d: '2026-01-01', n: 2 },
        ];
        expect(
            rows.toSorted((a, b) => compareIsoDate(a.d, b.d)).map(r => r.n)
        ).toEqual([1, 2]);
    });
});
