/**
 * 작은 토크나이저: 작은따옴표 리터럴, 큰따옴표 식별자, `--` 줄 주석, 블록 주석 중 **먼저 시작하는 것**을
 * 하나로 잡는다. 그래서 리터럴 안의 `--`는 주석이 아니고(`'a--b'` 뒤의 DROP이 가려지지 않는다),
 * 주석 안의 따옴표도 리터럴이 아니다. 달러 인용(`$$ ... $$`)은 해석하지 않는다. 그 안은 코드로
 * 훑으므로 오탐 쪽(보수적)이다.
 */
const TOKEN = /'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g;

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

/** 주석은 공백으로, 리터럴·식별자는 내용을 비운 따옴표만 남긴다(리터럴 속 단어는 DDL이 아니다). */
function stripCommentsAndLiterals(sql: string): string {
    return sql.replace(TOKEN, token => {
        if (token.startsWith("'")) return "''";
        if (token.startsWith('"')) return '""';
        return ' ';
    });
}

/**
 * 마이그레이션 SQL이 파괴적인가. SQL 주석(`--` 줄 주석과 블록 주석, drizzle의
 * `--> statement-breakpoint` 포함)과 리터럴 내용은 판정에서 뺀다.
 */
export function isDestructiveMigrationSql(sql: string): boolean {
    const code = stripCommentsAndLiterals(sql);
    return DESTRUCTIVE_PATTERNS.some(pattern => pattern.test(code));
}
