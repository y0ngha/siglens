import { describe, expect, it } from 'vitest';
import { formatSnapshotDate } from '../../utils/snapshotDate';

describe('formatSnapshotDate', () => {
    it('미국 저녁(21:00 ET)에 조립한 스냅샷은 UTC로는 다음 날이어도 그 미국 장 날짜로 보인다', () => {
        // 2026-10-17T01:00:00Z = 2026-10-16 21:00 EDT
        expect(
            formatSnapshotDate('2026-10-17T01:00:00.000Z', 'us-equity')
        ).toBe('2026-10-16');
    });

    it('겨울(EST)에도 현지 날짜다', () => {
        // 2026-12-15T03:00:00Z = 2026-12-14 22:00 EST
        expect(
            formatSnapshotDate('2026-12-15T03:00:00.000Z', 'us-equity')
        ).toBe('2026-12-14');
    });

    it('미국 오전 스냅샷은 UTC 날짜와 같다', () => {
        expect(
            formatSnapshotDate('2026-10-16T15:00:00.000Z', 'us-equity')
        ).toBe('2026-10-16');
    });

    it('한국은 서울 날짜다 — UTC로는 전날 16:00이 서울 다음 날 01:00이다', () => {
        expect(
            formatSnapshotDate('2026-10-16T16:00:00.000Z', 'kr-equity')
        ).toBe('2026-10-17');
    });

    it('시각이 없는 날짜는 시간대로 옮기지 않고 그대로 낸다', () => {
        expect(formatSnapshotDate('2026-10-16', 'us-equity')).toBe(
            '2026-10-16'
        );
        expect(formatSnapshotDate('2026-10-16', 'kr-equity')).toBe(
            '2026-10-16'
        );
    });

    it('해석할 수 없는 값은 던지지 않고 앞 10자로 물러선다', () => {
        expect(formatSnapshotDate('not-a-date-at-all', 'us-equity')).toBe(
            'not-a-date'
        );
    });
});
