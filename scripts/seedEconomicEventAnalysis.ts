/**
 * One-time SEED script: analyze all current Medium+ announced unanalyzed
 * `economic_calendar` rows via core `submitEconomicEventAnalysis` / `pollEconomicEventAnalysis`.
 *
 * Usage (after SP-A backfill):
 *   yarn db:seed:calendar-analysis
 *
 * Requires: DIRECT_DATABASE_URL (or DATABASE_URL) + core LLM env vars.
 * Does NOT run `yarn db:migrate` — the SP-D migration (0020_*.sql) must be
 * applied separately before running this script.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
    submitEconomicEventAnalysis,
    pollEconomicEventAnalysis,
} from '@y0ngha/siglens-core';

import { DrizzleEconomicCalendarRepository } from '../src/entities/economy/api/economicCalendarRepository';
import {
    CALENDAR_ANALYZED_IMPACTS,
    CALENDAR_ANALYSIS_POLL_INTERVAL_MS,
    CALENDAR_ANALYSIS_POLL_MAX_ATTEMPTS,
} from '../src/entities/economy/lib/economyCalendarConstants';
import type { SiglensDatabase } from '../src/shared/db/types';

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DIRECT_DATABASE_URL (or DATABASE_URL) env var required');
}

/** 동시 분석 상한 — seed는 일괄이라 작게 잡아 LLM 큐 압박을 피한다. */
const SEED_PARALLEL_LIMIT = 4;

/** @/shared/config/time의 MS_PER_SECOND와 동기화 */
const MS_PER_SECOND = 1_000;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
    const client = postgres(databaseUrl!, { max: 1 });
    try {
        // DrizzleEconomicCalendarRepository는 SiglensDatabase(NeonHttpDatabase)를 받는다.
        // postgres-js drizzle instance는 insert/select/update를 구조적으로 지원하므로
        // seed용 단순 쿼리에서는 `as unknown as SiglensDatabase`로 어댑팅한다.
        const db = drizzle(client) as unknown as SiglensDatabase;
        const repo = new DrizzleEconomicCalendarRepository(db);

        const pending = await repo.listUnanalyzedAnnounced(
            CALENDAR_ANALYZED_IMPACTS
        );
        const total = pending.length;
        console.log(`Seeding analysis for ${total} Medium+ announced event(s)`);

        let analyzed = 0;
        let failed = 0;

        for (let i = 0; i < total; i += SEED_PARALLEL_LIMIT) {
            const chunk = pending.slice(i, i + SEED_PARALLEL_LIMIT);
            const results = await Promise.allSettled(
                chunk.map(async row => {
                    const input = {
                        event: row.event,
                        impact: row.impact,
                        actual: row.actual,
                        estimate: row.estimate,
                        previous: row.previous,
                        unit: row.unit,
                    };

                    const submitted = await submitEconomicEventAnalysis(input);
                    if (submitted.status === 'cached') {
                        await repo.attachEventAnalysis(
                            row.id,
                            submitted.result
                        );
                        return;
                    }

                    const { jobId } = submitted;
                    for (
                        let attempt = 0;
                        attempt < CALENDAR_ANALYSIS_POLL_MAX_ATTEMPTS;
                        attempt++
                    ) {
                        await sleep(CALENDAR_ANALYSIS_POLL_INTERVAL_MS);
                        const polled = await pollEconomicEventAnalysis(jobId);
                        if (polled.status === 'done') {
                            await repo.attachEventAnalysis(
                                row.id,
                                polled.result
                            );
                            return;
                        }
                        if (polled.status === 'error') {
                            throw new Error(
                                `poll error for ${row.id}: ${polled.error}`
                            );
                        }
                    }
                    throw new Error(
                        `poll timeout after ${(CALENDAR_ANALYSIS_POLL_MAX_ATTEMPTS * CALENDAR_ANALYSIS_POLL_INTERVAL_MS) / MS_PER_SECOND}s — ${row.id}`
                    );
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
