/**
 * One-time SEED script: analyze all current Medium+ announced unanalyzed
 * `economic_calendar` rows via core `runEconomicEventAnalysis` (direct, non-queued).
 *
 * Usage (after SP-A backfill):
 *   yarn db:seed:calendar-analysis          # 기본 US
 *   CALENDAR_COUNTRY=KR yarn db:seed:calendar-analysis
 *
 * Requires: DIRECT_DATABASE_URL (or DATABASE_URL) + core LLM env vars.
 * Does NOT run `yarn db:migrate` — the SP-D migration (0020_*.sql) must be
 * applied separately before running this script.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { runEconomicEventAnalysis } from '@y0ngha/siglens-core';

import { DrizzleEconomicCalendarRepository } from '../src/entities/economy/api/economicCalendarRepository';
import {
    CALENDAR_ANALYZED_IMPACTS,
    CALENDAR_COUNTRY,
    CALENDAR_REGION_LABEL,
    isCalendarCountry,
} from '../src/entities/economy/lib/economyCalendarConstants';
import type { SiglensDatabase } from '../src/shared/db/types';

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DIRECT_DATABASE_URL (or DATABASE_URL) env var required');
}

/** 동시 분석 상한 — seed는 일괄이라 작게 잡아 LLM 큐 압박을 피한다. */
const SEED_PARALLEL_LIMIT = 4;

/**
 * 어느 국가를 시드할지. 테이블이 US·KR을 `country` 컬럼으로 나눠 쓰므로 이 값이
 * 스캔 범위와 프롬프트의 `region` 양쪽을 정한다.
 *
 * 저장은 `analyzed_at IS NULL` 가드로 **한 번만** 일어난다(재분석 경로 없음).
 * 국가를 틀리면 한국은행 결정이 연준 맥락으로 서술된 채 영구히 굳으므로,
 * 알 수 없는 값이면 조용히 미국으로 떨어지지 않고 던진다.
 */
const seedCountryRaw = process.env.CALENDAR_COUNTRY ?? CALENDAR_COUNTRY;
if (!isCalendarCountry(seedCountryRaw)) {
    throw new Error(
        `CALENDAR_COUNTRY must be one of US|KR, got "${seedCountryRaw}"`
    );
}
const seedCountry = seedCountryRaw;

async function run(): Promise<void> {
    const client = postgres(databaseUrl!, { max: 1 });
    try {
        // DrizzleEconomicCalendarRepository는 SiglensDatabase(NeonHttpDatabase)를 받는다.
        // postgres-js drizzle instance는 insert/select/update를 구조적으로 지원하므로
        // seed용 단순 쿼리에서는 `as unknown as SiglensDatabase`로 어댑팅한다.
        const db = drizzle(client) as unknown as SiglensDatabase;
        const repo = new DrizzleEconomicCalendarRepository(db);

        const pending = await repo.listUnanalyzedAnnounced(
            CALENDAR_ANALYZED_IMPACTS,
            seedCountry
        );
        const total = pending.length;
        console.log(
            `Seeding analysis for ${total} Medium+ announced ${seedCountry} event(s)`
        );

        let analyzed = 0;
        let failed = 0;

        for (let i = 0; i < total; i += SEED_PARALLEL_LIMIT) {
            const chunk = pending.slice(i, i + SEED_PARALLEL_LIMIT);
            const results = await Promise.allSettled(
                chunk.map(async row => {
                    const input = {
                        region: CALENDAR_REGION_LABEL[seedCountry],
                        event: row.event,
                        impact: row.impact,
                        actual: row.actual,
                        estimate: row.estimate,
                        previous: row.previous,
                        unit: row.unit,
                    };

                    // `RunEconomicEventAnalysisResult`는 cached|done 뿐이다 —
                    // LLM 실패는 throw로 올라와 아래 allSettled가 수거한다.
                    const result = await runEconomicEventAnalysis(input);
                    await repo.attachEventAnalysis(row.id, result.result);
                })
            );

            for (const r of results) {
                if (r.status === 'fulfilled') {
                    analyzed += 1;
                } else {
                    failed += 1;
                    console.error('  analyze failed:', r.reason);
                }
            }
            console.log(
                `  ${Math.min(i + SEED_PARALLEL_LIMIT, total)}/${total}`
            );
        }

        console.log(`Done — analyzed ${analyzed}, failed ${failed}`);
    } finally {
        await client.end();
    }
}

run().catch((error: unknown) => {
    console.error('[seedEconomicEventAnalysis] failed:', error);
    process.exitCode = 1;
});
