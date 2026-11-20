import { readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import { DrizzleVisitorRepository, type VisitorDayRecord } from '../api';

vi.mock('server-only', () => ({}));

/**
 * 방문 이력 구간값의 적재와 리포트 쿼리를 진짜 Postgres에서 본다(TESTING.md#TE-55). 모킹된 DB로는
 * `ON CONFLICT`가 첫 행을 지키는지, `count(*) filter`와 날짜 이동 범위가 맞는지 보이지 않는다.
 * `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker compose -p <name> -f docker-compose.e2e.yml up -d --pull never postgres
 *   TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e yarn test .db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션의 `visitor_days` 문장을
 * 적용한 뒤 끝나면 스키마를 지운다. FK 대상인 `users`는 최소 테이블이다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `visitor_report_test_${process.pid}`;

const migration = (file: string): string =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8');
const statementsOf = (file: string): string[] =>
    migration(file)
        .split('--> statement-breakpoint')
        .map(statement => statement.replace('"public"."users"', '"users"'));

const DDL: string[] = [
    'CREATE TABLE "users" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL)',
    ...statementsOf('0032_medical_iron_patriot.sql'),
    ...statementsOf('0034_red_pyro.sql'),
    // 0042는 funnel_events도 만든다 — visitor_days를 건드리는 문장만 쓴다.
    ...statementsOf('0042_funnel_events.sql').filter(statement =>
        statement.includes('"visitor_days"')
    ),
    ...statementsOf('0053_visitor_entry_source.sql'),
    ...statementsOf('0059_visitor_visit_signals.sql'),
];

let hashSeq = 0;
function visit(overrides: Partial<VisitorDayRecord>): VisitorDayRecord {
    hashSeq += 1;
    return {
        visitorHash: `hash-${hashSeq}`,
        date: '2026-10-21',
        userAgent: null,
        country: null,
        landingPath: null,
        entrySource: null,
        landingSite: 'main',
        firstVisitBucket: null,
        lastVisitBucket: null,
        visitDaysBucket: null,
        returnWindow: null,
        userId: null,
        ...overrides,
    };
}

describe.skipIf(!URL)(
    '방문 이력 구간값이 진짜 Postgres에서 적재·집계된다',
    () => {
        let admin: postgres.Sql;
        let client: postgres.Sql;
        let repo: DrizzleVisitorRepository;

        async function seed(rows: readonly VisitorDayRecord[]): Promise<void> {
            await Promise.all(rows.map(row => repo.recordVisit(row)));
        }

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
                max: 4,
                connection: { search_path: SCHEMA },
            });
            for (const statement of DDL) await client.unsafe(statement);
            repo = new DrizzleVisitorRepository(drizzle(client, { schema }));
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        it('같은 (날짜, 해시)의 두 번째 기록은 첫 행의 출처·사이트·구간값을 바꾸지 않는다', async () => {
            const first = visit({
                visitorHash: 'dup-hash',
                date: '2026-01-05',
                entrySource: 'google',
                landingSite: 'main',
                firstVisitBucket: 'new',
                lastVisitBucket: 'none',
                visitDaysBucket: 'n1',
                returnWindow: null,
            });
            await repo.recordVisit(first);
            await repo.recordVisit({
                ...first,
                entrySource: 'paid',
                landingSite: 'ai',
                firstVisitBucket: 'd7_13',
                lastVisitBucket: 'd7_13',
                visitDaysBucket: 'n2',
                returnWindow: 'd7',
            });

            const rows = await client`
            SELECT entry_source, landing_site, first_visit_bucket,
                   last_visit_bucket, visit_days_bucket, return_window
            FROM visitor_days WHERE visitor_hash = 'dup-hash'`;
            expect(rows).toHaveLength(1);
            expect(rows[0]).toEqual({
                entry_source: 'google',
                landing_site: 'main',
                first_visit_bucket: 'new',
                last_visit_bucket: 'none',
                visit_days_bucket: 'n1',
                return_window: null,
            });
        });

        it('entrySourceBySite는 (사이트, 출처)별로 세고 새 방문·재방문은 구간값 행만 나눈다', async () => {
            const base = { date: '2026-10-21' };
            await seed([
                visit({
                    ...base,
                    entrySource: 'paid',
                    landingSite: 'main',
                    firstVisitBucket: 'new',
                }),
                visit({
                    ...base,
                    date: '2026-10-22',
                    entrySource: 'paid',
                    landingSite: 'main',
                    firstVisitBucket: 'new',
                }),
                visit({
                    ...base,
                    date: '2026-10-23',
                    entrySource: 'paid',
                    landingSite: 'main',
                    firstVisitBucket: 'd1_6',
                }),
                visit({
                    ...base,
                    entrySource: null,
                    landingSite: 'ai',
                    firstVisitBucket: 'new',
                }),
                visit({ ...base, entrySource: 'google', landingSite: null }),
                visit({ ...base, entrySource: 'google', landingSite: null }),
                // 기준일 이전 행은 빠진다.
                visit({
                    date: '2026-10-20',
                    entrySource: 'paid',
                    landingSite: 'main',
                    firstVisitBucket: 'new',
                }),
            ]);

            const rows = await repo.entrySourceBySite('2026-10-21');
            expect(rows).toEqual([
                {
                    site: 'main',
                    entrySource: 'paid',
                    count: 3,
                    newVisitors: 2,
                    returning: 1,
                },
                {
                    site: null,
                    entrySource: 'google',
                    count: 2,
                    newVisitors: 0,
                    returning: 0,
                },
                {
                    site: 'ai',
                    entrySource: null,
                    count: 1,
                    newVisitors: 1,
                    returning: 0,
                },
            ]);
        });

        it('visitDaysDistribution은 구간값이 있는 행만 (사이트, 구간)별로 센다', async () => {
            const date = '2027-02-10';
            await seed([
                visit({ date, landingSite: 'main', visitDaysBucket: 'n1' }),
                visit({ date, landingSite: 'main', visitDaysBucket: 'n1' }),
                visit({ date, landingSite: 'main', visitDaysBucket: 'n2' }),
                visit({ date, landingSite: 'ai', visitDaysBucket: 'n1' }),
                visit({ date, landingSite: null, visitDaysBucket: 'n20_plus' }),
                // 구간값 없는 행과 기준일 이전 행은 빠진다.
                visit({ date, landingSite: 'main', visitDaysBucket: null }),
                visit({
                    date: '2027-02-09',
                    landingSite: 'main',
                    visitDaysBucket: 'n1',
                }),
            ]);

            await expect(repo.visitDaysDistribution(date)).resolves.toEqual([
                { site: 'ai', bucket: 'n1', count: 1 },
                { site: 'main', bucket: 'n1', count: 2 },
                { site: 'main', bucket: 'n2', count: 1 },
                { site: null, bucket: 'n20_plus', count: 1 },
            ]);
        });

        it('returnWindowCounts는 창 중앙값만큼 옮긴 범위 안의 hit만 세고 양 끝 하루 밖은 뺀다', async () => {
            const hit = (
                date: string,
                returnWindow: 'd1' | 'd7' | 'd30',
                firstVisitBucket: 'd1_6' | 'd7_13' | 'd30_89',
                landingSite: 'main' | 'ai' = 'main'
            ) =>
                visit({
                    date,
                    landingSite,
                    firstVisitBucket,
                    returnWindow,
                });
            const fresh = (date: string, landingSite: 'main' | 'ai' = 'main') =>
                visit({ date, landingSite, firstVisitBucket: 'new' });

            const copies = <T>(count: number, make: () => T): T[] =>
                Array.from({ length: count }, make);

            // 코호트(첫 방문일) 범위: 2026-09-01 ~ 2026-09-07
            await seed([
                // 새 방문: 범위 안 3건, 바깥 2건
                fresh('2026-09-01'),
                fresh('2026-09-04'),
                fresh('2026-09-07'),
                fresh('2026-08-31'),
                fresh('2026-09-08'),
                // 창마다 양 끝 안쪽 2건, 하루 아래 밖 2건, 하루 위 밖 3건 — 밖의 행 수를 서로 다르게 해
                // 이동 일수가 어느 쪽으로 틀어져도 합이 우연히 같아지지 않게 한다.
                // D1: 09-02 ~ 09-08
                hit('2026-09-02', 'd1', 'd1_6'),
                hit('2026-09-08', 'd1', 'd1_6'),
                ...copies(2, () => hit('2026-09-01', 'd1', 'd1_6')),
                ...copies(3, () => hit('2026-09-09', 'd1', 'd1_6')),
                // D7: 09-11 ~ 09-17
                hit('2026-09-11', 'd7', 'd7_13'),
                hit('2026-09-17', 'd7', 'd7_13'),
                ...copies(2, () => hit('2026-09-10', 'd7', 'd7_13')),
                ...copies(3, () => hit('2026-09-18', 'd7', 'd7_13')),
                // D30: 10-04 ~ 10-10
                hit('2026-10-04', 'd30', 'd30_89'),
                hit('2026-10-10', 'd30', 'd30_89'),
                ...copies(2, () => hit('2026-10-03', 'd30', 'd30_89')),
                ...copies(3, () => hit('2026-10-11', 'd30', 'd30_89')),
                // 구간값(first_visit_bucket)이 없는 행은 return_window가 있어도 무시한다.
                visit({
                    date: '2026-09-03',
                    landingSite: 'main',
                    firstVisitBucket: null,
                    returnWindow: 'd1',
                }),
                // 다른 사이트
                fresh('2026-09-02', 'ai'),
                hit('2026-09-03', 'd1', 'd1_6', 'ai'),
            ]);

            const rows = await repo.returnWindowCounts(
                '2026-09-01',
                '2026-09-07'
            );
            expect(rows).toEqual([
                { site: 'ai', newVisitors: 1, d1: 1, d7: 0, d30: 0 },
                { site: 'main', newVisitors: 3, d1: 2, d7: 2, d30: 2 },
            ]);
        });
    }
);
