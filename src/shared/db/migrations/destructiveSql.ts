const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /--[^\n]*/g;

/**
 * 되돌리기 어려운 DDL/DML 패턴. 보수적으로 넓게 잡는다(오탐은 사람이 한 번 더 보면 되지만
 * 미탐은 승인 없이 지나간다):
 * DROP(테이블·인덱스·컬럼·제약 등), TRUNCATE, DELETE FROM, RENAME,
 * ALTER COLUMN ... [SET DATA] TYPE, SET NOT NULL.
 */
const DESTRUCTIVE_PATTERNS: readonly RegExp[] = [
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bRENAME\b/i,
    /\bALTER\s+COLUMN\s+(?:"[^"]*"|\S+)\s+(?:SET\s+DATA\s+)?TYPE\b/i,
    /\bSET\s+NOT\s+NULL\b/i,
];

/**
 * 마이그레이션 SQL이 파괴적인가. SQL 주석(`--` 줄 주석과 블록 주석)은 먼저 지운다
 * (drizzle의 `--> statement-breakpoint`도 주석이다).
 */
export function isDestructiveMigrationSql(sql: string): boolean {
    const code = sql.replace(BLOCK_COMMENT, ' ').replace(LINE_COMMENT, ' ');
    return DESTRUCTIVE_PATTERNS.some(pattern => pattern.test(code));
}
