import { describe, expect, it } from 'vitest';
import { calendarChangeView } from '@/app/api/ai/chat/tools/calendarChange';

describe('calendarChangeView', () => {
    const bar = (date: string, close: number) => ({
        time: Date.parse(`${date}T00:00:00Z`) / 1000,
        open: 1,
        high: 1,
        low: 1,
        close,
        volume: 1,
    });

    it('기준은 시작일 당일 또는 그 직전 세션이고 pct는 2자리로 반올림된다', () => {
        // 마지막 2026-10-19 → 1개월 전 09-19(토)은 직전 세션 09-18, 3개월 전 07-19(일)은 07-17, 1년 전 2025-10-19(일)은 2025-10-17.
        const bars = [
            bar('2025-10-17', 90),
            bar('2025-10-20', 91),
            bar('2026-07-17', 120),
            bar('2026-07-20', 121),
            bar('2026-09-18', 140),
            bar('2026-09-21', 141),
            bar('2026-10-19', 150),
        ];
        // 150/140 = +7.142857…% → 7.14, 150/120 = +25%, 150/90 = +66.666…% → 66.67
        expect(calendarChangeView(bars)).toEqual({
            '1month': { baseDate: '2026-09-18', baseClose: 140, pct: 7.14 },
            '3months': { baseDate: '2026-07-17', baseClose: 120, pct: 25 },
            '1year': { baseDate: '2025-10-17', baseClose: 90, pct: 66.67 },
        });
    });

    it('말일은 짧은 달로 눌러 기준일을 잡는다', () => {
        // 마지막 2026-03-31 − 1개월 = 02-28(3월 말일이 2월에 없어 눌린 날짜). 합성 봉이 그 날짜 당일에 있다.
        const bars = [bar('2026-02-28', 100), bar('2026-03-31', 110)];
        expect(calendarChangeView(bars)['1month']).toEqual({
            baseDate: '2026-02-28',
            baseClose: 100,
            pct: 10,
        });
    });

    it('시리즈가 거기까지 거슬러 가지 않은 기간은 null이다', () => {
        const bars = [bar('2026-09-18', 140), bar('2026-10-19', 150)];
        const view = calendarChangeView(bars);
        expect(view['1month']).not.toBeNull();
        expect(view['3months']).toBeNull();
        expect(view['1year']).toBeNull();
    });

    it('봉이 없으면 세 기간 모두 null이다', () => {
        expect(calendarChangeView([])).toEqual({
            '1month': null,
            '3months': null,
            '1year': null,
        });
    });
});
