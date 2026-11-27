import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {
    ExpectedMigration,
    JournalEntry,
} from '@/shared/db/migrations/types';
import { isRecord } from '@/shared/lib/isRecord';

/**
 * 저널이나 SQL 파일을 읽지 못했을 때. 이미지·체크아웃이 깨졌다는 뜻이라 호출부가
 * "대기 없음"으로 흘리지 않고 닫힌 쪽으로 처리해야 한다.
 */
export class MigrationManifestError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'MigrationManifestError';
    }
}

/**
 * 마이그레이션 SQL의 해시. `drizzle.__drizzle_migrations.hash`에 쌓이는 값과 같아야 한다.
 * 적용기(`db/scripts/migrate.ts`)와 점검기가 **같은 함수**를 써서 서로 어긋날 수 없다.
 */
export function hashMigrationSql(sql: string): string {
    return createHash('sha256').update(sql).digest('hex');
}

function readOrThrow(file: string): string {
    try {
        return readFileSync(file, 'utf-8');
    } catch (cause) {
        throw new MigrationManifestError(
            `migration manifest unreadable: ${path.basename(file)}`,
            { cause }
        );
    }
}

function isJournalEntry(value: unknown): value is JournalEntry {
    return (
        isRecord(value) &&
        typeof value.idx === 'number' &&
        typeof value.tag === 'string' &&
        value.tag.length > 0 &&
        typeof value.when === 'number'
    );
}

function parseEntries(raw: string): readonly JournalEntry[] {
    const parsed = parseJson(raw);
    const entries = isRecord(parsed) ? parsed.entries : undefined;
    if (!Array.isArray(entries)) {
        throw new MigrationManifestError(
            'migration journal is not valid JSON with entries'
        );
    }
    const badIndex = entries.findIndex(entry => !isJournalEntry(entry));
    if (badIndex !== -1) {
        throw new MigrationManifestError(
            `migration journal entry ${badIndex} is malformed (needs idx, tag, when)`
        );
    }
    return entries.filter(isJournalEntry);
}

function parseJson(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch (cause) {
        throw new MigrationManifestError(
            'migration journal is not valid JSON with entries',
            { cause }
        );
    }
}

/**
 * 저널 순서대로 모든 마이그레이션의 태그·해시·SQL을 읽는다.
 *
 * @param drizzleRoot `drizzle/` 디렉터리 절대 경로 (`meta/_journal.json`과 `<tag>.sql`이 있는 곳)
 * @throws MigrationManifestError 저널이나 `.sql` 파일을 읽을 수 없을 때
 */
export function readMigrationJournal(
    drizzleRoot: string
): readonly ExpectedMigration[] {
    const entries = parseEntries(
        readOrThrow(path.join(drizzleRoot, 'meta/_journal.json'))
    );
    return entries.map(entry => {
        const sql = readOrThrow(path.join(drizzleRoot, `${entry.tag}.sql`));
        return {
            tag: entry.tag,
            when: entry.when,
            hash: hashMigrationSql(sql),
            sql,
        };
    });
}
