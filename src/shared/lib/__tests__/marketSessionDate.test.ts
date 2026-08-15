import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    lastClosedSessionCloseUtc,
    lastClosedSessionDateEt,
} from '@/shared/lib/marketSessionDate';

/**
 * `lastClosedSessionDateEt`의 DST·주말·발행버퍼 경계 스위트.
 * `CachedMarketDataProvider`에서 순수 모듈(`shared/lib/marketSessionDate`)로 추출되며
 * 함께 이동했다 — 이제 bars EOD 캐시 키, 시장 공포·탐욕 fetch 경계, sitemap lastmod
 * 세 소비자가 이 함수를 공유하므로 provider 테스트에 묶여 있을 이유가 없다.
 */
describe('lastClosedSessionDateEt — DST-aware key boundary', () => {
    afterEach(() => vi.useRealTimers());

    /**
     * Summer (EDT = UTC-4): market closes at 16:00 ET = 20:00 UTC
     * Winter (EST = UTC-5): market closes at 16:00 ET = 21:00 UTC
     */

    it('summer weekday DURING session (Mon 09:40 EDT = 13:40 UTC) → lastClosed = prev Friday', () => {
        // 2026-07-13 Monday 13:40Z = 09:40 EDT (summer, before 20:00Z close)
        const result = lastClosedSessionDateEt(
            new Date('2026-07-13T13:40:00Z')
        );
        // Previous Friday
        expect(result).toBe('2026-07-10');
    });

    it('summer weekday AFTER close but WITHIN buffer (Mon 16:30 EDT = 20:30 UTC) → lastClosed = prev Friday', () => {
        // 2026-07-13 Monday 20:30Z = 16:30 EDT (summer, after close but within 4h buffer)
        // Buffer ends at 20:00 ET = 00:00 UTC Tue 7/14. Still within buffer → prev trading day.
        const result = lastClosedSessionDateEt(
            new Date('2026-07-13T20:30:00Z')
        );
        expect(result).toBe('2026-07-10');
    });

    it('summer weekday AFTER close+buffer (Mon 20:30 EDT = 00:30 UTC Tue) → lastClosed = today (7/13)', () => {
        // 2026-07-14 00:30Z = 20:30 EDT Mon 7/13 (after close + 4h buffer)
        const result = lastClosedSessionDateEt(
            new Date('2026-07-14T00:30:00Z')
        );
        expect(result).toBe('2026-07-13');
    });

    it('just after Friday close (Fri 16:01 EDT = 20:01 UTC) → lastClosed = prev Thursday (within buffer)', () => {
        // 2026-07-10 Friday 20:01Z = 16:01 EDT (summer, within 4h buffer)
        // Buffer ends at 20:00 ET = 00:00 UTC Sat 7/11. Still within buffer → prev trading day.
        const result = lastClosedSessionDateEt(
            new Date('2026-07-10T20:01:00Z')
        );
        expect(result).toBe('2026-07-09');
    });

    it('Saturday (after Fri close) → lastClosed = Friday', () => {
        // 2026-07-11 Saturday 12:00Z
        const result = lastClosedSessionDateEt(
            new Date('2026-07-11T12:00:00Z')
        );
        expect(result).toBe('2026-07-10');
    });

    it('Sunday → lastClosed = previous Friday', () => {
        // 2026-07-12 Sunday 12:00Z
        const result = lastClosedSessionDateEt(
            new Date('2026-07-12T12:00:00Z')
        );
        expect(result).toBe('2026-07-10');
    });

    it('winter (EST) after close but WITHIN buffer (Mon 16:30 EST = 21:30 UTC) → lastClosed = prev Friday', () => {
        // 2026-01-12 Monday 21:30Z = 16:30 EST (winter, after close but within 4h buffer)
        // Buffer ends at 20:00 ET = 01:00 UTC Tue 1/13. Still within buffer → prev trading day.
        const result = lastClosedSessionDateEt(
            new Date('2026-01-12T21:30:00Z')
        );
        expect(result).toBe('2026-01-09');
    });

    it('winter (EST) after close+buffer (Mon 20:30 EST = 01:30 UTC Tue) → lastClosed = today (1/12)', () => {
        // 2026-01-13 01:30Z = 20:30 EST Mon 1/12 (after close + 4h buffer)
        const result = lastClosedSessionDateEt(
            new Date('2026-01-13T01:30:00Z')
        );
        expect(result).toBe('2026-01-12');
    });

    it('winter (EST) BEFORE close (Mon 15:30 EST = 20:30 UTC) → lastClosed = prev Friday', () => {
        // 2026-01-12 Monday 20:30Z = 15:30 EST (winter, before 21:00Z close)
        // This proves DST: 20:30 UTC is after close in summer but BEFORE close in winter
        const result = lastClosedSessionDateEt(
            new Date('2026-01-12T20:30:00Z')
        );
        expect(result).toBe('2026-01-09');
    });

    // ── EOD publish buffer boundary tests ────────────────────────────────
    // close=16:00 ET, buffer=4h → roll only at 20:00 ET
    it('[buffer] summer: 16:30 EDT (within buffer) → lastClosed = prev trading day (7/10)', () => {
        // 2026-07-13 Mon 20:30Z = 16:30 EDT — after close but before buffer end (20:00 ET = 00:00 UTC Tue)
        expect(lastClosedSessionDateEt(new Date('2026-07-13T20:30:00Z'))).toBe(
            '2026-07-10'
        );
    });

    it('[buffer] summer: 20:30 EDT (after buffer) → lastClosed = today (7/13)', () => {
        // 2026-07-14 00:30Z = 20:30 EDT Mon 7/13 — past close+buffer
        expect(lastClosedSessionDateEt(new Date('2026-07-14T00:30:00Z'))).toBe(
            '2026-07-13'
        );
    });

    it('[buffer] summer during session: 09:40 EDT (7/13) → lastClosed = prev Friday (7/10)', () => {
        // 2026-07-13 Mon 13:40Z = 09:40 EDT — during regular session, not yet closed
        expect(lastClosedSessionDateEt(new Date('2026-07-13T13:40:00Z'))).toBe(
            '2026-07-10'
        );
    });

    it('[buffer] winter: 16:30 EST (within buffer) → lastClosed = prev Friday (1/09)', () => {
        // 2026-01-12 Mon 21:30Z = 16:30 EST — after close but within buffer (buffer ends 01:00 UTC Tue)
        expect(lastClosedSessionDateEt(new Date('2026-01-12T21:30:00Z'))).toBe(
            '2026-01-09'
        );
    });

    it('[buffer] winter: 20:30 EST (after buffer) → lastClosed = today (1/12)', () => {
        // 2026-01-13 01:30Z = 20:30 EST Mon 1/12 — past close+buffer
        expect(lastClosedSessionDateEt(new Date('2026-01-13T01:30:00Z'))).toBe(
            '2026-01-12'
        );
    });
});

/**
 * `lastClosedSessionCloseUtc` — 위 세션 날짜에 그 날짜의 ET 오프셋을 적용한 마감 순간.
 * sitemap `lastmod`가 쓰는 값이라, 주말·DST가 실제로 반영되는지 못박는다.
 */
describe('lastClosedSessionCloseUtc', () => {
    it('여름(EDT) 세션은 20:00 UTC 마감으로 나온다', () => {
        // 2026-07-14 00:30Z = 20:30 EDT Mon 7/13 (마감+버퍼 경과) → 세션 7/13
        expect(
            lastClosedSessionCloseUtc(
                new Date('2026-07-14T00:30:00Z')
            ).toISOString()
        ).toBe('2026-07-13T20:00:00.000Z');
    });

    it('겨울(EST) 세션은 21:00 UTC 마감으로 나온다', () => {
        // 2026-01-13 01:30Z = 20:30 EST Mon 1/12 (마감+버퍼 경과) → 세션 1/12
        expect(
            lastClosedSessionCloseUtc(
                new Date('2026-01-13T01:30:00Z')
            ).toISOString()
        ).toBe('2026-01-12T21:00:00.000Z');
    });

    it('토요일 늦은 시각에도 열리지 않은 토요일 마감을 만들지 않는다 (직전 금요일)', () => {
        // 회귀 가드: 예전 buildPopularEntries는 토 20:00 UTC 이후 크롤되면
        // "토요일 20:00 UTC"를 lastmod로 발행했다 — 장이 열리지도 않은 날이다.
        const sat = lastClosedSessionCloseUtc(new Date('2026-07-11T23:00:00Z'));
        expect(sat.toISOString()).toBe('2026-07-10T20:00:00.000Z');
        expect(sat.getUTCDay()).toBe(5); // Friday
    });

    it('일요일도 직전 금요일 마감으로 되감는다', () => {
        const sun = lastClosedSessionCloseUtc(new Date('2026-07-12T23:00:00Z'));
        expect(sun.getUTCDay()).toBe(5);
        expect(sun.toISOString()).toBe('2026-07-10T20:00:00.000Z');
    });

    it('같은 세션 안에서는 호출 시각이 달라도 같은 값을 준다 (슬라이딩 아님)', () => {
        const a = lastClosedSessionCloseUtc(new Date('2026-07-11T00:05:00Z'));
        const b = lastClosedSessionCloseUtc(new Date('2026-07-11T23:55:00Z'));
        expect(a.getTime()).toBe(b.getTime());
    });
});
