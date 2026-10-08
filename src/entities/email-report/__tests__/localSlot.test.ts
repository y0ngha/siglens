import { isDueAt, toLocalSlot } from '@/entities/email-report/lib/localSlot';
import { weekdaysToMask } from '@/entities/email-report/lib/weekdayMask';

describe('toLocalSlot', () => {
    it('UTC 순간을 타임존 로컬 날짜·요일·시로 환산한다', () => {
        // 2026-10-04(일) 23:30 UTC = 2026-10-05(월) 08:30 KST
        expect(
            toLocalSlot(new Date('2026-10-04T23:30:00Z'), 'Asia/Seoul')
        ).toEqual({ localDate: '2026-10-05', weekday: 1, hour: 8 });
    });

    it('서머타임이 적용된 타임존을 반영한다', () => {
        // 2026-07-01 12:00 UTC = 08:00 EDT, 2026-12-01 12:00 UTC = 07:00 EST
        expect(
            toLocalSlot(new Date('2026-07-01T12:00:00Z'), 'America/New_York')
                ?.hour
        ).toBe(8);
        expect(
            toLocalSlot(new Date('2026-12-01T12:00:00Z'), 'America/New_York')
                ?.hour
        ).toBe(7);
    });

    it('자정은 0시로 돌려준다(24가 아니다)', () => {
        expect(
            toLocalSlot(new Date('2026-10-04T15:00:00Z'), 'Asia/Seoul')?.hour
        ).toBe(0);
    });

    it('알 수 없는 타임존이면 null이다', () => {
        expect(toLocalSlot(new Date(), 'Mars/Olympus')).toBeNull();
    });
});

describe('isDueAt', () => {
    const slot = { localDate: '2026-10-05', weekday: 1 as const, hour: 8 };

    it('요일과 시가 모두 맞으면 true', () => {
        expect(isDueAt(slot, weekdaysToMask([1, 4]), 8)).toBe(true);
    });

    it('요일이 다르면 false', () => {
        expect(isDueAt(slot, weekdaysToMask([2]), 8)).toBe(false);
    });

    it('시가 다르면 false', () => {
        expect(isDueAt(slot, weekdaysToMask([1]), 9)).toBe(false);
    });
});
