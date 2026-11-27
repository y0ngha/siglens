import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import { DrizzleUserRepository } from '../api';

vi.mock('server-only', () => ({}));

/**
 * 이메일 조회가 대소문자·공백을 무시하고 해당 사용자 행만 돌려주는지 진짜 Postgres로 본다
 * (TESTING.md#TE-55). 모킹된 DB로는 WHERE가 실제로 어느 행을 고르는지 보이지 않는다.
 * `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --rm --name <unique> -e POSTGRES_PASSWORD=x -e POSTGRES_USER=siglens -e POSTGRES_DB=siglens_test \
 *     -p 127.0.0.1:55432:5432 --pull never postgres:17
 *   TEST_DATABASE_URL=postgres://siglens:x@127.0.0.1:55432/siglens_test yarn test findByEmail.db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 필요한 열만 둔 `users`를 만든 뒤 끝나면 지운다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `find_by_email_test_${process.pid}`;

describe.skipIf(!URL)(
    'findByEmail이 진짜 Postgres에서 이메일로 사용자를 찾는다',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: 2,
            connection: { search_path: SCHEMA },
        });
        const repo = new DrizzleUserRepository(drizzle(client, { schema }));

        async function createUser(email: string): Promise<string> {
            const [row] = await client<{ id: string }[]>`
            INSERT INTO users (email) VALUES (${email}) RETURNING id`;
            return row.id;
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
            "email" varchar(255) NOT NULL UNIQUE,
            "name" text,
            "avatar_url" text,
            "tier" text DEFAULT 'member' NOT NULL,
            "email_verified" boolean DEFAULT false NOT NULL,
            "password_hash" text,
            "created_at" timestamptz DEFAULT now() NOT NULL,
            "updated_at" timestamptz DEFAULT now() NOT NULL)`);
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        it('대소문자가 섞이고 앞뒤 공백이 있는 입력으로도 저장된 소문자 이메일의 사용자를 찾는다', async () => {
            const id = await createUser('foo@gmail.com');

            const found = await repo.findByEmail('  Foo@Gmail.COM ');

            expect(found?.id).toBe(id);
            expect(found?.email).toBe('foo@gmail.com');
        });

        it('다른 사용자의 행은 돌려주지 않는다', async () => {
            await createUser('alice@example.com');
            const bobId = await createUser('bob@example.com');

            const found = await repo.findByEmail('BOB@example.com');

            expect(found?.id).toBe(bobId);
        });

        it('일치하는 이메일이 없으면 null이다', async () => {
            await createUser('present@example.com');

            await expect(
                repo.findByEmail('missing@example.com')
            ).resolves.toBeNull();
        });
    }
);
