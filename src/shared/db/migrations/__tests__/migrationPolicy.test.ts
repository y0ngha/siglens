import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readMigrationJournal } from '@/shared/db/migrations/migrationJournal';
import {
    LEGACY_MIGRATION_HASHES,
    MIGRATION_POLICY,
    POST_DEPLOY_MIGRATION_TAGS,
} from '@/shared/db/migrations/migrationPolicy';

const JOURNAL_TAGS = readMigrationJournal(
    path.resolve(__dirname, '../../../../../drizzle')
).map(m => m.tag);

describe('migration policy', () => {
    it('every post-deploy tag is a journal tag', () => {
        expect(
            POST_DEPLOY_MIGRATION_TAGS.filter(t => !JOURNAL_TAGS.includes(t))
        ).toEqual([]);
    });

    it('every legacy alias key is a journal tag and values are 64-hex', () => {
        const entries = Object.entries(LEGACY_MIGRATION_HASHES);
        expect(entries.filter(([tag]) => !JOURNAL_TAGS.includes(tag))).toEqual(
            []
        );
        expect(
            entries
                .flatMap(([, hashes]) => hashes)
                .filter(h => !/^[0-9a-f]{64}$/.test(h))
        ).toEqual([]);
    });

    it('exposes the two lists through MIGRATION_POLICY', () => {
        expect(MIGRATION_POLICY).toEqual({
            postDeployTags: POST_DEPLOY_MIGRATION_TAGS,
            legacyHashes: LEGACY_MIGRATION_HASHES,
        });
    });
});
