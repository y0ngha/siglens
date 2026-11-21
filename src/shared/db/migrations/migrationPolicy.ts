import type { MigrationPolicy } from '@/shared/db/migrations/types';

/**
 * 배포 **뒤**에 적용하기로 한 마이그레이션 태그(expand/contract의 contract 단계).
 * 여기 있는 태그는 대기 중이어도 배포를 막지 않는다. 새 코드가 모두 올라온 뒤에야 안전한
 * 파괴적 변경(구 인덱스·컬럼 제거 등)을 배포 뒤에 `db/scripts/migrate.ts --until`로 적용할 때만 넣고,
 * 적용이 끝나면 지운다. 지금 비어 있는 것은 그런 마이그레이션이 대기 중이지 않아서다.
 */
export const POST_DEPLOY_MIGRATION_TAGS: readonly string[] = [];

/**
 * 태그 -> 과거 해시 목록. 이미 적용된 마이그레이션 파일이 나중에 수정돼 현재 해시가
 * `__drizzle_migrations`에 없을 때, 운영 테이블을 고치는 대신 옛 해시를 여기 적는다.
 * 운영 DB에 읽기 전용 점검(`yarn db:check:migrations`)을 돌려 "적용은 됐는데 해시가 안 맞는"
 * 태그가 나왔을 때만 넣는다. 값은 64자리 소문자 hex. 지금 비어 있는 것은 그런 드리프트가
 * 발견되지 않아서다.
 */
export const LEGACY_MIGRATION_HASHES: Readonly<
    Record<string, readonly string[]>
> = {};

/** 평가기(`evaluateMigrations`)와 점검 CLI가 넘겨받는 위 두 목록의 묶음. */
export const MIGRATION_POLICY: MigrationPolicy = {
    postDeployTags: POST_DEPLOY_MIGRATION_TAGS,
    legacyHashes: LEGACY_MIGRATION_HASHES,
};
