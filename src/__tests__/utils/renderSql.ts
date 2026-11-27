import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

export interface RenderedSql {
    sql: string;
    params: unknown[];
}

/**
 * drizzle `SQL` 조각·조건을 공개 API(`PgDialect#sqlToQuery`)로 SQL 문자열과 바인딩 값으로 펼친다.
 * 내부 필드(`queryChunks` 등)를 읽지 않으므로 drizzle 내부 구조가 바뀌어도 의미가 같으면 깨지지 않는다.
 */
export function renderSql(node: unknown): RenderedSql {
    const { sql, params } = dialect.sqlToQuery(node as SQL);
    return { sql, params };
}
