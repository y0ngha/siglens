/**
 * One-time SEED script: analyze all current Medium+ announced unanalyzed
 * `economic_calendar` rows via core `runEconomicEventAnalysis` (direct, non-queued).
 *
 * 한 pass가 아니라 **진전이 없을 때까지** 반복한다 — 리포지토리 스캔이 요청 경로용
 * 상한(20행)을 걸고 있어서, 한 번만 부르면 조용히 20건만 처리한다. 스캔이 비면
 * 정상 종료(그때는 실제로 남은 미분석 행이 없다), 한 pass가 아무것도 저장하지
 * 못하면 중단 시점의 **스캔 페이지** 건수를 보고하고 멈춘다 — 그 경우 실제 잔량은
 * 알 수 없다.
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

type PendingRow = Awaited<
    ReturnType<DrizzleEconomicCalendarRepository['listUnanalyzedAnnounced']>
>[number];

/**
 * 한 pass를 SEED_PARALLEL_LIMIT씩 끊어 처리한다.
 *
 * 실패는 **행 id로** 모은다. 실패한 행은 `analyzed_at`이 그대로라 다음 pass에 또
 * 나오는데, pass마다 카운터를 올리면 최종 집계가 시도 횟수가 되어 테이블 크기를
 * 넘어선다(25건 백로그에 "analyzed 24, failed 3" 같은 화해 불가능한 숫자).
 */
async function seedPass(
    pending: readonly PendingRow[],
    repo: DrizzleEconomicCalendarRepository,
    failedIds: Set<string>
): Promise<{ analyzed: number }> {
    const total = pending.length;
    let analyzed = 0;

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
                // LLM 실패는 throw로 올라와 allSettled가 수거한다.
                const result = await runEconomicEventAnalysis(input);
                await repo.attachEventAnalysis(row.id, result.result);
            })
        );

        for (const [index, r] of results.entries()) {
            if (r.status === 'fulfilled') {
                failedIds.delete(chunk[index].id);
                analyzed += 1;
            } else {
                failedIds.add(chunk[index].id);
                console.error('  analyze failed:', r.reason);
            }
        }
        console.log(`  ${Math.min(i + SEED_PARALLEL_LIMIT, total)}/${total}`);
    }

    return { analyzed };
}

async function run(): Promise<void> {
    const client = postgres(databaseUrl!, { max: 1 });
    try {
        // DrizzleEconomicCalendarRepository는 SiglensDatabase(NeonHttpDatabase)를 받는다.
        // postgres-js drizzle instance는 insert/select/update를 구조적으로 지원하므로
        // seed용 단순 쿼리에서는 `as unknown as SiglensDatabase`로 어댑팅한다.
        const db = drizzle(client) as unknown as SiglensDatabase;
        const repo = new DrizzleEconomicCalendarRepository(db);

        let analyzed = 0;
        const failedIds = new Set<string>();

        /**
         * `listUnanalyzedAnnounced`는 한 번에 `UNANALYZED_SCAN_LIMIT`(20)까지만
         * 준다 — 페이지 로드에서 시작하는 요청 경로용 상한이다. 이 스크립트는
         * 백필이므로 여러 pass에 걸쳐 돌려야 한다. 한 번만 부르면 KR처럼 조회 창이
         * 넓은(180일) 국가에서 20건만 처리하고 "Done"을 찍는데, 로그만 봐서는 원래
         * 20건이었던 것과 구분되지 않는다.
         *
         * 종료 조건은 둘이다 — 스캔이 비었거나(정상), 이번 pass가 아무것도 저장하지
         * 못했거나(중단). 저장에 실패한 행은 `analyzed_at`이 그대로라 다음 스캔에 또
         * 나오므로, **빈 결과만** 기다리면 영구 실패 행 하나로 무한 루프가 된다.
         */
        for (let pass = 1; ; pass += 1) {
            const pending = await repo.listUnanalyzedAnnounced(
                CALENDAR_ANALYZED_IMPACTS,
                seedCountry
            );
            if (pending.length === 0) break;

            console.log(
                `[pass ${pass}] ${pending.length} Medium+ announced ${seedCountry} event(s)`
            );
            const result = await seedPass(pending, repo, failedIds);
            analyzed += result.analyzed;

            if (result.analyzed === 0) {
                // `pending.length`는 남은 전체가 아니라 **이번 스캔 페이지**다
                // (`UNANALYZED_SCAN_LIMIT` 상한). 전체 잔량으로 읽히지 않게 쓴다.
                console.error(
                    `[pass ${pass}] 이번 스캔 ${pending.length}건이 전부 실패해 중단합니다 — 미분석 행이 더 남아 있을 수 있습니다.`
                );
                break;
            }
        }

        console.log(
            `Done — analyzed ${analyzed}, failed ${failedIds.size} row(s)`
        );
        // 실패는 throw와 똑같이 치명적이다 — LLM 환경변수 오설정으로 전 행이
        // 실패해도 exit 0이면 `yarn db:seed:... && <다음 단계>`가 그냥 이어진다.
        if (failedIds.size > 0) process.exitCode = 1;
    } finally {
        await client.end();
    }
}

run().catch((error: unknown) => {
    console.error('[seedEconomicEventAnalysis] failed:', error);
    process.exitCode = 1;
});
