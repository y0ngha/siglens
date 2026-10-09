import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';

export interface CapturedQuery {
    sql: string;
    params: unknown[];
}

/**
 * 실제 Drizzle 쿼리 빌더로 만든 SQL을 드라이버 없이 캡처하는 테스트 DB.
 *
 * `drizzle.mock()`(클라이언트 없음)을 Proxy로 감싸, 쿼리 빌더를 `await`하는 순간
 * `.toSQL()`을 기록하고 `resolveWith`로 resolve한다. 손으로 옮겨 적은 조건 목록이
 * 아니라 **Drizzle이 실제로 생성하는 SQL/파라미터**를 단언하게 해 준다 —
 * 인덱스를 타는 WHERE인지, 배치 상한이 서브쿼리에 붙었는지 같은 것은 생성된 SQL로만
 * 확인할 수 있다(`entities/chat-conversation/__tests__/api.test.ts`와 같은 패턴).
 */
export function createSqlCaptureDb(
    resolveWith:
        | unknown[]
        | ((query: CapturedQuery, index: number) => unknown[]) = []
): {
    db: SiglensDatabase;
    captured: CapturedQuery[];
} {
    const captured: CapturedQuery[] = [];

    function wrap(target: unknown): unknown {
        if (target === null || typeof target !== 'object') return target;
        return new Proxy(target as object, {
            get(t, prop) {
                if (
                    prop === 'then' &&
                    typeof (t as { toSQL?: unknown }).toSQL === 'function'
                ) {
                    return (resolve: (v: unknown) => void) => {
                        const query = (
                            t as { toSQL: () => CapturedQuery }
                        ).toSQL();
                        captured.push(query);
                        resolve(
                            typeof resolveWith === 'function'
                                ? resolveWith(query, captured.length - 1)
                                : resolveWith
                        );
                        return Promise.resolve();
                    };
                }
                const value = Reflect.get(t, prop, t);
                if (typeof value === 'function') {
                    return (...args: unknown[]) => wrap(value.apply(t, args));
                }
                return value;
            },
        });
    }

    const real = drizzle.mock({ schema });
    return { db: wrap(real) as SiglensDatabase, captured };
}
