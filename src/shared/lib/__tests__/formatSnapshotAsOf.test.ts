import { describe, it, expect } from 'vitest';
import { formatSnapshotAsOf } from '../formatSnapshotAsOf';

describe('formatSnapshotAsOf', () => {
    it('미국 동부 기준 날짜를 한국어로 포맷한다', () => {
        // 2026-07-31T20:00:00Z = 2026-07-31 16:00 America/New_York (EDT, 장마감)
        expect(formatSnapshotAsOf(new Date('2026-07-31T20:00:00Z'))).toBe(
            '2026년 7월 31일'
        );
    });

    it('UTC 자정을 넘었어도 동부 기준 날짜를 쓴다', () => {
        // 2026-08-01T01:00:00Z = 2026-07-31 21:00 America/New_York
        expect(formatSnapshotAsOf(new Date('2026-08-01T01:00:00Z'))).toBe(
            '2026년 7월 31일'
        );
    });

    it('월 경계를 올바르게 넘긴다', () => {
        // 2026-08-01T13:00:00Z = 2026-08-01 09:00 America/New_York
        expect(formatSnapshotAsOf(new Date('2026-08-01T13:00:00Z'))).toBe(
            '2026년 8월 1일'
        );
    });

    it('같은 입력에 항상 같은 출력을 낸다 (ISR 캐시 결정성)', () => {
        const date = new Date('2026-07-31T20:00:00Z');
        expect(formatSnapshotAsOf(date)).toBe(formatSnapshotAsOf(date));
    });
});
