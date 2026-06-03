import postgres from 'postgres';

/**
 * Lightweight notice seeder for E2E tests.
 *
 * Uses `postgres` directly (not the app's getDatabaseClient) so we avoid
 * importing `server-only` modules from within the Playwright test-runner
 * process (Playwright compiles specs without the e2e tsconfig stub that
 * maps `server-only` to a no-op).
 *
 * DATABASE_URL defaults to the local E2E Postgres defined in `.env.e2e`
 * and injected by `run-e2e.sh` / `run_with_e2e_env`. Each seeder instance
 * opens a minimal pool and callers must call `.end()` when done.
 */

const DB_URL =
    process.env.DATABASE_URL ??
    'postgres://siglens:siglens@localhost:5433/siglens_e2e';

export interface SeedNoticeInput {
    id: string;
    title: string;
    body: string;
    pathPattern?: string | null;
    /** Defaults to 0. Higher = shown first. */
    priority?: number;
    isActive?: boolean;
    /** ISO string or null — null means no window constraint. */
    startsAt?: string | null;
    endsAt?: string | null;
}

/**
 * Insert a batch of notice rows and return a cleanup function that DELETEs
 * them by id. Both operations share a single short-lived connection so there
 * is no lingering pool.
 *
 * Usage in specs:
 * ```ts
 * let cleanup: () => Promise<void>;
 * test.beforeEach(async () => {
 *     cleanup = await seedNotices([{ id: '...', title: '...', body: '...' }]);
 * });
 * test.afterEach(async () => cleanup?.());
 * ```
 */
export async function seedNotices(
    rows: SeedNoticeInput[]
): Promise<() => Promise<void>> {
    if (rows.length === 0) return async () => {};

    const sql = postgres(DB_URL, { max: 1 });

    // postgres.js 표준 파라미터 바인딩으로 행마다 INSERT한다. 테스트는 보통
    // 1~2행만 시딩하므로 루프 비용은 무시할 만하고, jsonb_to_recordset 방식
    // 대비 타입/null 처리가 명확하다.
    for (const r of rows) {
        await sql`
            INSERT INTO notices (id, title, body, path_pattern, priority, is_active, starts_at, ends_at)
            VALUES (
                ${r.id}::uuid,
                ${r.title},
                ${r.body},
                ${r.pathPattern ?? null},
                ${r.priority ?? 0},
                ${r.isActive ?? true},
                ${(r.startsAt ?? null) as string | null}::timestamptz,
                ${(r.endsAt ?? null) as string | null}::timestamptz
            )
            ON CONFLICT (id) DO NOTHING
        `;
    }

    const ids = rows.map(r => r.id);

    return async () => {
        try {
            await sql`DELETE FROM notices WHERE id = ANY(${ids}::uuid[])`;
        } finally {
            await sql.end();
        }
    };
}
