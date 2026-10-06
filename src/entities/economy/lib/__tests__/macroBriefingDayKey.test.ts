import { describe, expect, it } from 'vitest';

import { macroBriefingDayKey } from '@/entities/economy/lib/macroBriefingDayKey';

describe('macroBriefingDayKey', () => {
    it('UTC 달력일을 YYYY-MM-DD로 돌려준다', () => {
        expect(macroBriefingDayKey(new Date('2026-10-05T13:45:00.000Z'))).toBe(
            '2026-10-05'
        );
    });

    it('같은 UTC 날짜 안에서는 시각과 무관하게 같은 키다', () => {
        expect(macroBriefingDayKey(new Date('2026-10-05T00:00:00.000Z'))).toBe(
            macroBriefingDayKey(new Date('2026-10-05T23:59:59.999Z'))
        );
    });

    it('UTC 자정을 넘기면 다음 날 키다 (KST 오전 9시 경계)', () => {
        expect(macroBriefingDayKey(new Date('2026-10-05T23:59:59.999Z'))).toBe(
            '2026-10-05'
        );
        expect(macroBriefingDayKey(new Date('2026-10-06T00:00:00.000Z'))).toBe(
            '2026-10-06'
        );
    });

    it('인자를 생략하면 현재 시각 기준이다', () => {
        expect(macroBriefingDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
