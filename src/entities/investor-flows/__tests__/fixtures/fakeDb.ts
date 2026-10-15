import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { SiglensDatabase } from '@/shared/db/types';

/** 체인 한 번(예: `insert(t).values(v).onConflictDoUpdate(c).returning(r)`)에서 불린 메서드 기록. */
export interface RecordedOp {
    kind: string;
    /** `kind` 호출의 첫 인자(보통 테이블 또는 SQL). */
    target: unknown;
    calls: { method: string; args: unknown[] }[];
}

export interface FakeDb {
    db: SiglensDatabase;
    ops: RecordedOp[];
}

const dialect = new PgDialect();

/** drizzle SQL 조각을 SQL 문자열 + 바인드 값으로 그린다. */
export function renderSql(query: SQL): { text: string; params: unknown[] } {
    const { sql, params } = dialect.sqlToQuery(query);
    return { text: sql.replace(/\s+/g, ' '), params };
}

/**
 * 빌더 체인을 흉내 내는 가짜 DB. 최상위 호출(`insert`·`delete`·`select`·`selectDistinct`·`update`·`execute`)마다
 * `results`에서 다음 결과를 꺼내 체인을 `await`할 때 돌려주고, 체인에서 불린 메서드와 인자를 `ops`에 남긴다.
 * `transaction(cb)`는 같은 가짜 DB를 `tx`로 넘긴다. 결과가 모자라면 빈 배열이다.
 */
export function createFakeDb(results: unknown[] = []): FakeDb {
    const ops: RecordedOp[] = [];
    const queue = [...results];

    function start(kind: string, target: unknown): unknown {
        const op: RecordedOp = { kind, target, calls: [] };
        ops.push(op);
        const result = queue.length > 0 ? queue.shift() : [];
        const chain: unknown = new Proxy(
            {},
            {
                get(_t, prop) {
                    if (prop === 'then') {
                        return (
                            resolve: (value: unknown) => unknown,
                            reject: (reason: unknown) => unknown
                        ) =>
                            result instanceof Error
                                ? reject(result)
                                : resolve(result);
                    }
                    return (...args: unknown[]) => {
                        op.calls.push({ method: String(prop), args });
                        return chain;
                    };
                },
            }
        );
        return chain;
    }

    const db: Record<string, unknown> = {};
    for (const kind of [
        'insert',
        'delete',
        'select',
        'selectDistinct',
        'update',
        'execute',
    ]) {
        db[kind] = (target: unknown) => start(kind, target);
    }
    db.transaction = async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(db);
    return { db: db as unknown as SiglensDatabase, ops };
}

export const callsOf = (op: RecordedOp, method: string): unknown[][] =>
    op.calls.filter(call => call.method === method).map(call => call.args);
