'use server';

import { revalidateTag } from 'next/cache';
import { runEconomicEventAnalysis } from '@y0ngha/siglens-core';
import type { EconomicEventAnalysis } from '@y0ngha/siglens-core';

import { isE2E } from '@/shared/api/e2eEnv';
import { getDatabaseClient } from '@/shared/db/client';
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
    CALENDAR_ANALYZED_IMPACTS,
    ECONOMY_CALENDAR_CACHE_TAG,
} from '../lib/economyCalendarConstants';

/** 과반 실패 판정 분모. ensureMarketNewsCardsAnalyzedAction.ts의 MAJORITY_DIVISOR와 동일 — 변경 시 함께 업데이트. */
const MAJORITY_DIVISOR = 2;

/**
 * 한 이벤트를 core로 분석하고 DB에 write-once 기록한다.
 *
 * `runEconomicEventAnalysis`는 cached 또는 done 결과를 직접 반환한다 — 폴링 없음.
 * 실패는 reject로 전파 — caller(allSettled)가 수거.
 *
 * @returns `true` — `attachEventAnalysis` 성공(실제 persist); `false` — 조기 반환.
 *   caller가 `true`만 카운트해 `revalidateTag` 호출 여부를 결정한다.
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

    const runResult = await runEconomicEventAnalysis(input);

    let analysis: EconomicEventAnalysis | null = null;

    if (runResult.status === 'cached' || runResult.status === 'done') {
        analysis = runResult.result;
    }

    if (analysis === null) {
        console.warn(
            `[ensureEconomicEventsAnalyzedAction] unexpected result status "${runResult.status}" for ${row.id}`
        );
        return false;
    }

    // 빈 summaryKo는 core normalizer의 crash-safe fallback 결과 — write-once로 영구
    // 기록하면 재시도 기회가 사라진다. translation 경로와 같은 방식으로 skip 처리.
    if (analysis.summaryKo.trim() === '') {
        console.warn(
            `[ensureEconomicEventsAnalyzedAction] empty summaryKo — skipping persist for ${row.id}`
        );
        return false;
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
 * `runEconomicEventAnalysis` 한 번으로 cached/done 결과가 확정된다 — 폴링 없음.
 * 서버 내부(액션) 경로라 브라우저 연결이 없고, 따라서 SSE도 필요 없다.
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
