import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import { DrizzleUserRepository } from '../api';

vi.mock('server-only', () => ({}));

/**
 * 비밀번호 재설정이 그 사용자의 세션만, 해시 교체와 같은 트랜잭션에서 지우는지 진짜 Postgres로 본다
 * (TESTING.md#TE-55). 모킹된 DB로는 DELETE의 WHERE가 어느 행을 지우는지, 중간 실패 때 롤백되는지 보이지 않는다.
 * `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --rm --name <unique> -e POSTGRES_PASSWORD=x -e POSTGRES_USER=siglens -e POSTGRES_DB=siglens_test \
 *     -p 127.0.0.1:55432:5432 --pull never postgres:17
 *   TEST_DATABASE_URL=postgres://siglens:x@127.0.0.1:55432/siglens_test yarn test resetPasswordRevokingSessions.db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 필요한 열만 둔 `users`·`sessions`를 만든 뒤 끝나면 지운다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `reset_password_sessions_test_${process.pid}`;
const FUTURE = '2099-01-01T00:00:00Z';

describe.skipIf(!URL)(
    '비밀번호 재설정이 진짜 Postgres에서 대상 사용자의 세션만 트랜잭션으로 지운다',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: 4,
            connection: { search_path: SCHEMA },
        });
        const repo = new DrizzleUserRepository(drizzle(client, { schema }));

        async function createUser(): Promise<string> {
            const [row] = await client<{ id: string }[]>`
                INSERT INTO users (password_hash) VALUES ('old-hash') RETURNING id`;
            return row.id;
        }

        async function addSessions(userId: string, count: number) {
            await Promise.all(
                Array.from(
                    { length: count },
                    () =>
                        client`INSERT INTO sessions (user_id, expires_at)
                            VALUES (${userId}, ${FUTURE})`
                )
            );
        }

        async function sessionCount(userId: string): Promise<number> {
            const [row] = await client<{ n: number }[]>`
                SELECT count(*)::int AS n FROM sessions WHERE user_id = ${userId}`;
            return row.n;
        }

        async function hashOf(userId: string): Promise<string> {
            const [row] = await client<{ password_hash: string }[]>`
                SELECT password_hash FROM users WHERE id = ${userId}`;
            return row.password_hash;
        }

        beforeAll(async () => {
            const target = describeTarget(URL as string);
            if (!target.isLocal || target.viaTunnel) {
                throw new Error(
                    `refusing to run against a non-local database: ${target.host}`
                );
            }
            await admin.unsafe(`CREATE SCHEMA "${SCHEMA}"`);
            await client.unsafe(`CREATE TABLE "users" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "password_hash" text,
                "updated_at" timestamptz DEFAULT now() NOT NULL)`);
            await client.unsafe(`CREATE TABLE "sessions" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "expires_at" timestamptz NOT NULL,
                "created_at" timestamptz DEFAULT now() NOT NULL)`);
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        it('대상 사용자의 세션만 모두 지우고 해시를 바꾼다', async () => {
            const target = await createUser();
            const other = await createUser();
            await addSessions(target, 3);
            await addSessions(other, 2);

            await expect(
                repo.resetPasswordRevokingSessions(target, 'new-hash')
            ).resolves.toBe(true);

            expect(await hashOf(target)).toBe('new-hash');
            expect(await sessionCount(target)).toBe(0);
            expect(await hashOf(other)).toBe('old-hash');
            expect(await sessionCount(other)).toBe(2);
        });

        it('일치하는 사용자 행이 없으면 false이고 아무 세션도 지우지 않는다', async () => {
            const other = await createUser();
            await addSessions(other, 2);

            await expect(
                repo.resetPasswordRevokingSessions(
                    '00000000-0000-4000-8000-000000000000',
                    'new-hash'
                )
            ).resolves.toBe(false);

            expect(await sessionCount(other)).toBe(2);
        });

        it('세션 삭제가 실패하면 해시 교체도 롤백된다', async () => {
            const target = await createUser();
            await addSessions(target, 2);
            await client.unsafe(`
                CREATE FUNCTION fail_session_delete() RETURNS trigger AS $$
                BEGIN RAISE EXCEPTION 'session delete blocked'; END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER block_session_delete BEFORE DELETE ON sessions
                FOR EACH ROW EXECUTE FUNCTION fail_session_delete();`);
            try {
                // Drizzle이 원인 에러를 `cause`에 감싼다.
                await expect(
                    repo.resetPasswordRevokingSessions(target, 'new-hash')
                ).rejects.toMatchObject({
                    cause: {
                        message: expect.stringContaining(
                            'session delete blocked'
                        ),
                    },
                });

                expect(await hashOf(target)).toBe('old-hash');
                expect(await sessionCount(target)).toBe(2);
            } finally {
                await client.unsafe(
                    'DROP TRIGGER block_session_delete ON sessions'
                );
            }
        });
    }
);
