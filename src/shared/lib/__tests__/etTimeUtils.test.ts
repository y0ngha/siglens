import { describe, expect, it } from 'vitest';

import { getEtOffset, nthSundayDay, toIsoDateTime } from '../etTimeUtils';

// ------------------------------------------------------------------
// nthSundayDay
// ------------------------------------------------------------------
describe('nthSundayDay', () => {
    it('반환값: 2026년 3월 2번째 일요일 = 8일 (3월 1일이 일요일이므로 firstSundayOffset=0)', () => {
        // March 2026: 1st day = Sunday (getUTCDay()=0) → firstSundayOffset = (7-0)%7 = 0
        // 1st Sunday = 1 + 0 = 1, 2nd Sunday = 1 + 7 = 8
        expect(nthSundayDay(2026, 2, 2)).toBe(8);
    });

    it('firstSundayOffset=0 경계: March 2026 1번째 일요일 = 1일', () => {
        expect(nthSundayDay(2026, 2, 1)).toBe(1);
    });

    it('2024년 3월 2번째 일요일 = 10일 (3월 1일이 금요일)', () => {
        // March 2024: 1st day = Friday (getUTCDay()=5) → firstSundayOffset = (7-5)%7 = 2
        // 1st Sunday = 3, 2nd Sunday = 10
        expect(nthSundayDay(2024, 2, 2)).toBe(10);
    });

    it('2024년 11월 1번째 일요일 = 3일', () => {
        // Nov 2024: 1st day = Friday → firstSundayOffset = 2 → 1st Sunday = 3
        expect(nthSundayDay(2024, 10, 1)).toBe(3);
    });

    it('4번째 일요일: 2026년 3월 4번째 일요일 = 22일', () => {
        // March 2026: 1st Sunday = 1, 4th Sunday = 1 + 3*7 = 22
        expect(nthSundayDay(2026, 2, 4)).toBe(22);
    });

    it('2026년 11월 1번째 일요일 = 1일 (11월 1일이 일요일)', () => {
        // Nov 2026: 1st day = Sunday → firstSundayOffset = 0 → 1st Sunday = 1
        expect(nthSundayDay(2026, 10, 1)).toBe(1);
    });
});

// ------------------------------------------------------------------
// getEtOffset
// ------------------------------------------------------------------
describe('getEtOffset', () => {
    // 2026: Spring forward = March 8, Fall back = Nov 1

    describe('2026년 기준 DST 규칙', () => {
        it('2월(봄 전환 전) → EST(-05:00)', () => {
            expect(getEtOffset(2026, 1, 15, 12)).toBe('-05:00');
        });

        it('3월 봄 전환일 전날 → EST(-05:00)', () => {
            expect(getEtOffset(2026, 2, 7, 23)).toBe('-05:00');
        });

        it('봄 전환일 01:59 → EST(-05:00) (전환 전)', () => {
            expect(getEtOffset(2026, 2, 8, 1)).toBe('-05:00');
        });

        it('봄 전환일 02:00 → EDT(-04:00) (전환 후)', () => {
            expect(getEtOffset(2026, 2, 8, 2)).toBe('-04:00');
        });

        it('봄 전환일 03:00 → EDT(-04:00)', () => {
            expect(getEtOffset(2026, 2, 8, 3)).toBe('-04:00');
        });

        it('7월(EDT 구간) → EDT(-04:00)', () => {
            expect(getEtOffset(2026, 6, 4, 12)).toBe('-04:00');
        });

        it('가을 전환일 01:59 → EDT(-04:00) (전환 전)', () => {
            // Fall back: Nov 1, 2026
            expect(getEtOffset(2026, 10, 1, 1)).toBe('-04:00');
        });

        it('가을 전환일 02:00 → EST(-05:00) (전환 후)', () => {
            expect(getEtOffset(2026, 10, 1, 2)).toBe('-05:00');
        });

        it('12월(가을 전환 후) → EST(-05:00)', () => {
            expect(getEtOffset(2026, 11, 15, 12)).toBe('-05:00');
        });
    });

    describe('2024년 기준 DST 규칙 (spring=March 10, fall=Nov 3)', () => {
        it('봄 전환일 01:59 → EST(-05:00)', () => {
            expect(getEtOffset(2024, 2, 10, 1)).toBe('-05:00');
        });

        it('봄 전환일 02:00 → EDT(-04:00)', () => {
            expect(getEtOffset(2024, 2, 10, 2)).toBe('-04:00');
        });

        it('가을 전환일 01:59 → EDT(-04:00)', () => {
            expect(getEtOffset(2024, 10, 3, 1)).toBe('-04:00');
        });

        it('가을 전환일 02:00 → EST(-05:00)', () => {
            expect(getEtOffset(2024, 10, 3, 2)).toBe('-05:00');
        });
    });

    describe('2030년 기준 DST 규칙', () => {
        it('여름(7월) → EDT(-04:00)', () => {
            expect(getEtOffset(2030, 6, 15, 10)).toBe('-04:00');
        });

        it('1월 → EST(-05:00)', () => {
            expect(getEtOffset(2030, 0, 1, 0)).toBe('-05:00');
        });
    });
});

// ------------------------------------------------------------------
// toIsoDateTime
// ------------------------------------------------------------------
describe('toIsoDateTime', () => {
    it('EDT 구간(7월): 공백 → T 치환 + -04:00 부여', () => {
        expect(toIsoDateTime('2026-07-04 10:30:00')).toBe(
            '2026-07-04T10:30:00-04:00'
        );
    });

    it('EST 구간(12월): 공백 → T 치환 + -05:00 부여', () => {
        expect(toIsoDateTime('2026-12-25 09:00:00')).toBe(
            '2026-12-25T09:00:00-05:00'
        );
    });

    it('반환 형식 불변식: YYYY-MM-DDTHH:mm:ss±HH:00', () => {
        const result = toIsoDateTime('2026-03-08 02:30:00');
        expect(result).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/
        );
    });

    it('봄 전환 경계: 02:00 → EDT(-04:00)', () => {
        // March 8, 2026 02:00 = spring forward
        expect(toIsoDateTime('2026-03-08 02:00:00')).toBe(
            '2026-03-08T02:00:00-04:00'
        );
    });

    it('봄 전환 경계: 01:59 → EST(-05:00)', () => {
        expect(toIsoDateTime('2026-03-08 01:59:00')).toBe(
            '2026-03-08T01:59:00-05:00'
        );
    });
});
