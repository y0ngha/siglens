import type {
    ExpectedMigration,
    MigrationEvaluation,
    MigrationPolicy,
} from '@/shared/db/migrations/types';

/**
 * 저널이 기대하는 마이그레이션과 DB에 적용된 해시를 맞춰 본다. 판정은 **해시**로 한다.
 * 행 수와 파일 수는 1:1이 아니다(적용 뒤 수정된 파일의 옛 해시 행이 남는다).
 * 저널에 없는 적용 해시는 실패가 아니다: 기대 목록이 적용 목록의 부분집합이면 된다.
 */
export function evaluateMigrations(
    expected: readonly ExpectedMigration[],
    appliedHashes: ReadonlySet<string>,
    policy: MigrationPolicy
): MigrationEvaluation {
    const aliasesOf = (tag: string): readonly string[] =>
        policy.legacyHashes[tag] ?? [];

    const viaLegacy = (m: ExpectedMigration): boolean =>
        !appliedHashes.has(m.hash) &&
        aliasesOf(m.tag).some(hash => appliedHashes.has(hash));

    const pending = expected.filter(
        m => !appliedHashes.has(m.hash) && !viaLegacy(m)
    );
    const known = new Set(expected.flatMap(m => [m.hash, ...aliasesOf(m.tag)]));

    return {
        expected: expected.length,
        missing: pending
            .filter(m => !policy.postDeployTags.includes(m.tag))
            .map(m => m.tag),
        postDeployPending: pending
            .filter(m => policy.postDeployTags.includes(m.tag))
            .map(m => m.tag),
        legacyMatched: expected.filter(viaLegacy).map(m => m.tag),
        unknownAppliedCount: [...appliedHashes].filter(h => !known.has(h))
            .length,
    };
}
