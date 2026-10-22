import { describe, expect, it } from 'vitest';
import {
    chunkRows,
    selectStaleSchedules,
    type UpcomingEarningsRow,
} from '../staleEarningsSchedules';

const row = (
    symbol: string,
    earningsDate: string,
    fetchedAt: string
): UpcomingEarningsRow => ({
    symbol,
    earningsDate,
    fetchedAt: new Date(fetchedAt),
});

describe('selectStaleSchedules', () => {
    it('옮겨진 예정일: 더 먼저 받아 온 미래 행을 옛 예정일로 고른다 (COP 10-29 → 11-05)', () => {
        const oldRow = row('COP', '2026-10-29', '2026-08-09T01:00:00Z');
        const result = selectStaleSchedules([
            oldRow,
            row('COP', '2026-11-05', '2026-10-21T01:00:00Z'),
        ]);

        expect(result.stale).toEqual([oldRow]);
        expect(result.symbolsAffected).toBe(1);
        expect(result.symbolsWithMultiple).toBe(1);
        expect(result.scannedRows).toBe(2);
    });

    it('같은 갱신(같은 fetched_at)에 든 미래 행 여럿은 모두 남긴다', () => {
        const result = selectStaleSchedules([
            row('AAPL', '2026-10-30', '2026-10-21T01:00:00Z'),
            row('AAPL', '2027-01-29', '2026-10-21T01:00:00Z'),
        ]);

        expect(result.stale).toEqual([]);
        expect(result.symbolsAffected).toBe(0);
        expect(result.symbolsWithMultiple).toBe(1);
    });

    it('미래 행이 하나뿐인 심볼은 오래 묵었어도 지우지 않는다 (대체 일정 없음)', () => {
        const result = selectStaleSchedules([
            row('XOM', '2026-10-31', '2026-06-01T01:00:00Z'),
        ]);

        expect(result.stale).toEqual([]);
        expect(result.symbolsWithMultiple).toBe(0);
    });

    it('심볼끼리 섞지 않는다 — 다른 심볼의 최신 fetched_at으로 판정하지 않는다', () => {
        const result = selectStaleSchedules([
            row('A', '2026-11-01', '2026-08-01T00:00:00Z'),
            row('B', '2026-11-02', '2026-10-21T00:00:00Z'),
            row('B', '2026-11-09', '2026-10-21T00:00:00Z'),
        ]);

        expect(result.stale).toEqual([]);
    });
});

describe('chunkRows', () => {
    it('size 단위로 나누고 나머지를 마지막 청크에 둔다', () => {
        expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunkRows([], 2)).toEqual([]);
    });
});
