import { describe, expect, it } from 'vitest';
import {
    lastCompletedEtCloseWithBuffer,
    isSnapshotFresh,
} from '../lib/freshness';

describe('lastCompletedEtCloseWithBuffer', () => {
    it('EDT 평일 21:00 UTC → 같은 날 20:00 UTC 마감', () => {
        expect(
            lastCompletedEtCloseWithBuffer(new Date('2026-07-24T21:00:00Z'))
        ).toEqual(new Date('2026-07-24T20:00:00Z'));
    });
    it('EDT 평일 20:15 UTC (버퍼 미경과) → 전 거래일 마감', () => {
        expect(
            lastCompletedEtCloseWithBuffer(new Date('2026-07-24T20:15:00Z'))
        ).toEqual(new Date('2026-07-23T20:00:00Z'));
    });
    it('토요일 → 금요일 마감', () => {
        expect(
            lastCompletedEtCloseWithBuffer(new Date('2026-07-25T12:00:00Z'))
        ).toEqual(new Date('2026-07-24T20:00:00Z'));
    });
    it('월요일 아침(마감 전) → 금요일 마감', () => {
        expect(
            lastCompletedEtCloseWithBuffer(new Date('2026-07-27T13:00:00Z'))
        ).toEqual(new Date('2026-07-24T20:00:00Z'));
    });
    it('EST 평일 21:15 UTC (버퍼 미경과) → 전 거래일 21:00 UTC 마감', () => {
        expect(
            lastCompletedEtCloseWithBuffer(new Date('2026-01-13T21:15:00Z'))
        ).toEqual(new Date('2026-01-12T21:00:00Z'));
    });
    it('EST 평일 21:35 UTC (버퍼 경과) → 당일 21:00 UTC 마감', () => {
        expect(
            lastCompletedEtCloseWithBuffer(new Date('2026-01-13T21:35:00Z'))
        ).toEqual(new Date('2026-01-13T21:00:00Z'));
    });
});

describe('isSnapshotFresh', () => {
    const boundary = new Date('2026-07-24T20:00:00Z');
    it('경계 이후 생성 → fresh', () => {
        expect(
            isSnapshotFresh(new Date('2026-07-24T20:01:00Z'), boundary)
        ).toBe(true);
    });
    it('경계 정각 → fresh (>= 경계)', () => {
        expect(
            isSnapshotFresh(new Date('2026-07-24T20:00:00Z'), boundary)
        ).toBe(true);
    });
    it('경계 이전 → stale', () => {
        expect(
            isSnapshotFresh(new Date('2026-07-24T19:59:00Z'), boundary)
        ).toBe(false);
    });
    it('undefined → stale', () => {
        expect(isSnapshotFresh(undefined, boundary)).toBe(false);
    });
});
