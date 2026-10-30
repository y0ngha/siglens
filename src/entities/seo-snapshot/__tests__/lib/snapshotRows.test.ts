import { describe, it, expect } from 'vitest';
import {
    filterWithinMaxAge,
    rehydrateSnapshots,
} from '@/entities/seo-snapshot/lib/snapshotRows';
import {
    SNAPSHOT_MAX_AGE_MS,
    type SeoAnalysisSnapshot,
} from '@/entities/seo-snapshot/model';

const NOW = new Date('2026-07-25T12:00:00.000Z');

function snapshot(
    overrides: Partial<SeoAnalysisSnapshot> = {}
): SeoAnalysisSnapshot {
    return {
        symbol: 'AAPL',
        tab: 'technical',
        locale: 'ko',
        content: {},
        plain: null,
        model: 'm',
        generatedAt: NOW,
        firstGeneratedAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}

describe('filterWithinMaxAge', () => {
    it('keeps a row exactly at the cutoff', () => {
        const row = snapshot({
            generatedAt: new Date(NOW.getTime() - SNAPSHOT_MAX_AGE_MS),
        });
        expect(filterWithinMaxAge([row], NOW.getTime())).toEqual([row]);
    });

    it('drops a row one millisecond older than the cutoff', () => {
        const row = snapshot({
            generatedAt: new Date(NOW.getTime() - SNAPSHOT_MAX_AGE_MS - 1),
        });
        expect(filterWithinMaxAge([row], NOW.getTime())).toEqual([]);
    });
});

describe('rehydrateSnapshots', () => {
    it('revives ISO strings left by the cache JSON round-trip into Dates', () => {
        const cached = JSON.parse(JSON.stringify([snapshot()]));

        const { snapshots, invalidCount } = rehydrateSnapshots(cached);

        expect(snapshots[0]?.generatedAt).toEqual(NOW);
        expect(snapshots[0]?.updatedAt).toEqual(NOW);
        expect(snapshots[0]?.firstGeneratedAt).toEqual(NOW);
        expect(invalidCount).toBe(0);
    });

    it('keeps a null firstGeneratedAt null', () => {
        const { snapshots } = rehydrateSnapshots([
            snapshot({ firstGeneratedAt: null }),
        ]);
        expect(snapshots[0]?.firstGeneratedAt).toBeNull();
    });

    it('treats a missing firstGeneratedAt (entry cached before the column existed) as null', () => {
        const legacy: Record<string, unknown> = { ...snapshot() };
        delete legacy.firstGeneratedAt;
        const cached = JSON.parse(JSON.stringify([legacy]));

        const { snapshots } = rehydrateSnapshots(cached);

        expect(snapshots[0]?.firstGeneratedAt).toBeNull();
    });

    it('drops rows whose generatedAt revives to an Invalid Date and counts them', () => {
        const cached = JSON.parse(
            JSON.stringify([snapshot(), snapshot({ tab: 'news' })])
        );
        cached[1].generatedAt = 'not-a-date';

        const { snapshots, invalidCount } = rehydrateSnapshots(cached);

        expect(snapshots.map(row => row.tab)).toEqual(['technical']);
        expect(invalidCount).toBe(1);
    });
});
