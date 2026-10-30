import {
    dayOfWeekFromKey,
    daysInMonth,
    parseDateKey,
    toDateKey,
} from '@/widgets/economy/utils/calendarDateKeys';

describe('calendarDateKeys', () => {
    it('parseDateKey는 월을 0-index로 돌려준다', () => {
        expect(parseDateKey('2026-06-20')).toEqual({
            year: 2026,
            month: 5,
            day: 20,
        });
    });

    it('dayOfWeekFromKey는 시스템 TZ와 무관한 요일(0=일)', () => {
        expect(dayOfWeekFromKey('2026-06-21')).toBe(0);
        expect(dayOfWeekFromKey('2026-06-20')).toBe(6);
    });

    it('daysInMonth는 윤년 2월을 센다', () => {
        expect(daysInMonth(2028, 1)).toBe(29);
        expect(daysInMonth(2026, 1)).toBe(28);
        expect(daysInMonth(2026, 11)).toBe(31);
    });

    it('toDateKey는 두 자리로 채운다', () => {
        expect(toDateKey(2026, 0, 5)).toBe('2026-01-05');
    });
});
