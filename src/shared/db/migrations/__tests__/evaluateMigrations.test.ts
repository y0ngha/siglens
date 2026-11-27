import { describe, expect, it } from 'vitest';
import { evaluateMigrations } from '@/shared/db/migrations/evaluateMigrations';
import type {
    ExpectedMigration,
    MigrationPolicy,
} from '@/shared/db/migrations/types';

const mig = (tag: string, hash: string): ExpectedMigration => ({
    tag,
    when: 1,
    hash,
    sql: '',
});
const EXPECTED = [
    mig('0000_a', 'ha'),
    mig('0001_b', 'hb'),
    mig('0002_c', 'hc'),
];
const NO_POLICY: MigrationPolicy = { postDeployTags: [], legacyHashes: {} };

describe('evaluateMigrations', () => {
    it('reports nothing missing when every hash is applied', () => {
        expect(
            evaluateMigrations(EXPECTED, new Set(['ha', 'hb', 'hc']), NO_POLICY)
        ).toEqual({
            expected: 3,
            missing: [],
            postDeployPending: [],
            legacyMatched: [],
            unknownAppliedCount: 0,
        });
    });

    it('lists the tag whose hash is absent, in journal order', () => {
        const result = evaluateMigrations(EXPECTED, new Set(['hb']), NO_POLICY);
        expect(result.missing).toEqual(['0000_a', '0002_c']);
    });

    it('counts applied hashes unknown to the journal without failing', () => {
        const result = evaluateMigrations(
            EXPECTED,
            new Set(['ha', 'hb', 'hc', 'orphan1', 'orphan2']),
            NO_POLICY
        );
        expect(result.missing).toEqual([]);
        expect(result.unknownAppliedCount).toBe(2);
    });

    it('puts a post-deploy tag in postDeployPending, not missing', () => {
        const result = evaluateMigrations(EXPECTED, new Set(['ha', 'hb']), {
            postDeployTags: ['0002_c'],
            legacyHashes: {},
        });
        expect(result.missing).toEqual([]);
        expect(result.postDeployPending).toEqual(['0002_c']);
    });

    it('counts a legacy alias as applied and lists it in legacyMatched', () => {
        const result = evaluateMigrations(
            EXPECTED,
            new Set(['ha', 'old-hb', 'hc']),
            { postDeployTags: [], legacyHashes: { '0001_b': ['old-hb'] } }
        );
        expect(result.missing).toEqual([]);
        expect(result.legacyMatched).toEqual(['0001_b']);
        expect(result.unknownAppliedCount).toBe(0);
    });

    it('does not list a tag as legacy when its current hash is applied too', () => {
        const result = evaluateMigrations(
            EXPECTED,
            new Set(['ha', 'hb', 'hc', 'old-hb']),
            { postDeployTags: [], legacyHashes: { '0001_b': ['old-hb'] } }
        );
        expect(result.legacyMatched).toEqual([]);
    });

    it('keeps a tag missing when neither hash nor alias is applied', () => {
        const result = evaluateMigrations(EXPECTED, new Set(['ha', 'hc']), {
            postDeployTags: [],
            legacyHashes: { '0001_b': ['old-hb'] },
        });
        expect(result.missing).toEqual(['0001_b']);
    });

    it('handles an empty journal', () => {
        expect(evaluateMigrations([], new Set(['x']), NO_POLICY)).toEqual({
            expected: 0,
            missing: [],
            postDeployPending: [],
            legacyMatched: [],
            unknownAppliedCount: 1,
        });
    });
});
