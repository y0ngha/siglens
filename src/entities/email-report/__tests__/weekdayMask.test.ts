import {
    maskToWeekdays,
    weekdaysToMask,
} from '@/entities/email-report/lib/weekdayMask';

describe('weekdaysToMask', () => {
    it('요일 n을 bit n으로 켠다', () => {
        expect(weekdaysToMask([0, 1, 6])).toBe(0b1000011);
    });

    it('빈 목록은 0이다', () => {
        expect(weekdaysToMask([])).toBe(0);
    });

    it('중복 요일은 한 번만 센다', () => {
        expect(weekdaysToMask([3, 3])).toBe(0b0001000);
    });
});

describe('maskToWeekdays', () => {
    it('켜진 비트를 오름차순 요일로 돌려준다', () => {
        expect(maskToWeekdays(0b1000011)).toEqual([0, 1, 6]);
    });

    it('0–6 밖의 비트는 무시한다', () => {
        expect(maskToWeekdays(0b10000010)).toEqual([1]);
    });

    it('weekdaysToMask와 왕복하면 정규화된 목록이 된다', () => {
        expect(maskToWeekdays(weekdaysToMask([5, 2, 5]))).toEqual([2, 5]);
    });
});
