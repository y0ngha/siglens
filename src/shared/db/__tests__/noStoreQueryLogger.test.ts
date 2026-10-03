vi.mock('next/cache', () => ({
    unstable_noStore: vi.fn(),
}));

import { unstable_noStore } from 'next/cache';
import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { noStoreQueryLogger } from '@/shared/db/noStoreQueryLogger';

const items = pgTable('items', { id: text('id').primaryKey() });

/**
 * 실제 postgres-js 클라이언트 대신 최소 stub. drizzle은 `client.options`/`client.unsafe`만
 * 쓰며, 여기서는 쿼리가 소켓에 닿기 전에 로거가 호출되는지를 보려는 것이다.
 */
function makeFakeSql(order: string[]) {
    const unsafe = vi.fn((_query: string, _params: unknown[]) => {
        order.push('unsafe');
        const result = Promise.resolve([] as unknown[][]);
        return Object.assign(result, { values: () => result });
    });
    const sql = {
        unsafe,
        options: { parsers: {}, serializers: {} },
        begin: vi.fn(async (fn: (tx: unknown) => unknown) => fn(sql)),
    };
    return { sql, unsafe };
}

describe('noStoreQueryLogger', () => {
    beforeEach(() => {
        vi.mocked(unstable_noStore).mockClear();
    });

    it('logQuery마다 unstable_noStore를 한 번 호출한다', () => {
        noStoreQueryLogger.logQuery('select 1', []);
        expect(unstable_noStore).toHaveBeenCalledTimes(1);

        noStoreQueryLogger.logQuery('select 2', []);
        expect(unstable_noStore).toHaveBeenCalledTimes(2);
    });

    it('unstable_noStore가 던지면(prerender-legacy) 그대로 전파한다', () => {
        const dynamicError = new Error('DYNAMIC_SERVER_USAGE');
        vi.mocked(unstable_noStore).mockImplementationOnce(() => {
            throw dynamicError;
        });

        expect(() => noStoreQueryLogger.logQuery('select 1', [])).toThrow(
            dynamicError
        );
    });

    describe('drizzle postgres-js 통합', () => {
        it('쿼리 하나당 unstable_noStore가 한 번, 소켓 쓰기(unsafe)보다 먼저 호출된다', async () => {
            const order: string[] = [];
            vi.mocked(unstable_noStore).mockImplementation(() => {
                order.push('noStore');
            });
            const { sql, unsafe } = makeFakeSql(order);
            const db = drizzle(sql as never, { logger: noStoreQueryLogger });

            await db.select().from(items);

            expect(unstable_noStore).toHaveBeenCalledTimes(1);
            expect(unsafe).toHaveBeenCalledTimes(1);
            expect(order).toEqual(['noStore', 'unsafe']);
        });

        it('unstable_noStore가 던지면 쿼리는 소켓에 나가지 않고 reject된다', async () => {
            const dynamicError = new Error('DYNAMIC_SERVER_USAGE');
            vi.mocked(unstable_noStore).mockImplementationOnce(() => {
                throw dynamicError;
            });
            const { sql, unsafe } = makeFakeSql([]);
            const db = drizzle(sql as never, { logger: noStoreQueryLogger });

            await expect(db.select().from(items)).rejects.toThrow(
                'DYNAMIC_SERVER_USAGE'
            );
            expect(unsafe).not.toHaveBeenCalled();
        });

        it('트랜잭션 안의 쿼리도 같은 로거를 탄다', async () => {
            vi.mocked(unstable_noStore).mockImplementation(() => undefined);
            const { sql } = makeFakeSql([]);
            const db = drizzle(sql as never, { logger: noStoreQueryLogger });

            await db.transaction(async tx => {
                await tx.select().from(items);
                await tx.select().from(items);
            });

            expect(unstable_noStore).toHaveBeenCalledTimes(2);
        });
    });
});
