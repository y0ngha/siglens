'use server';

import { revalidateTag } from 'next/cache';
import {
    submitEconomicEventAnalysis,
    pollEconomicEventAnalysis,
} from '@y0ngha/siglens-core';
import type { EconomicEventAnalysis } from '@y0ngha/siglens-core';

import { isE2E } from '@/shared/api/e2eEnv';
import { MS_PER_SECOND } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { sleep } from '@/shared/lib/sleep';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';

import {
    DrizzleEconomicCalendarRepository,
    type UnanalyzedAnnouncedEvent,
} from '../api/economicCalendarRepository';
import {
    isAnalysisRecentlyRun,
    markAnalysisRun,
} from '../api/calendarAnalysisRefreshFlag';
import {
    CALENDAR_ANALYSIS_PARALLEL_LIMIT,
    CALENDAR_ANALYSIS_POLL_INTERVAL_MS,
    CALENDAR_ANALYSIS_POLL_MAX_ATTEMPTS,
    CALENDAR_ANALYZED_IMPACTS,
    ECONOMY_CALENDAR_CACHE_TAG,
} from '../lib/economyCalendarConstants';

/** 과반 실패 판정 분모. */
const MAJORITY_DIVISOR = 2;

/**
 * 한 이벤트를 core submit→poll로 분석하고 DB에 write-once 기록한다.
 *
 * core는 submit/poll 워커 잡 구조(`submitEconomicEventAnalysis` /
 * `pollEconomicEventAnalysis`)를 사용한다. 캐시 히트(`status:'cached'`)면
 * 즉시 결과를 얻고, 미스(`status:'submitted'`)면 jobId로 폴링한다(market-news
 * `analyzeAndPersist` 미러). 실패는 reject로 전파 — caller(allSettled)가 수거.
 *
 * `result` 필드가 분석 결과 키(`SubmitEconomicEventAnalysisCached.result`,
 * `PollEconomicEventAnalysisDone.result`)이다 — 타입 정의 확인 완료.
 *
 * @returns `true` — `attachEventAnalysis` 성공(실제 persist); `false` — poll 오류·타임아웃으로
 *   persist 없이 조기 반환. caller가 `true`만 카운트해 `revalidateTag` 호출 여부를 결정한다.
 */
async function analyzeAndPersistEvent(
    row: UnanalyzedAnnouncedEvent,
    repo: DrizzleEconomicCalendarRepository
): Promise<boolean> {
    const input = {
        event: row.event,
        impact: row.impact,
        actual: row.actual,
        estimate: row.estimate,
        previous: row.previous,
        unit: row.unit,
    };

    const submitted = await submitEconomicEventAnalysis(input);

    let analysis: EconomicEventAnalysis | null = null;

    if (submitted.status === 'cached') {
        analysis = submitted.result;
    } else {
        const { jobId } = submitted;
        for (
            let attempt = 0;
            attempt < CALENDAR_ANALYSIS_POLL_MAX_ATTEMPTS;
            attempt++
        ) {
            await sleep(CALENDAR_ANALYSIS_POLL_INTERVAL_MS);
            const polled = await pollEconomicEventAnalysis(jobId);
            if (polled.status === 'done') {
                analysis = polled.result;
                break;
            }
            if (polled.status === 'error') {
                console.error(
                    `[ensureEconomicEventsAnalyzedAction] poll error ${row.id}: ${polled.error}`
                );
                return false;
            }
        }
        if (analysis === null) {
            console.warn(
                `[ensureEconomicEventsAnalyzedAction] poll timeout after ${(CALENDAR_ANALYSIS_POLL_MAX_ATTEMPTS * CALENDAR_ANALYSIS_POLL_INTERVAL_MS) / MS_PER_SECOND}s — ${row.id}`
            );
            return false;
        }
    }

    await repo.attachEventAnalysis(row.id, analysis);
    return true;
}

/**
 * Server Action: 발표된(actual≠null) Medium+ 미분석 이벤트를 core AI 분석으로
 * 채우고, ≥1행이 분석되면 `economy:calendar` 태그를 무효화한다.
 *
 * 두 트리거가 공유한다:
 *  - SEED: 백필용 tsx 스크립트(scripts/seedEconomicEventAnalysis.ts)
 *  - ON-ACCESS: /economy 마운트 시 `useEconomicCalendarTrigger`가 fire-and-forget으로 호출(봇 포함)
 *
 * core는 submit/poll 워커 잡 구조(`submitEconomicEventAnalysis` +
 * `pollEconomicEventAnalysis`)를 사용한다. 캐시 히트는 즉시 결과를 얻고,
 * 미스는 jobId로 폴링한다(market-news `ensureNewsCardsAnalyzedAction` 미러).
 *
 * 멱등성: `analyzed_at IS NULL` DB 가드 + refresh-flag(30분 TTL)로 이중 보호.
 * 과반 실패는 경고 로깅만 — 다음 접속/플래그 만료 시 재시도된다.
 * E2E/prerender에서는 즉시 반환(LLM 비용 0).
 */
export async function ensureEconomicEventsAnalyzedAction(): Promise<void> {
    try {
        if (isE2E()) return;
        if (await isAnalysisRecentlyRun()) return;
        // async 작업 전에 마킹 — 동시 호출이 이 지점 이후 플래그를 읽으면 스캔 생략.
        await markAnalysisRun();

        const { db } = getDatabaseClient();
        const repo = new DrizzleEconomicCalendarRepository(db);

        const pending = await repo.listUnanalyzedAnnounced(
            CALENDAR_ANALYZED_IMPACTS
        );
        if (pending.length === 0) return;

        const settled = await withConcurrencyLimit(
            pending,
            CALENDAR_ANALYSIS_PARALLEL_LIMIT,
            row => analyzeAndPersistEvent(row, repo)
        );
        const failures = settled.filter(
            (r): r is PromiseRejectedResult => r.status === 'rejected'
        );
        if (failures.length > 0) {
            console.warn(
                `[ensureEconomicEventsAnalyzedAction] ${failures.length}/${pending.length} analyze failed`,
                failures.map(f => f.reason)
            );
        }
        if (failures.length > pending.length / MAJORITY_DIVISOR) {
            console.error(
                `[ensureEconomicEventsAnalyzedAction] majority analyze failure (${failures.length}/${pending.length})`
            );
        }

        const persisted = settled.filter(
            r => r.status === 'fulfilled' && r.value === true
        ).length;
        if (persisted > 0) {
            // SP-A와 같은 'economy:calendar' 태그만 무효화 — 다음 렌더가 분석 채워진 행을 읽는다.
            revalidateTag(ECONOMY_CALENDAR_CACHE_TAG, 'max');
        }
    } catch (error) {
        console.error('[ensureEconomicEventsAnalyzedAction]', error);
    }
}
