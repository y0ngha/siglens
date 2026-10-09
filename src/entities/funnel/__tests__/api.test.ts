import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { DrizzleFunnelEventRepository } from '@/entities/funnel/api';
import type { SiglensDatabase } from '@/shared/db/types';

/** 한 번만 불렸음을 단언한 뒤 그 인자를 돌려준다 — 호출 순번 인덱스에 기대지 않는다. */
function onlyCall<T extends unknown[]>(mock: { mock: { calls: T[] } }): T {
    expect(mock.mock.calls).toHaveLength(1);
    return mock.mock.calls.find(() => true)!;
}

function makeInsertDb() {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    return { db: { insert } as unknown as SiglensDatabase, values };
}

function makeDeleteDb() {
    const where = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn(() => ({ where }));
    return { db: { delete: del } as unknown as SiglensDatabase, where };
}

describe('DrizzleFunnelEventRepository', () => {
    it('record는 받은 행을 그대로 삽입한다', async () => {
        const { db, values } = makeInsertDb();
        const event = {
            visitorHash: 'hash-1',
            userId: 'user-1',
            event: 'gate_clicked' as const,
            context: { gate: 'timeframe' as const },
        };
        await new DrizzleFunnelEventRepository(db).record(event);
        expect(values).toHaveBeenCalledWith(event);
    });

    it('pruneOlderThan은 기준일 KST 자정 이전 행을 지운다', async () => {
        const { db, where } = makeDeleteDb();
        await new DrizzleFunnelEventRepository(db).pruneOlderThan('2025-07-29');
        const [condition] = onlyCall(where);
        const query = new PgDialect().sqlToQuery(condition as never);
        expect(query.sql).toBe('"funnel_events"."occurred_at" < $1');
        // drizzle이 timestamp 파라미터를 ISO 문자열로 직렬화한다.
        expect(query.params).toEqual(['2025-07-28T15:00:00.000Z']);
    });
});
