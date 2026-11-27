import { readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import type { FunnelEventRecord } from '../api';
import { DrizzleFunnelEventRepository } from '../api';

vi.mock('server-only', () => ({}));

/**
 * 공유 이벤트 집계를 진짜 Postgres에서 본다(TESTING.md#TE-55). `context ->> 'shareKind'` 그룹과
 * `count(distinct visitor_hash)`가 모킹된 DB로는 보이지 않는다. `TEST_DATABASE_URL`이 없으면
 * 건너뛴다. 로컬 실행:
 *   docker compose -p <name> -f docker-compose.e2e.yml up -d --pull never postgres
 *   TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e yarn test .db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션의 `funnel_events`를 적용한 뒤
 * 끝나면 스키마를 지운다. FK 대상인 `users`는 최소 테이블이다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `share_event_counts_test_${process.pid}`;

const DDL: string[] = [
    'CREATE TABLE "users" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL)',
    ...readFileSync(
        path.join(process.cwd(), 'drizzle', '0042_funnel_events.sql'),
        'utf8'
    )
        .split('--> statement-breakpoint')
        .map(statement => statement.replace('"public"."users"', '"users"'))
        // visitor_days는 이 테스트에 없다.
        .filter(statement => !statement.includes('"visitor_days"')),
];

const FROM = new Date('2026-11-01T00:00:00+09:00');
const TO_EXCLUSIVE = new Date('2026-12-01T00:00:00+09:00');

describe.skipIf(!URL)('공유 이벤트 집계가 진짜 Postgres에서 맞다', () => {
    let admin: postgres.Sql;
    let client: postgres.Sql;
    let repo: DrizzleFunnelEventRepository;

    const record = (
        visitorHash: string,
        event: FunnelEventRecord['event'],
        context: FunnelEventRecord['context']
    ) => repo.record({ visitorHash, userId: null, event, context });

    beforeAll(async () => {
        const target = describeTarget(URL as string);
        if (!target.isLocal || target.viaTunnel) {
            throw new Error(
                `refusing to run against a non-local database: ${target.host}`
            );
        }
        admin = postgres(URL as string, { max: 1 });
        await admin.unsafe(`CREATE SCHEMA "${SCHEMA}"`);
        client = postgres(URL as string, {
            max: 2,
            connection: { search_path: SCHEMA },
        });
        for (const statement of DDL) await client.unsafe(statement);
        repo = new DrizzleFunnelEventRepository(drizzle(client, { schema }));
    });

    afterAll(async () => {
        await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
        await client?.end();
        await admin?.end();
    });

    it('이벤트 × shareKind별 건수와 고유 방문자 수를 세고 다른 이벤트와 기간 밖은 뺀다', async () => {
        await record('a', 'share_created', { shareKind: 'chart' });
        await record('a', 'share_created', { shareKind: 'chart' });
        await record('b', 'share_created', { shareKind: 'overall' });
        await record('a', 'share_opened', { shareKind: 'chart' });
        await record('b', 'share_opened', { shareKind: 'chart' });
        await record('c', 'share_opened', { shareKind: 'chart' });
        await record('c', 'gate_clicked', { gate: 'timeframe' });
        // 기간 밖
        await client`
            INSERT INTO funnel_events (visitor_hash, event, context, occurred_at)
            VALUES ('z', 'share_opened', '{"shareKind":"chart"}'::jsonb, '2026-10-31T00:00:00+09:00')`;

        const rows = await repo.shareEventCounts(FROM, TO_EXCLUSIVE);
        const sorted = [...rows].sort(
            (x, y) =>
                x.event.localeCompare(y.event) ||
                (x.shareKind ?? '').localeCompare(y.shareKind ?? '')
        );
        expect(sorted).toEqual([
            {
                event: 'share_created',
                shareKind: 'chart',
                count: 2,
                visitors: 1,
            },
            {
                event: 'share_created',
                shareKind: 'overall',
                count: 1,
                visitors: 1,
            },
            {
                event: 'share_opened',
                shareKind: 'chart',
                count: 3,
                visitors: 3,
            },
        ]);
    });
});
