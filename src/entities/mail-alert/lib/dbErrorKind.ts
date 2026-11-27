import { readErrorCode } from '@/shared/lib/readErrorCode';

/** Postgres SQLSTATE `42P01`: 테이블이 없다 — 마이그레이션이 아직 적용되지 않은 환경. */
const UNDEFINED_TABLE = '42P01';

/** Postgres SQLSTATE `23505`: 유니크 위반. */
const UNIQUE_VIOLATION = '23505';

export function isMissingTableError(error: unknown): boolean {
    return readErrorCode(error) === UNDEFINED_TABLE;
}

export function isUniqueViolationError(error: unknown): boolean {
    return readErrorCode(error) === UNIQUE_VIOLATION;
}
