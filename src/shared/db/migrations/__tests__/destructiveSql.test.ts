import { describe, expect, it } from 'vitest';
import { isDestructiveMigrationSql } from '@/shared/db/migrations/destructiveSql';

describe('isDestructiveMigrationSql', () => {
    it.each([
        ['DROP TABLE', 'DROP TABLE "users";'],
        ['DROP INDEX', 'DROP INDEX IF EXISTS "idx";'],
        ['ALTER TABLE DROP COLUMN', 'ALTER TABLE "t" DROP COLUMN "c";'],
        ['RENAME', 'ALTER TABLE "t" RENAME TO "u";'],
        ['RENAME COLUMN', 'ALTER TABLE "t" RENAME COLUMN "a" TO "b";'],
        [
            'ALTER COLUMN SET DATA TYPE',
            'ALTER TABLE "t" ALTER COLUMN "c" SET DATA TYPE bigint;',
        ],
        [
            'ALTER COLUMN TYPE',
            'ALTER TABLE t ALTER COLUMN c TYPE bigint USING c::bigint;',
        ],
        ['SET NOT NULL', 'ALTER TABLE "t" ALTER COLUMN "c" SET NOT NULL;'],
        ['TRUNCATE', 'TRUNCATE TABLE "t";'],
        ['DELETE FROM', 'delete   from "t" where id = 1;'],
    ])('flags %s', (_label, sql) => {
        expect(isDestructiveMigrationSql(sql)).toBe(true);
    });

    it.each([
        ['CREATE TABLE', 'CREATE TABLE "t" ("id" serial PRIMARY KEY);'],
        ['ADD COLUMN', 'ALTER TABLE "t" ADD COLUMN "c" text;'],
        ['CREATE INDEX', 'CREATE INDEX "i" ON "t" ("c");'],
        [
            'ALTER COLUMN SET DEFAULT',
            'ALTER TABLE "t" ALTER COLUMN "c" SET DEFAULT 1;',
        ],
    ])('does not flag %s', (_label, sql) => {
        expect(isDestructiveMigrationSql(sql)).toBe(false);
    });

    it('ignores keywords inside line comments', () => {
        expect(
            isDestructiveMigrationSql(
                '-- DROP TABLE x and TRUNCATE\nCREATE TABLE "t" ("id" int);\n--> statement-breakpoint\n'
            )
        ).toBe(false);
    });

    it('ignores keywords inside block comments', () => {
        expect(
            isDestructiveMigrationSql(
                '/* DELETE FROM t;\n DROP INDEX i */ CREATE INDEX "i" ON "t" ("c");'
            )
        ).toBe(false);
    });

    it('still flags a statement that follows a comment', () => {
        expect(isDestructiveMigrationSql('-- harmless\nDROP TABLE "t";')).toBe(
            true
        );
    });
});
