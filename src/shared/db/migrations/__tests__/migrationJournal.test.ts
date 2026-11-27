import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    hashMigrationSql,
    MigrationManifestError,
    readMigrationJournal,
} from '@/shared/db/migrations/migrationJournal';

const REPO_DRIZZLE = path.resolve(__dirname, '../../../../../drizzle');
const HEX64 = /^[0-9a-f]{64}$/;

const tempDirs = new Set<string>();

function makeRoot(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'siglens-journal-'));
    tempDirs.add(root);
    mkdirSync(path.join(root, 'meta'));
    Object.entries(files).forEach(([name, content]) =>
        writeFileSync(path.join(root, name), content)
    );
    return root;
}

function journal(tags: readonly string[]): string {
    return JSON.stringify({
        entries: tags.map((tag, idx) => ({ idx, tag, when: 1000 + idx })),
    });
}

afterEach(() => {
    tempDirs.forEach(dir => rmSync(dir, { recursive: true, force: true }));
    tempDirs.clear();
});

describe('hashMigrationSql', () => {
    it('sha256 hex of the utf-8 content', () => {
        const sql = 'CREATE TABLE t (id int);\n--> statement-breakpoint\n';
        expect(hashMigrationSql(sql)).toBe(
            createHash('sha256').update(sql).digest('hex')
        );
    });

    it('hashes non-ASCII content as utf-8', () => {
        const sql = '-- 한글 주석 ✓\nSELECT 1;';
        expect(hashMigrationSql(sql)).toBe(
            createHash('sha256').update(Buffer.from(sql, 'utf-8')).digest('hex')
        );
    });
});

describe('readMigrationJournal', () => {
    it('follows the journal order and hashes each file', () => {
        const root = makeRoot({
            'meta/_journal.json': journal(['0001_b', '0000_a']),
            '0000_a.sql': 'SELECT 0;',
            '0001_b.sql': 'SELECT 1;',
        });
        const result = readMigrationJournal(root);
        expect(result.map(m => m.tag)).toEqual(['0001_b', '0000_a']);
        expect(result.map(m => m.when)).toEqual([1000, 1001]);
        expect(result[0]).toEqual({
            tag: '0001_b',
            when: 1000,
            hash: hashMigrationSql('SELECT 1;'),
            sql: 'SELECT 1;',
        });
    });

    it('throws a typed error when a .sql file is missing', () => {
        const root = makeRoot({
            'meta/_journal.json': journal(['0000_a']),
        });
        expect(() => readMigrationJournal(root)).toThrow(
            MigrationManifestError
        );
    });

    it('throws a typed error when the journal is missing', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'siglens-journal-'));
        tempDirs.add(root);
        expect(() => readMigrationJournal(root)).toThrow(
            MigrationManifestError
        );
    });

    it.each([
        ['invalid JSON', '{not json'],
        ['no entries array', '{"entries": 5}'],
        ['a non-object document', 'null'],
    ])('throws a typed error for a journal with %s', (_label, content) => {
        const root = makeRoot({ 'meta/_journal.json': content });
        expect(() => readMigrationJournal(root)).toThrow(
            MigrationManifestError
        );
    });

    it('does not put file content or paths into the error message', () => {
        const root = makeRoot({
            'meta/_journal.json': journal(['0000_a']),
        });
        expect(() => readMigrationJournal(root)).toThrow(
            'migration manifest unreadable: 0000_a.sql'
        );
    });

    it('throws a typed error naming the index of a malformed entry', () => {
        const root = makeRoot({
            'meta/_journal.json': JSON.stringify({
                entries: [
                    { idx: 0, tag: '0000_a', when: 1 },
                    { idx: 1, when: 2 },
                ],
            }),
            '0000_a.sql': 'SELECT 0;',
        });
        expect(() => readMigrationJournal(root)).toThrow(
            'migration journal entry 1 is malformed'
        );
    });

    it.each([
        ['a non-string tag', { idx: 0, tag: 5, when: 1 }],
        ['an empty tag', { idx: 0, tag: '', when: 1 }],
        ['a non-number when', { idx: 0, tag: '0000_a', when: '1' }],
        ['a non-number idx', { idx: '0', tag: '0000_a', when: 1 }],
        ['a non-object entry', 'nope'],
        ['a null entry', null],
    ])('rejects an entry with %s', (_label, entry) => {
        const root = makeRoot({
            'meta/_journal.json': JSON.stringify({ entries: [entry] }),
            '0000_a.sql': 'SELECT 0;',
        });
        expect(() => readMigrationJournal(root)).toThrow(
            MigrationManifestError
        );
    });

    it('reads the real repo journal: 64-hex hashes, unique tags in order', () => {
        const result = readMigrationJournal(REPO_DRIZZLE);
        expect(result.length).toBeGreaterThan(0);
        expect(new Set(result.map(m => m.tag)).size).toBe(result.length);
        expect(result.map(m => m.tag)).toEqual(result.map(m => m.tag).sort());
        expect(result.every(m => HEX64.test(m.hash))).toBe(true);
    });
});
