import {
    displayEventLabel,
    kstDayOfWeekLabel,
    monthLabel,
    weekdayLabels,
} from '@/widgets/economy/utils/calendarLabels';

describe('calendarLabels', () => {
    it('weekdayLabels는 일요일부터 7개를 로케일로 낸다', () => {
        expect(weekdayLabels('ko')).toEqual([
            '일',
            '월',
            '화',
            '수',
            '목',
            '금',
            '토',
        ]);
        expect(weekdayLabels('en')[0]).toBe('Sun');
    });

    it('monthLabel은 로케일 월 이름(0-index)', () => {
        expect(monthLabel('ko', 5)).toBe('6월');
        expect(monthLabel('en', 5)).toBe('June');
    });

    it('kstDayOfWeekLabel은 날짜 키의 요일 이름', () => {
        expect(kstDayOfWeekLabel('2026-06-20', 'ko')).toBe('토');
    });

    describe('displayEventLabel', () => {
        it('맵에 있으면 표시명, 없으면 원문', () => {
            expect(displayEventLabel('CPI', { CPI: '소비자물가' })).toBe(
                '소비자물가'
            );
            expect(displayEventLabel('PPI', { CPI: '소비자물가' })).toBe('PPI');
        });

        it('Object.prototype 이름은 원문으로 둔다', () => {
            expect(displayEventLabel('toString', {})).toBe('toString');
        });
    });
});
