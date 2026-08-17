import { describe, expect, it } from 'vitest';
import { getEasternOffsetHours } from '@/shared/lib/eastern';
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

    it('마감 정확히 +30분(버퍼 경계) 시점 → 해당 마감을 완료로 본다(>= 경계)', () => {
        // EDT 평일: close=20:00 UTC, buffer=30min → 20:30:00 UTC 정각.
        expect(
            lastCompletedEtCloseWithBuffer(new Date('2026-07-24T20:30:00Z'))
        ).toEqual(new Date('2026-07-24T20:00:00Z'));
    });

    it('DST 전환일(3월 둘째 일요일, spring-forward) 이후 조회해도 직전 평일(금) 마감을 EST 오프셋으로 정확히 계산한다', () => {
        // 2026-03-08(일)이 spring-forward 전환일. getEasternOffsetHours가 그 날짜
        // 자정 기준 EST(-5)를 반환함을 먼저 확인해 ground truth를 확보한다.
        expect(getEasternOffsetHours(new Date('2026-03-08T00:00:00Z'))).toBe(
            -5
        );
        // 일요일 정오에 조회하면 주말(일/토)을 건너뛰고 금요일(3/6) 마감으로 떨어져야 한다.
        expect(
            lastCompletedEtCloseWithBuffer(new Date('2026-03-08T12:00:00Z'))
        ).toEqual(new Date('2026-03-06T21:00:00Z'));
    });

    it('DST 전환일(11월 첫째 일요일, fall-back) 이후 조회해도 직전 평일(금) 마감을 EDT 오프셋으로 정확히 계산한다', () => {
        // 2026-11-01(일)이 fall-back 전환일. 전환은 그 날 06:00 UTC에 일어나므로
        // 자정(00:00 UTC) 기준으로는 아직 EDT(-4) 구간임을 getEasternOffsetHours로 확인한다.
        expect(getEasternOffsetHours(new Date('2026-11-01T00:00:00Z'))).toBe(
            -4
        );
        // 일요일 정오에 조회하면 주말을 건너뛰고 금요일(10/30) 마감으로 떨어져야 한다.
        expect(
            lastCompletedEtCloseWithBuffer(new Date('2026-11-01T12:00:00Z'))
        ).toEqual(new Date('2026-10-30T20:00:00Z'));
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

/**
 * NYSE 캘린더 회귀 가드.
 *
 * 휴장일에 경계가 그날 16:00 ET로 롤하면 **전 코퍼스**(심볼×탭 ≈ 1,900유닛)가 한꺼번에
 * stale로 뒤집혀 LLM 재생성이 돈다. 주말은 경계가 금요일에 고정돼 no-op이라 이 결함이
 * 드러나지 않았고, prewarm cron에는 요일 필터가 없어 연 9회 그대로 태워 왔다.
 */
describe('lastCompletedEtCloseWithBuffer — 휴장일/반장', () => {
    it('추수감사절(2026-11-26) 밤에는 경계가 직전 거래일(11/25) 마감에 머문다', () => {
        // 2026-11-27 02:00Z = 11/26 21:00 EST — 정규 마감+30분을 한참 넘긴 시각.
        expect(
            lastCompletedEtCloseWithBuffer(
                new Date('2026-11-27T02:00:00Z')
            ).toISOString()
        ).toBe('2026-11-25T21:00:00.000Z');
    });

    it('반장(2026-11-27)은 13:30 ET에 경계가 롤한다 — 16:30이 아니다', () => {
        // 11/27 18:35Z = 13:35 EST — 반장 마감(13:00)+30분 경과.
        expect(
            lastCompletedEtCloseWithBuffer(
                new Date('2026-11-27T18:35:00Z')
            ).toISOString()
        ).toBe('2026-11-27T18:00:00.000Z');
        // 마감 직후 정착 버퍼 안에서는 아직 직전 거래일(11/25)이다.
        expect(
            lastCompletedEtCloseWithBuffer(
                new Date('2026-11-27T18:10:00Z')
            ).toISOString()
        ).toBe('2026-11-25T21:00:00.000Z');
    });

    it('평일 정규 마감+30분은 종전대로 당일로 롤한다', () => {
        // 2026-11-25(수) 21:35Z = 16:35 EST.
        expect(
            lastCompletedEtCloseWithBuffer(
                new Date('2026-11-25T21:35:00Z')
            ).toISOString()
        ).toBe('2026-11-25T21:00:00.000Z');
    });
});
