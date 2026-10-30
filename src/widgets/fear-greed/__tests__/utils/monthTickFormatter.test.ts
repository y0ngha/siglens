import { TickMarkType, type Time } from 'lightweight-charts';
import { monthTickFormatter } from '../../utils/monthTickFormatter';

const TIME = '2026-10-05' as Time;

describe('monthTickFormatter', () => {
    it('일(day) 눈금은 빈 문자열로 지운다', () => {
        expect(monthTickFormatter(TIME, TickMarkType.DayOfMonth)).toBe('');
    });

    it('월 눈금은 기본 포맷에 맡긴다(null)', () => {
        expect(monthTickFormatter(TIME, TickMarkType.Month)).toBeNull();
    });

    it('연 눈금은 기본 포맷에 맡긴다(null)', () => {
        expect(monthTickFormatter(TIME, TickMarkType.Year)).toBeNull();
    });
});
