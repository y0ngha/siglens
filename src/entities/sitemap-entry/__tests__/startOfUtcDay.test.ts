import { startOfUtcDay } from '../lib/startOfUtcDay';

describe('startOfUtcDay', () => {
    it('같은 UTC 날짜의 자정으로 내린다', () => {
        expect(
            startOfUtcDay(new Date('2026-05-23T15:30:45.123Z')).toISOString()
        ).toBe('2026-05-23T00:00:00.000Z');
    });

    it('UTC 자정 직전(23:59:59.999Z)도 그날 자정이다', () => {
        expect(
            startOfUtcDay(new Date('2026-05-23T23:59:59.999Z')).toISOString()
        ).toBe('2026-05-23T00:00:00.000Z');
    });

    it('로컬 시간대가 아니라 UTC 날짜를 쓴다 — KST 아침 8시는 전날 UTC다', () => {
        expect(
            startOfUtcDay(new Date('2026-05-24T08:00:00+09:00')).toISOString()
        ).toBe('2026-05-23T00:00:00.000Z');
    });
});
