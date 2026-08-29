import postgres from 'postgres';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot/model';

/**
 * Lightweight `seo_analysis_snapshots` seeder for E2E tests.
 *
 * Uses `postgres` directly (not the app's getDatabaseClient / Drizzle
 * repository), mirroring `noticeSeeder.ts` — avoids importing `server-only`
 * modules from within the Playwright test-runner process (Playwright compiles
 * specs without the e2e tsconfig stub that maps `server-only` to a no-op).
 *
 * DATABASE_URL defaults to the local E2E Postgres defined in `.env.e2e` and
 * injected by `run-e2e.sh` / `run_with_e2e_env`. Each seed call opens a
 * minimal short-lived connection and callers must invoke the returned cleanup.
 *
 * IMPORTANT — this writes DIRECTLY to Postgres and does NOT call
 * `revalidateTag('seo-snapshot:{SYMBOL}')` the way the real pre-warm cron does
 * (`src/app/api/cron/seo-prewarm/runPrewarmBatch.ts`). The `[symbol]` page
 * reads snapshots through `getSeoSnapshotsStatic`, which wraps the DB read in
 * `unstable_cache` (tags `symbol:{SYMBOL}` + `seo-snapshot:{SYMBOL}`,
 * revalidate=21600s) — so if a symbol's page (or its snapshot data cache) was
 * already rendered/cached before this seeder runs, the seeded row will NOT be
 * visible until that cache naturally expires. Callers MUST seed a symbol that
 * has never been requested anywhere else in the suite (see
 * `seo-snapshot.spec.ts` for the chosen approach) rather than relying on this
 * helper to bust any cache.
 */

const DB_URL =
    process.env.DATABASE_URL ??
    'postgres://siglens:siglens@localhost:5433/siglens_e2e';

export interface SeedSeoSnapshotInput {
    symbol: string;
    tab: SeoSnapshotTab;
    /** Stored as `jsonb`. Serialized with `JSON.stringify` + an explicit `::jsonb` cast. */
    content: unknown;
    /** 기본값 `ko` — 접두사 없는 경로가 읽는 행이다. */
    locale?: 'ko' | 'en' | 'ja' | 'zh';
    model: string;
    generatedAt: Date;
}

/**
 * Upsert a single `seo_analysis_snapshots` row (on the `(symbol, tab, locale)`
 * unique index, matching `DrizzleSeoSnapshotRepository.upsert`) and return a
 * cleanup function that deletes it.
 *
 * ⚠️ 타깃이 3열인 것이 중요하다. 마이그레이션 0030이 구
 * `(symbol, tab)` unique를 지우므로 2열 타깃은 42P10(`no unique or exclusion
 * constraint matching the ON CONFLICT specification`)으로 죽는다. 앱의 쓰기
 * 경로도 같은 이유로 스위치와 무관하게 3열을 쓴다
 * (`entities/seo-snapshot/api.ts` 주석, 회귀 가드 `upsertSql.test.ts`). Symbol is upper-cased to match the app's write
 * path (`DrizzleSeoSnapshotRepository.upsert` upper-cases too).
 *
 * Usage in specs:
 * ```ts
 * let cleanup: () => Promise<void>;
 * test.beforeAll(async () => {
 *     cleanup = await seedSeoSnapshot({ symbol: 'SEOQAX', tab: 'technical', ... });
 * });
 * test.afterAll(async () => cleanup?.());
 * ```
 */
export async function seedSeoSnapshot(
    input: SeedSeoSnapshotInput
): Promise<() => Promise<void>> {
    const symbol = input.symbol.toUpperCase();
    // 스펙은 접두사 없는 경로(`/SEOQAX/...`)로 이동하므로 기본 로케일 행이다.
    const locale = input.locale ?? 'ko';
    const sql = postgres(DB_URL, { max: 1 });

    await sql`
        INSERT INTO seo_analysis_snapshots (symbol, tab, locale, content, model, generated_at, updated_at)
        VALUES (
            ${symbol},
            ${input.tab},
            ${locale}::content_locale,
            ${JSON.stringify(input.content)}::jsonb,
            ${input.model},
            ${input.generatedAt.toISOString()}::timestamptz,
            now()
        )
        ON CONFLICT (symbol, tab, locale) DO UPDATE SET
            content = EXCLUDED.content,
            model = EXCLUDED.model,
            generated_at = EXCLUDED.generated_at,
            updated_at = now()
    `;

    return async () => {
        try {
            await sql`
                DELETE FROM seo_analysis_snapshots
                WHERE symbol = ${symbol}
                  AND tab = ${input.tab}
                  AND locale = ${locale}::content_locale
            `;
        } finally {
            await sql.end();
        }
    };
}
