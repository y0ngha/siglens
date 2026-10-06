import { describe, expect, it } from 'vitest';
import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import {
    lastClosedSessionCloseUtc,
    lastClosedSessionDate,
    sessionCloseUtcOnDate,
} from '../marketSessionDate';

/**
 * 공포·탐욕 탭 `dateModified`(마지막 점수 봉의 마감)와 sitemap `lastmod`(직전 마감 세션의
 * 마감)는 **같은 정의**여야 한다 — 마지막 점수 봉이 직전 마감 세션이면 같은 순간이다.
 */
describe('sessionCloseUtcOnDate', () => {
    it('US 서머타임(EDT)은 20:00Z, 표준시(EST)는 21:00Z', () => {
        expect(
            sessionCloseUtcOnDate(US_EQUITY_SESSION, '2026-10-02').toISOString()
        ).toBe('2026-10-02T20:00:00.000Z');
        expect(
            sessionCloseUtcOnDate(US_EQUITY_SESSION, '2026-12-02').toISOString()
        ).toBe('2026-12-02T21:00:00.000Z');
    });

    it('KR은 15:30 KST = 06:30Z', () => {
        expect(
            sessionCloseUtcOnDate(KR_EQUITY_SESSION, '2026-10-02').toISOString()
        ).toBe('2026-10-02T06:30:00.000Z');
    });

    it('US 반장(추수감사절 다음날)은 13:00 ET', () => {
        expect(
            sessionCloseUtcOnDate(US_EQUITY_SESSION, '2026-11-27').toISOString()
        ).toBe('2026-11-27T18:00:00.000Z');
    });

    it('크립토는 그 UTC 일봉이 끝나는 순간(다음 UTC 자정)', () => {
        expect(
            sessionCloseUtcOnDate(CRYPTO_SESSION, '2026-10-02').toISOString()
        ).toBe('2026-10-03T00:00:00.000Z');
    });

    it.each([
        [
            'US 장중이 아닌 평일 저녁(EDT)',
            US_EQUITY_SESSION,
            '2026-10-05T03:00:00Z',
        ],
        ['US 표준시 평일', US_EQUITY_SESSION, '2026-12-03T03:00:00Z'],
        ['US 주말', US_EQUITY_SESSION, '2026-10-04T12:00:00Z'],
        ['US 반장 다음 날', US_EQUITY_SESSION, '2026-11-28T12:00:00Z'],
        ['KR 평일 저녁', KR_EQUITY_SESSION, '2026-10-02T12:00:00Z'],
        ['KR 주말', KR_EQUITY_SESSION, '2026-10-04T12:00:00Z'],
    ] as const)('sitemap todayClose와 동일성: %s', (_name, spec, nowIso) => {
        const now = new Date(nowIso);
        expect(
            sessionCloseUtcOnDate(
                spec,
                lastClosedSessionDate(spec, now)
            ).toISOString()
        ).toBe(lastClosedSessionCloseUtc(spec, now).toISOString());
    });
});
