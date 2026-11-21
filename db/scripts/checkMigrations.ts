/**
 * 마이그레이션 **대기 목록** 점검. 읽기 전용이다.
 *
 *   yarn db:check:migrations
 *
 * 저널의 모든 항목을 `db/scripts/migrate.ts`와 같은 함수로 해시하고, DB의
 * `drizzle.__drizzle_migrations.hash`와 비교해 아직 적용되지 않은 태그를 나열한다.
 * `ALLOW_REMOTE_DB_WRITE=1 yarn db:migrate` 전에 "무엇이 적용될지"를 태그로 보는 용도다.
 *
 * - 세션이 `default_transaction_read_only=on`이라 어떤 쓰기도 서버가 거부한다.
 *   그래서 `assertRemoteWriteAllowed`를 부르지 않는다(쓸 일이 없다).
 * - 대상(호스트/DB)은 항상 먼저 찍는다. 접속 문자열과 자격증명은 출력하지 않는다.
 * - 종료 코드: 0 막는 것 없음, 2 배포를 막을 대기 마이그레이션 있음, 1 오류.
 */
import path from 'node:path';
import postgres from 'postgres';
import {
    describeTarget,
    formatTarget,
    requireDatabaseUrl,
} from './lib/dbTarget';
import { evaluateMigrations } from '../../src/shared/db/migrations/evaluateMigrations';
import { readMigrationJournal } from '../../src/shared/db/migrations/migrationJournal';
import { MIGRATION_POLICY } from '../../src/shared/db/migrations/migrationPolicy';
import { buildMigrationReport } from '../../src/shared/db/migrations/migrationReport';
import { readOnlyClientOptions } from '../../src/shared/db/migrations/readOnlyClientOptions';
import { readAppliedHashes } from '../../src/shared/db/migrations/readAppliedHashes';
import { redactDbErrorForLog } from '../../src/shared/db/redactDbErrorForLog';

async function main(): Promise<number> {
    // migrate.ts와 같은 대상 규칙(DIRECT_DATABASE_URL || DATABASE_URL).
    const databaseUrl = requireDatabaseUrl();
    console.log(
        `[check-migrations] target: ${formatTarget(describeTarget(databaseUrl))}`
    );

    const expected = readMigrationJournal(
        path.resolve(__dirname, '../../drizzle')
    );

    const sql = postgres(databaseUrl, readOnlyClientOptions());
    try {
        const applied = await readAppliedHashes(
            () => sql<{ hash: string }[]>`
                SELECT hash FROM drizzle.__drizzle_migrations
            `
        );
        const evaluation = evaluateMigrations(
            expected,
            applied.hashes,
            MIGRATION_POLICY
        );
        const report = buildMigrationReport(
            expected,
            evaluation,
            applied.tableMissing
        );
        report.lines.forEach(line => console.log(line));
        return report.exitCode;
    } finally {
        await sql.end({ timeout: 5 });
    }
}

main().then(
    code => process.exit(code),
    (error: unknown) => {
        // DB 에러는 파라미터·메시지를 지우고 이름과 코드만 남긴다.
        console.error('[check-migrations] failed:', redactDbErrorForLog(error));
        process.exit(1);
    }
);
