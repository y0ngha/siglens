import { describe, expect, it } from 'vitest';
import { buildMigrationReport } from '@/shared/db/migrations/migrationReport';
import type {
    ExpectedMigration,
    MigrationEvaluation,
} from '@/shared/db/migrations/types';

const mig = (tag: string, sql: string): ExpectedMigration => ({
    tag,
    when: 1,
    hash: `hash-of-${tag}`,
    sql,
});
const EXPECTED = [
    mig('0000_a', 'CREATE TABLE t (id int);'),
    mig('0001_b', 'DROP INDEX i;'),
    mig('0002_c', 'ALTER TABLE t ADD COLUMN c int;'),
];
const CLEAN: MigrationEvaluation = {
    expected: 3,
    missing: [],
    postDeployPending: [],
    legacyMatched: [],
    unknownAppliedCount: 0,
};

describe('buildMigrationReport', () => {
    it('exits 0 and says nothing blocks when nothing is pending', () => {
        const report = buildMigrationReport(EXPECTED, CLEAN, false);
        expect(report.exitCode).toBe(0);
        expect(report.pending).toEqual([]);
        expect(report.lines).toEqual([
            '[check-migrations] journal entries: 3, pending: 0',
            '[check-migrations] applied hashes unknown to the journal: 0',
            '[check-migrations] nothing blocks a deploy',
        ]);
    });

    it('marks a missing tag as BLOCKS DEPLOY and exits 2', () => {
        const report = buildMigrationReport(
            EXPECTED,
            { ...CLEAN, missing: ['0002_c'] },
            false
        );
        expect(report.exitCode).toBe(2);
        expect(report.pending).toEqual([
            { tag: '0002_c', blocksDeploy: true, destructive: false },
        ]);
        expect(report.lines).toContain('  0002_c  BLOCKS DEPLOY');
        expect(report.lines).toContain(
            '[check-migrations] 1 pending migration(s) would block a deploy'
        );
    });

    it('labels DESTRUCTIVE on a pending destructive tag', () => {
        const report = buildMigrationReport(
            EXPECTED,
            { ...CLEAN, missing: ['0001_b'] },
            false
        );
        expect(report.lines).toContain('  0001_b  BLOCKS DEPLOY  DESTRUCTIVE');
    });

    it('a post-deploy tag does not block (exit 0) but is listed', () => {
        const report = buildMigrationReport(
            EXPECTED,
            { ...CLEAN, postDeployPending: ['0001_b'] },
            false
        );
        expect(report.exitCode).toBe(0);
        expect(report.lines).toContain(
            '  0001_b  post-deploy allowed  DESTRUCTIVE'
        );
        expect(report.lines).toContain(
            '[check-migrations] nothing blocks a deploy'
        );
    });

    it('keeps journal order when listing mixed pending tags', () => {
        const report = buildMigrationReport(
            EXPECTED,
            { ...CLEAN, missing: ['0002_c'], postDeployPending: ['0000_a'] },
            false
        );
        expect(report.pending.map(p => p.tag)).toEqual(['0000_a', '0002_c']);
    });

    it('mentions legacy-alias tags and the unknown-applied count', () => {
        const report = buildMigrationReport(
            EXPECTED,
            { ...CLEAN, legacyMatched: ['0001_b'], unknownAppliedCount: 4 },
            false
        );
        expect(report.lines).toContain(
            '[check-migrations] satisfied only by a legacy alias hash: 0001_b'
        );
        expect(report.lines).toContain(
            '[check-migrations] applied hashes unknown to the journal: 4'
        );
    });

    it('notes a missing journal table first', () => {
        const report = buildMigrationReport(
            EXPECTED,
            { ...CLEAN, missing: ['0000_a', '0001_b', '0002_c'] },
            true
        );
        expect(report.lines[0]).toContain('does not exist');
        expect(report.exitCode).toBe(2);
    });

    it('never prints hashes or SQL bodies', () => {
        const report = buildMigrationReport(
            EXPECTED,
            { ...CLEAN, missing: ['0001_b'] },
            false
        );
        const text = report.lines.join('\n');
        expect(text).not.toContain('hash-of-');
        expect(text).not.toContain('DROP INDEX i;');
    });
});
