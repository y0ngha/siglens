import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';

/**
 * `0060_backfill_landing_path_identifiers.sql`가 옛 행의 공유 링크 id·AI 대화 id를 지우고 나머지는
 * 건드리지 않는지, 두 번 돌려도 같은지 진짜 Postgres에서 본다(TESTING.md#TE-55). 정규식 치환은 모킹으로
 * 검증할 수 없다. `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --name <name> -e POSTGRES_USER=siglens -e POSTGRES_PASSWORD=siglens -e POSTGRES_DB=siglens_e2e -p 127.0.0.1:5441:5432 postgres:17
 *   TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5441/siglens_e2e yarn test .db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 `visitor_days`만 만든 뒤 끝나면 지운다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `landing_backfill_test_${process.pid}`;

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.trim())
        .filter(statement => statement !== '');

const UUID = '9f1d2c3b-4a5e-4f60-8a7b-0c1d2e3f4a5b';
const BACKFILL = migration('0060_backfill_landing_path_identifiers.sql').filter(
    statement => /^(UPDATE|--)/m.test(statement)
);

/** [입력 경로, 백필 뒤 경로]. */
const CASES: ReadonlyArray<readonly [string, string]> = [
    ['/share/SECRET-ID', '/share/:id'],
    ['/en/share/SECRET-ID', '/en/share/:id'],
    ['/ja/share/SECRET-ID/', '/ja/share/:id'],
    ['/zh/share/SECRET-ID/extra/deeper', '/zh/share/:id'],
    [`/c/${UUID}`, '/c/:id'],
    [`/en/c/${UUID}`, '/en/c/:id'],
    [`/c/${UUID.toUpperCase()}/more`, '/c/:id'],
    // 이미 접힌 경로와 무관한 경로는 그대로.
    ['/share/:id', '/share/:id'],
    ['/en/share/:id', '/en/share/:id'],
    ['/c/:id', '/c/:id'],
    ['/c', '/c'],
    ['/C', '/C'],
    ['/c/news', '/c/news'],
    ['/c/overall', '/c/overall'],
    ['/c/not-a-uuid', '/c/not-a-uuid'],
    ['/AAPL', '/AAPL'],
    ['/ko/AAPL/news', '/ko/AAPL/news'],
    ['/share', '/share'],
    ['/sharex/abc', '/sharex/abc'],
    ['/guide/howto/rsi', '/guide/howto/rsi'],
    ['/lp/stock-analysis', '/lp/stock-analysis'],
    ['/', '/'],
];

describe.skipIf(!URL)('landing_path 백필이 진짜 Postgres에서 맞다', () => {
    let admin: postgres.Sql;
    let client: postgres.Sql;

    async function pathsByHash(): Promise<Map<string, string | null>> {
        const rows = await client<
            { visitor_hash: string; landing_path: string | null }[]
        >`SELECT visitor_hash, landing_path FROM visitor_days`;
        return new Map(rows.map(r => [r.visitor_hash, r.landing_path]));
    }

    async function runBackfill(): Promise<void> {
        for (const statement of BACKFILL) await client.unsafe(statement);
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
            max: 2,
            connection: { search_path: SCHEMA },
        });
        await client.unsafe(
            `CREATE TABLE "visitor_days" ("visitor_hash" text NOT NULL, "date" date NOT NULL, "landing_path" text, PRIMARY KEY ("date","visitor_hash"))`
        );
        const rows = [
            ...CASES.map(([input], i) => ({
                visitor_hash: `case-${i}`,
                landing_path: input,
            })),
            { visitor_hash: 'null-path', landing_path: null },
        ];
        for (const row of rows) {
            await client`INSERT INTO visitor_days (visitor_hash, date, landing_path)
                VALUES (${row.visitor_hash}, '2026-11-20', ${row.landing_path})`;
        }
    });

    afterAll(async () => {
        await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
        await client?.end();
        await admin?.end();
    });

    it('마이그레이션은 UPDATE 두 개뿐이다', () => {
        expect(BACKFILL).toHaveLength(2);
        for (const statement of BACKFILL) expect(statement).toMatch(/UPDATE/);
    });

    it('공유·대화 id를 접고 나머지 경로와 NULL은 그대로 둔다', async () => {
        await runBackfill();
        const after = await pathsByHash();
        CASES.forEach(([input, expected], i) => {
            expect(after.get(`case-${i}`), input).toBe(expected);
        });
        expect(after.get('null-path')).toBeNull();
        expect(JSON.stringify([...after.values()])).not.toContain('SECRET');
        expect(JSON.stringify([...after.values()])).not.toContain(UUID);
    });

    it('두 번 돌려도 같은 결과다(멱등)', async () => {
        const once = await pathsByHash();
        await runBackfill();
        expect(await pathsByHash()).toEqual(once);
    });
});
