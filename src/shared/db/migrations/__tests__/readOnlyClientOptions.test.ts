import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { describeTarget } from '../../../../../db/scripts/lib/dbTarget';
import { readOnlyClientOptions } from '@/shared/db/migrations/readOnlyClientOptions';

describe('readOnlyClientOptions', () => {
    it('asks the server for a read-only session', () => {
        expect(readOnlyClientOptions().connection).toEqual({
            default_transaction_read_only: true,
        });
    });

    it('is what postgres-js resolves and sends in the startup message', () => {
        // 연결하지 않는다(postgres-js는 첫 쿼리 때 연결한다).
        const sql = postgres(
            'postgres://u:p@127.0.0.1:1/x',
            readOnlyClientOptions()
        );
        const sent = Object.entries(sql.options.connection).map(
            ([key, value]) => `${key}=${String(value)}`
        );
        expect(sent).toContain('default_transaction_read_only=true');
        expect(sql.options.max).toBe(1);
        return sql.end();
    });
});

/**
 * 서버가 실제로 쓰기를 거부하는지는 진짜 Postgres에서만 보인다. `TEST_DATABASE_URL`이 없으면 건너뛴다.
 * 로컬 실행: `docker run -d --name <unique> -e POSTGRES_PASSWORD=x -p 127.0.0.1:<port>:5432 postgres:17-alpine`
 * 접속 대상이 로컬이 아니면 거부한다. 쓰기는 모두 거부되므로 DB에는 아무것도 남지 않는다.
 */
const URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL)('read-only session against a real Postgres', () => {
    const sql = postgres(URL ?? '', readOnlyClientOptions());

    afterAll(() => sql.end());

    it('targets a local database only', () => {
        expect(describeTarget(URL ?? '').isLocal).toBe(true);
    });

    it('reports transaction_read_only = on', async () => {
        const [row] = await sql<{ transaction_read_only: string }[]>`
            SHOW transaction_read_only
        `;
        expect(row?.transaction_read_only).toBe('on');
    });

    it('rejects a write with SQLSTATE 25006', async () => {
        await expect(
            sql`CREATE TABLE read_only_probe (id int)`
        ).rejects.toMatchObject({ code: '25006' });
    });
});
