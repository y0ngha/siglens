import { describe, expect, it } from 'vitest';
import { withUpcomingEarningsDate } from '@/entities/earnings-report/lib/withUpcomingEarningsDate';

describe('withUpcomingEarningsDate', () => {
    const DATES = ['2026-05-20', '2026-08-26', '2026-11-20'];

    it('DB의 예정일(투영)을 대조된 다음 실적일로 바꾸고 오름차순을 지킨다', () => {
        expect(
            withUpcomingEarningsDate(DATES, '2026-11-19', '2026-11-16')
        ).toEqual(['2026-05-20', '2026-08-26', '2026-11-19']);
    });

    it('다음 실적일이 이미 목록에 있으면 한 번만 싣는다', () => {
        expect(
            withUpcomingEarningsDate(DATES, '2026-11-20', '2026-11-16')
        ).toEqual(DATES);
    });

    it('다음 실적이 없으면 목록 그대로다', () => {
        expect(withUpcomingEarningsDate(DATES, null, '2026-11-16')).toBe(DATES);
    });
});
