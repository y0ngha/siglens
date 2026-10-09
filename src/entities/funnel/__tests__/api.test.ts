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

/**
 * `countByKeyAndEvent`·`signupBreakdown`은 select().from().where().groupBy()에서 끝난다 —
 * groupBy가 곧 thenable이어야 한다.
 */
function makeSelectDb(rows: unknown[]) {
    const groupBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn((_condition: unknown) => ({ groupBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn((_selection: unknown) => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        where,
        groupBy,
    };
}

function makeExecuteDb(rows: unknown[]) {
    const execute = vi.fn().mockResolvedValue(rows);
    return { db: { execute } as unknown as SiglensDatabase, execute };
}

const FROM = new Date('2026-09-30T15:00:00.000Z');
const TO_EXCLUSIVE = new Date('2026-10-31T15:00:00.000Z');

describe('DrizzleFunnelEventRepository 리포트 쿼리', () => {
    it('countByKeyAndEvent는 키를 gate·kind·lastGate 순으로 접어 (key, event)별로 센다', async () => {
        const rows = [
            { key: 'timeframe', event: 'gate_clicked', count: 12 },
            { key: 'anon_auto', event: 'nudge_shown', count: 40 },
        ];
        const { db, select, where, groupBy } = makeSelectDb(rows);
        await expect(
            new DrizzleFunnelEventRepository(db).countByKeyAndEvent(
                FROM,
                TO_EXCLUSIVE
            )
        ).resolves.toEqual(rows);
        const [selection] = onlyCall(select) as [{ key: unknown }];
        const rendered = new PgDialect().sqlToQuery(selection.key as never);
        expect(rendered.sql).toBe(
            `coalesce("funnel_events"."context" ->> 'gate', "funnel_events"."context" ->> 'kind', "funnel_events"."context" ->> 'lastGate')`
        );
        expect(groupBy).toHaveBeenCalledTimes(1);
        const [condition] = onlyCall(where);
        const query = new PgDialect().sqlToQuery(condition as never);
        expect(query.sql).toBe(
            '("funnel_events"."occurred_at" >= $1 and "funnel_events"."occurred_at" < $2)'
        );
        expect(query.params).toEqual([
            FROM.toISOString(),
            TO_EXCLUSIVE.toISOString(),
        ]);
    });

    it('signupBreakdown은 signup_completed만 method×lastGate로 센다', async () => {
        const rows = [{ method: 'email', lastGate: 'timeframe', count: 3 }];
        const { db, select, where } = makeSelectDb(rows);
        const repo = new DrizzleFunnelEventRepository(db);
        await expect(repo.signupBreakdown(FROM, TO_EXCLUSIVE)).resolves.toEqual(
            rows
        );
        const [selection] = onlyCall(select) as [{ method: unknown }];
        expect(new PgDialect().sqlToQuery(selection.method as never).sql).toBe(
            `"funnel_events"."context" ->> 'method'`
        );
        const [condition] = onlyCall(where);
        const query = new PgDialect().sqlToQuery(condition as never);
        expect(query.sql).toBe(
            '("funnel_events"."event" = $1 and "funnel_events"."occurred_at" >= $2 and "funnel_events"."occurred_at" < $3)'
        );
        expect(query.params).toEqual([
            'signup_completed',
            FROM.toISOString(),
            TO_EXCLUSIVE.toISOString(),
        ]);
    });

    it('signupCohortRetention은 가입일+7~+13, +30~+36일 창의 방문으로 재방문을 판정한다', async () => {
        const rows = [{ week: '2026-09-28', signups: 10, d7: 4, d30: 2 }];
        const { db, execute } = makeExecuteDb(rows);
        await expect(
            new DrizzleFunnelEventRepository(db).signupCohortRetention(
                FROM,
                TO_EXCLUSIVE
            )
        ).resolves.toEqual(rows);
        const [query] = onlyCall(execute);
        const rendered = new PgDialect().sqlToQuery(query as never);
        const sqlText = rendered.sql.replace(/\s+/g, ' ');
        expect(sqlText).toContain(
            `(u.created_at at time zone 'Asia/Seoul')::date as signup_date from "users" u where u.created_at >= $1::timestamptz and u.created_at < $2::timestamptz`
        );
        expect(sqlText).toContain(
            `exists ( select 1 from "visitor_days" v where v.user_id = c.id and v."date" between c.signup_date + $3::int and c.signup_date + $4::int )`
        );
        expect(sqlText).toContain(
            `exists ( select 1 from "visitor_days" v where v.user_id = c.id and v."date" between c.signup_date + $5::int and c.signup_date + $6::int )`
        );
        expect(rendered.params).toEqual([
            FROM.toISOString(),
            TO_EXCLUSIVE.toISOString(),
            7,
            13,
            30,
            36,
        ]);
        // postgres-js는 raw sql 템플릿의 Date 파라미터를 Bind에서 거부한다.
        expect(rendered.params.some(param => param instanceof Date)).toBe(
            false
        );
    });
});
