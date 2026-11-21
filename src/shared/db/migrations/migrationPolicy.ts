import type { MigrationPolicy } from '@/shared/db/migrations/types';

/**
 * 배포 **뒤**에 적용하기로 한 마이그레이션 태그(expand/contract의 contract 단계).
 * 여기 있는 태그는 대기 중이어도 배포를 막지 않는다. 예: 구 인덱스를 지우는 0030은
 * 새 코드가 모두 올라온 뒤에 적용한다(`db/scripts/migrate.ts --until`).
 * 비어 있는 것이 기본이다. 태그를 넣었다면 적용이 끝난 뒤 지운다.
 */
export const POST_DEPLOY_MIGRATION_TAGS: readonly string[] = [];

/**
 * 태그 -> 과거 해시 목록. 이미 적용된 마이그레이션 파일이 나중에 수정돼 현재 해시가
 * `__drizzle_migrations`에 없을 때, 운영 테이블을 고치는 대신 옛 해시를 여기 적는다.
 * 점검 도구가 이 별칭 중 하나라도 적용 기록에 있으면 적용된 것으로 센다.
 * 값은 64자리 소문자 hex. 비어 있는 것이 기본이다.
 */
export const LEGACY_MIGRATION_HASHES: Readonly<
    Record<string, readonly string[]>
> = {};

export const MIGRATION_POLICY: MigrationPolicy = {
    postDeployTags: POST_DEPLOY_MIGRATION_TAGS,
    legacyHashes: LEGACY_MIGRATION_HASHES,
};
