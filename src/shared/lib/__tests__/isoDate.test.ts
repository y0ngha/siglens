import { toUtcIsoDate } from '@/shared/lib/isoDate';

describe('toUtcIsoDate', () => {
    it('UTC 기준 달력 날짜를 YYYY-MM-DD로 반환한다', () => {
        expect(toUtcIsoDate(new Date('2026-09-18T12:34:56.789Z'))).toBe(
            '2026-09-18'
        );
    });

    it('UTC 자정 직전은 같은 날, 자정은 다음 날이다(현지 타임존 무관)', () => {
        expect(toUtcIsoDate(new Date('2026-09-18T23:59:59.999Z'))).toBe(
            '2026-09-18'
        );
        expect(toUtcIsoDate(new Date('2026-09-19T00:00:00.000Z'))).toBe(
            '2026-09-19'
        );
    });

    it('유효하지 않은 Date는 RangeError를 던진다', () => {
        expect(() => toUtcIsoDate(new Date(Number.NaN))).toThrow(RangeError);
    });
});
