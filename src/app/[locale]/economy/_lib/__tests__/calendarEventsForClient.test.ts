import { describe, expect, it } from 'vitest';
import { calendarEventsForClient } from '@/app/[locale]/economy/_lib/calendarEventsForClient';

describe('calendarEventsForClient', () => {
    it('analyzedAt 키 자체를 떼고 나머지 필드는 그대로 둔다', () => {
        const [event] = calendarEventsForClient([
            {
                id: 'cpi-2026-10',
                summaryKo: '요약',
                analyzedAt: new Date('2026-10-29T00:00:00Z'),
            },
        ]);

        expect(event).toEqual({ id: 'cpi-2026-10', summaryKo: '요약' });
        expect(Object.hasOwn(event, 'analyzedAt')).toBe(false);
    });

    it('빈 목록은 빈 목록이다', () => {
        expect(calendarEventsForClient([])).toEqual([]);
    });
});
