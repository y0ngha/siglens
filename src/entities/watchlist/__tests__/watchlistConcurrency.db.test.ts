import { readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import { WATCHLIST_MAX_MEMBER } from '@/shared/config/watchlist';
import * as schema from '@/shared/db/schema';
import { DrizzleWatchlistRepository } from '../api';

vi.mock('server-only', () => ({}));

/**
 * 같은 회원의 `mergeSymbols`·`addWithinLimit`가 동시에 돌아도 저장 수가 `WATCHLIST_MAX_MEMBER`를
 * 넘지 않는지 진짜 Postgres에서 본다(TESTING.md#TE-55). 상한은 `users` 행 `FOR NO KEY UPDATE`
 * 잠금으로 지켜지는데, 모킹된 DB로는 이 직렬화가 보이지 않는다. `TEST_DATABASE_URL`이 없으면
 * 건너뛴다. 로컬 실행:
 *   docker compose -p <name> -f docker-compose.e2e.yml up -d --pull never postgres
 *   TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e yarn test .db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션(`watchlist_items`)을
 * 적용한 뒤 끝나면 스키마를 지운다. 잠금 대상인 `users`는 FK·잠금에 필요한 열만 둔 최소 테이블이다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `watchlist_concurrency_test_${process.pid}`;
const POOL_SIZE = 12;
const PRESEEDED = WATCHLIST_MAX_MEMBER - 10;
const MERGE_CALLS = 5;
const MERGE_BATCH = 12;
const ADD_CALLS = 6;

const migration = (file: string): string =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8');
const DDL: string[] = [
    'CREATE TABLE "users" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL)',
    ...migration('0043_watchlist_items.sql')
        .split('--> statement-breakpoint')
        .map(statement => statement.replace('"public"."users"', '"users"')),
];

const symbolOf = (prefix: string, index: number): string =>
    `${prefix}${String(index).padStart(3, '0')}`;

describe.skipIf(!URL)(
    'watchlist 동시 쓰기 상한이 진짜 Postgres에서 유지된다',
    () => {
        let admin: postgres.Sql;
        let client: postgres.Sql;
        let repo: DrizzleWatchlistRepository;

        beforeAll(async () => {
            const target = describeTarget(URL as string);
            if (!target.isLocal || target.viaTunnel) {
                throw new Error(
                    `refusing to run against a non-local database: ${target.host}`
                );
            }
            admin = postgres(URL as string, { max: 1 });
            await admin.unsafe(`CREATE SCHEMA "${SCHEMA}"`);
            // 동시성이 실제로 생기도록 커넥션을 여러 개 연다.
            client = postgres(URL as string, {
                max: POOL_SIZE,
                connection: { search_path: SCHEMA },
            });
            for (const statement of DDL) await client.unsafe(statement);
            // 풀 커넥션을 미리 열어 둔다 — 지연 연결이면 호출이 연결 수립에 직렬화돼 경합이 안 생긴다.
            await Promise.all(
                Array.from(
                    { length: POOL_SIZE },
                    () => client`SELECT pg_sleep(0.05)`
                )
            );
            repo = new DrizzleWatchlistRepository(drizzle(client, { schema }));
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        async function createMember(): Promise<string> {
            const [row] = await client<{ id: string }[]>`
                INSERT INTO users DEFAULT VALUES RETURNING id`;
            return row.id;
        }

        async function savedCount(userId: string): Promise<number> {
            const [row] = await client<{ value: number }[]>`
                SELECT count(*)::int AS value FROM watchlist_items
                WHERE user_id = ${userId}`;
            return row.value;
        }

        it('병합과 담기가 겹쳐도 상한을 넘기지 않고 남은 자리만큼만 채운다', async () => {
            const userId = await createMember();
            const seed = Array.from({ length: PRESEEDED }, (_, i) => ({
                symbol: symbolOf('SEED', i),
                companyName: null,
            }));
            await repo.mergeSymbols(userId, seed, WATCHLIST_MAX_MEMBER);

            const [merges, adds] = await Promise.all([
                Promise.all(
                    Array.from({ length: MERGE_CALLS }, (_, call) =>
                        repo.mergeSymbols(
                            userId,
                            Array.from({ length: MERGE_BATCH }, (_, i) => ({
                                symbol: symbolOf(`M${call}X`, i),
                                companyName: null,
                            })),
                            WATCHLIST_MAX_MEMBER
                        )
                    )
                ),
                Promise.all(
                    Array.from({ length: ADD_CALLS }, (_, i) =>
                        repo.addWithinLimit(
                            {
                                userId,
                                symbol: symbolOf('ADD', i),
                                companyName: null,
                            },
                            WATCHLIST_MAX_MEMBER
                        )
                    )
                ),
            ]);

            const mergedRows = merges.reduce((sum, m) => sum + m.added, 0);
            const addedRows = adds.filter(
                a => a.status === 'added' && a.created
            ).length;
            const total = await savedCount(userId);

            expect(total).toBeLessThanOrEqual(WATCHLIST_MAX_MEMBER);
            // 시도한 새 심볼이 남은 자리(10)보다 많으므로 정확히 상한까지 찬다.
            expect(total).toBe(WATCHLIST_MAX_MEMBER);
            // 호출이 보고한 삽입 수의 합이 실제 행 수와 일치한다(유실·이중 계상 없음).
            expect(PRESEEDED + mergedRows + addedRows).toBe(total);
        });

        it('이미 담긴 심볼의 동시 재담기는 상한에 걸리지 않고 행을 늘리지 않는다', async () => {
            const userId = await createMember();
            const full = Array.from(
                { length: WATCHLIST_MAX_MEMBER },
                (_, i) => ({
                    symbol: symbolOf('FULL', i),
                    companyName: null,
                })
            );
            await repo.mergeSymbols(userId, full, WATCHLIST_MAX_MEMBER);

            const results = await Promise.all(
                full
                    .slice(0, ADD_CALLS)
                    .map(candidate =>
                        repo.addWithinLimit(
                            { userId, ...candidate },
                            WATCHLIST_MAX_MEMBER
                        )
                    )
            );

            expect(results.every(r => r.status === 'added' && !r.created)).toBe(
                true
            );
            expect(await savedCount(userId)).toBe(WATCHLIST_MAX_MEMBER);
        });
    }
);
