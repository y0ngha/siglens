import { isDestructiveMigrationSql } from '@/shared/db/migrations/destructiveSql';
import type {
    ExpectedMigration,
    MigrationEvaluation,
    MigrationReport,
    PendingMigration,
} from '@/shared/db/migrations/types';

/**
 * 점검 결과를 사람이 읽는 줄과 종료 코드로 만든다(순수). 출력에는 태그와 개수만 있다:
 * 접속 문자열·해시 값·SQL 본문은 싣지 않는다.
 */
export function buildMigrationReport(
    expected: readonly ExpectedMigration[],
    evaluation: MigrationEvaluation,
    tableMissing: boolean
): MigrationReport {
    const pending: readonly PendingMigration[] = expected
        .filter(
            m =>
                evaluation.missing.includes(m.tag) ||
                evaluation.postDeployPending.includes(m.tag)
        )
        .map(m => ({
            tag: m.tag,
            blocksDeploy: evaluation.missing.includes(m.tag),
            destructive: isDestructiveMigrationSql(m.sql),
        }));

    const pendingLines = pending.map(
        p =>
            `  ${p.tag}  ${p.blocksDeploy ? 'BLOCKS DEPLOY' : 'post-deploy allowed'}${
                p.destructive ? '  DESTRUCTIVE' : ''
            }`
    );
    const blocking = pending.filter(p => p.blocksDeploy).length;

    const lines = [
        ...(tableMissing
            ? [
                  '[check-migrations] drizzle.__drizzle_migrations does not exist: treating every migration as pending',
              ]
            : []),
        `[check-migrations] journal entries: ${evaluation.expected}, pending: ${pending.length}`,
        ...pendingLines,
        ...(evaluation.legacyMatched.length > 0
            ? [
                  `[check-migrations] satisfied only by a legacy alias hash: ${evaluation.legacyMatched.join(', ')}`,
              ]
            : []),
        `[check-migrations] applied hashes unknown to the journal: ${evaluation.unknownAppliedCount}`,
        blocking > 0
            ? `[check-migrations] ${blocking} pending migration(s) would block a deploy`
            : '[check-migrations] nothing blocks a deploy',
    ];

    return { lines, pending, exitCode: blocking > 0 ? 2 : 0 };
}
