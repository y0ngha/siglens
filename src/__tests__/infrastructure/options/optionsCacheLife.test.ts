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

import { getOptionsCacheLifeProfile } from '@/infrastructure/options/optionsCacheLife';

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

    it('returns options-market-open at 16:00 ET (closing boundary inclusive, EDT)', () => {
        // 2026-05-14 Thu. 16:00 EDT = 20:00 UTC.
        const date = new Date('2026-05-14T20:00:00Z');
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

    it('returns options-market-open at 16:00 ET (closing boundary inclusive, EST)', () => {
        // 2026-01-14 Wed. 16:00 EST = 21:00 UTC.
        const date = new Date('2026-01-14T21:00:00Z');
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

    it('returns options-market-closed at 16:01 ET (just after close, EDT)', () => {
        // 2026-05-14 Thu. 16:01 EDT = 20:01 UTC.
        const date = new Date('2026-05-14T20:01:00Z');
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

    it('returns options-market-closed at 16:01 ET (just after close, EST)', () => {
        // 2026-01-14 Wed. 16:01 EST = 21:01 UTC.
        const date = new Date('2026-01-14T21:01:00Z');
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
