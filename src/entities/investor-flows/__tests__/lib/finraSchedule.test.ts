import { describe, expect, it } from 'vitest';
import {
    shortInterestCandidateGroups,
    shortVolumeCandidateDates,
} from '../../lib/finraSchedule';

describe('shortVolumeCandidateDates', () => {
    it('lists weekdays after the last stored date up to today, ascending', () => {
        // Fri 2026-10-09 stored; Mon-Wed are candidates; Sat/Sun excluded
        expect(shortVolumeCandidateDates('2026-10-09', '2026-10-14')).toEqual([
            '2026-10-12',
            '2026-10-13',
            '2026-10-14',
        ]);
    });

    it('is empty when already up to date', () => {
        expect(shortVolumeCandidateDates('2026-10-14', '2026-10-14')).toEqual(
            []
        );
    });
});

describe('shortInterestCandidateGroups', () => {
    it('yields the 15th and month-end settlements, ascending', () => {
        const groups = shortInterestCandidateGroups('2026-10-15', 40);
        const primaries = groups.map(g => g[0]);
        // 2026-09-15 (Tue), 2026-09-30 (Wed), 2026-10-15 (Thu)
        expect(primaries).toEqual(['2026-09-15', '2026-09-30', '2026-10-15']);
    });

    it('moves a weekend 15th back to the preceding business day', () => {
        // 2026-08-15 is a Saturday -> Friday 2026-08-14; 2026-08-31 is Monday
        const primaries = shortInterestCandidateGroups('2026-09-01', 30).map(
            g => g[0]
        );
        expect(primaries).toContain('2026-08-14');
        expect(primaries).toContain('2026-08-31');
    });

    it('adds earlier weekday variants for holiday shifts', () => {
        const [group] = shortInterestCandidateGroups('2026-09-30', 1, 4);
        expect(group).toEqual([
            '2026-09-30',
            '2026-09-29',
            '2026-09-28',
            '2026-09-25',
        ]);
    });

    it('excludes settlements after today', () => {
        const primaries = shortInterestCandidateGroups('2026-10-10', 30).map(
            g => g[0]
        );
        expect(primaries).not.toContain('2026-10-15');
    });
});
