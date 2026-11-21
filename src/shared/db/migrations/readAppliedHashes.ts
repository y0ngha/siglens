/** postgres-js·drizzle 어느 쪽이든 SQLSTATE는 `code`에 있고, 감싸이면 `cause`에 있다. */
const UNDEFINED_TABLE = '42P01';
const MAX_CAUSE_DEPTH = 8;

function codeAt(error: unknown, depth: number): boolean {
    if (depth >= MAX_CAUSE_DEPTH || typeof error !== 'object' || error === null)
        return false;
    const { code, cause } = error as { code?: unknown; cause?: unknown };
    return code === UNDEFINED_TABLE || codeAt(cause, depth + 1);
}

/** 저널 테이블(`drizzle.__drizzle_migrations`)이 없을 때의 에러인가(`42P01`). */
export function isUndefinedTableError(error: unknown): boolean {
    return codeAt(error, 0);
}

export interface AppliedHashes {
    readonly hashes: ReadonlySet<string>;
    /** 저널 테이블 자체가 없다 = 한 번도 적용되지 않은 DB. */
    readonly tableMissing: boolean;
}

/**
 * 적용된 해시를 읽는다. 쿼리 실행은 호출부가 주입한다(읽기 전용 세션의 SELECT 한 줄).
 * 테이블 없음(`42P01`)만 "전부 대기"로 바꾸고, 그 밖의 에러는 그대로 던진다.
 */
export async function readAppliedHashes(
    run: () => Promise<readonly { hash: string }[]>
): Promise<AppliedHashes> {
    try {
        const rows = await run();
        return { hashes: new Set(rows.map(r => r.hash)), tableMissing: false };
    } catch (error) {
        if (isUndefinedTableError(error)) {
            return { hashes: new Set(), tableMissing: true };
        }
        throw error;
    }
}
