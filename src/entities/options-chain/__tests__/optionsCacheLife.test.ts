/**
 * Unit tests for getOptionsCacheLifeProfile.
 *
 * Test dates are chosen to be far from DST transitions to keep results stable
 * year-round. EDT (UTC-4) examples use May dates; EST (UTC-5) examples use
 * January dates.
 *
 * America/New_York DST transitions in 2026:
 *   - Spring forward: 2026-03-08 02:00 → 03:00 (EDT begins, UTC-4)
 *   - Fall back:      2026-11-01 02:00 → 01:00 (EST begins, UTC-5)
 */

import { getOptionsCacheLifeProfile } from '../lib/optionsCacheLife';

describe('getOptionsCacheLifeProfile — weekend', () => {
    it('returns options-weekend for Saturday (EDT)', () => {
        // 2026-05-16 is a Saturday. 10:00 EDT = 14:00 UTC.
        const sat = new Date('2026-05-16T14:00:00Z');
        expect(getOptionsCacheLifeProfile(sat)).toBe('options-weekend');
    });

    it('returns options-weekend for Sunday (EDT)', () => {
        // 2026-05-17 is a Sunday. 10:00 EDT = 14:00 UTC.
        const sun = new Date('2026-05-17T14:00:00Z');
        expect(getOptionsCacheLifeProfile(sun)).toBe('options-weekend');
    });

    it('returns options-weekend for Saturday (EST)', () => {
        // 2026-01-17 is a Saturday. 10:00 EST = 15:00 UTC.
        const sat = new Date('2026-01-17T15:00:00Z');
        expect(getOptionsCacheLifeProfile(sat)).toBe('options-weekend');
    });

    it('returns options-weekend for Sunday (EST)', () => {
        // 2026-01-18 is a Sunday. 10:00 EST = 15:00 UTC.
        const sun = new Date('2026-01-18T15:00:00Z');
        expect(getOptionsCacheLifeProfile(sun)).toBe('options-weekend');
    });
});

describe('getOptionsCacheLifeProfile — market open (EDT)', () => {
    it('returns options-market-open at 09:30 ET (opening boundary, EDT)', () => {
        // 2026-05-14 Thu. 09:30 EDT = 13:30 UTC.
        const date = new Date('2026-05-14T13:30:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-open');
    });

    it('returns options-market-open at 12:00 ET (midday / lunch, EDT)', () => {
        // 2026-05-14 Thu. 12:00 EDT = 16:00 UTC.
        const date = new Date('2026-05-14T16:00:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-open');
    });
});

describe('getOptionsCacheLifeProfile — market open (EST)', () => {
    it('returns options-market-open at 09:30 ET (opening boundary, EST)', () => {
        // 2026-01-14 Wed. 09:30 EST = 14:30 UTC.
        const date = new Date('2026-01-14T14:30:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-open');
    });

    it('returns options-market-open at 12:00 ET (midday / lunch, EST)', () => {
        // 2026-01-14 Wed. 12:00 EST = 17:00 UTC.
        const date = new Date('2026-01-14T17:00:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-open');
    });
});

describe('getOptionsCacheLifeProfile — market closed', () => {
    it('returns options-market-closed at 09:29 ET (just before open, EDT)', () => {
        // 2026-05-14 Thu. 09:29 EDT = 13:29 UTC.
        const date = new Date('2026-05-14T13:29:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-closed');
    });

    it('returns options-market-closed at 16:00 ET (closing boundary exclusive, EDT)', () => {
        // 2026-05-14 Thu. 16:00 EDT = 20:00 UTC. 마감 정각은 closed (exclusive).
        const date = new Date('2026-05-14T20:00:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-closed');
    });

    it('returns options-market-closed at 03:00 ET (pre-market, EDT)', () => {
        // 2026-05-14 Thu. 03:00 EDT = 07:00 UTC.
        const date = new Date('2026-05-14T07:00:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-closed');
    });

    it('returns options-market-closed at 09:29 ET (just before open, EST)', () => {
        // 2026-01-14 Wed. 09:29 EST = 14:29 UTC.
        const date = new Date('2026-01-14T14:29:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-closed');
    });

    it('returns options-market-closed at 16:00 ET (closing boundary exclusive, EST)', () => {
        // 2026-01-14 Wed. 16:00 EST = 21:00 UTC. 마감 정각은 closed (exclusive).
        const date = new Date('2026-01-14T21:00:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-closed');
    });

    it('returns options-market-closed at 03:00 ET (pre-market, EST)', () => {
        // 2026-01-14 Wed. 03:00 EST = 08:00 UTC.
        const date = new Date('2026-01-14T08:00:00Z');
        expect(getOptionsCacheLifeProfile(date)).toBe('options-market-closed');
    });
});

describe('getOptionsCacheLifeProfile — default parameter', () => {
    it('returns a valid profile string when called with no arguments', () => {
        const validProfiles = [
            'options-market-open',
            'options-market-closed',
            'options-weekend',
        ];
        const result = getOptionsCacheLifeProfile();
        expect(validProfiles).toContain(result);
    });
});

/**
 * NYSE 휴장일은 토요일과 같은 상황이다 — Yahoo가 다음 개장까지 새 스냅샷을 내지 않는다.
 * 30분짜리 `options-market-closed`로 떨어지면 같은 데이터를 하루 ~48회 다시 가져오고,
 * 그 TTL은 Redis TTL(`optionsDataCache`)로도 직접 쓰인다.
 */
describe('getOptionsCacheLifeProfile — NYSE 휴장일/반장', () => {
    it('추수감사절 장중 시각도 weekend 프로파일로 떨어진다', () => {
        // 2026-11-26 15:00Z = 10:00 EST — 평소라면 정규장 한복판.
        expect(
            getOptionsCacheLifeProfile(new Date('2026-11-26T15:00:00Z'))
        ).toBe('options-weekend');
    });

    it('성금요일(2026-04-03)도 weekend 프로파일', () => {
        expect(
            getOptionsCacheLifeProfile(new Date('2026-04-03T15:00:00Z'))
        ).toBe('options-weekend');
    });

    it('반장일 13:00 ET 이후는 closed — open이 아니다', () => {
        // 11/27 18:05Z = 13:05 EST.
        expect(
            getOptionsCacheLifeProfile(new Date('2026-11-27T18:05:00Z'))
        ).toBe('options-market-closed');
        // 12:50 EST는 아직 개장.
        expect(
            getOptionsCacheLifeProfile(new Date('2026-11-27T17:50:00Z'))
        ).toBe('options-market-open');
    });
});
