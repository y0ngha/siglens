import 'server-only';
import { revalidateTag } from 'next/cache';
import { runEconomicEventAnalysis } from '@y0ngha/siglens-core';
import type { EconomicEventAnalysis } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';

import {
    DrizzleEconomicCalendarRepository,
    type UnanalyzedAnnouncedEvent,
} from './economicCalendarRepository';
import {
    isAnalysisRecentlyRun,
    markAnalysisRun,
} from './calendarAnalysisRefreshFlag';
import {
    CALENDAR_ANALYSIS_PARALLEL_LIMIT,
    CALENDAR_ANALYZED_IMPACTS,
    CALENDAR_REGION_LABEL,
    economyCalendarCacheTag,
    type CalendarCountry,
} from '../lib/economyCalendarConstants';

/** 과반 실패 판정 분모. ingestMarketNewsCategory.ts의 MAJORITY_DIVISOR와 동일 — 변경 시 함께 업데이트. */
const MAJORITY_DIVISOR = 2;

export interface AnalyzeEconomicEventsOptions {
    /**
     * 한 번에 분석할 최대 이벤트 수. 생략하면 미분석 이벤트 전부(방문자 경로).
     * 크론은 허브 유닛 상한(45초) 안에 들어오도록 건다 — 남은 이벤트는 분석 플래그
     * (30분)가 풀린 뒤 다음 tick이 이어받는다.
     */
    readonly limit?: number;
    readonly logLabel: string;
}

export type AnalyzeEconomicEventsResult =
    | { readonly status: 'recently-run' }
    | {
          readonly status: 'ok';
          readonly persisted: number;
          /** `limit`에 잘려 이번에 손대지 않은 미분석 이벤트 수. */
          readonly pending: number;
      };

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
    repo: DrizzleEconomicCalendarRepository,
    country: CalendarCountry,
    logLabel: string
): Promise<boolean> {
    const input = {
        // core 필수 필드. 프롬프트 프레이밍과 분석 캐시 키 양쪽에 들어간다 —
        // 같은 이름·같은 수치의 발표라도 경제권이 다르면 해설을 공유하면 안 된다.
        region: CALENDAR_REGION_LABEL[country],
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
            `[${logLabel}] unexpected result status "${runResult.status}" for ${row.id}`
        );
        return false;
    }

    // 빈 summaryKo는 core normalizer의 crash-safe fallback 결과 — write-once로 영구
    // 기록하면 재시도 기회가 사라진다. translation 경로와 같은 방식으로 skip 처리.
    if (analysis.summaryKo.trim() === '') {
        console.warn(
            `[${logLabel}] empty summaryKo — skipping persist for ${row.id}`
        );
        return false;
    }

    await repo.attachEventAnalysis(row.id, analysis);
    return true;
}

/**
 * 발표된(actual≠null) Medium+ 미분석 이벤트를 core AI 분석으로 채우고, ≥1행이
 * 분석되면 국가별 `economyCalendarCacheTag(country)` 태그를 무효화한다.
 *
 * 두 트리거가 공유한다(백필 스크립트 `scripts/seedEconomicEventAnalysis.ts`는 같은 core
 * 호출을 독립 구현으로 갖고 있다):
 *  - ON-ACCESS: /economy 마운트 시 `useEconomicCalendarTrigger`가 fire-and-forget으로 호출
 *  - CRON: 허브 프리웜(`app/api/cron/seo-prewarm/hubs.ts`)이 캘린더 적재 직후 호출 —
 *    예전엔 방문이 있어야만 분석돼, 방문 전 SSR에는 해설 없는 발표만 실렸다.
 *
 * 멱등성: `analyzed_at IS NULL` DB 가드 + refresh-flag(30분 TTL)로 이중 보호.
 * 과반 실패는 경고 로깅만 — 다음 접속/플래그 만료 시 재시도된다. 국가 검증·E2E
 * 단락은 호출부 몫. 그 밖의 예외(DB 등)는 올라간다.
 *
 * **국가를 안 나누면 write-once가 잘못된 결과를 굳힌다**: `Interest Rate Decision`
 * 처럼 이름에 국가가 없는 발표가 국가 없이 분석되면 한국은행 결정이 연준 맥락으로
 * 서술되고, `analyzed_at IS NULL` 가드 때문에 다시 못 고친다. core 0.48.0의
 * `EconomicEventAnalysisInput.region`이 그 축을 받으므로 여기서 넘겨준다.
 */
export async function analyzeEconomicEvents(
    country: CalendarCountry,
    { limit, logLabel }: AnalyzeEconomicEventsOptions
): Promise<AnalyzeEconomicEventsResult> {
    if (await isAnalysisRecentlyRun(country)) return { status: 'recently-run' };
    // async 작업 전에 마킹 — 동시 호출이 이 지점 이후 플래그를 읽으면 스캔 생략.
    await markAnalysisRun(country);

    const { db } = getDatabaseClient();
    const repo = new DrizzleEconomicCalendarRepository(db);

    const unanalyzed = await repo.listUnanalyzedAnnounced(
        CALENDAR_ANALYZED_IMPACTS,
        country
    );
    const batch = limit === undefined ? unanalyzed : unanalyzed.slice(0, limit);
    const pending = unanalyzed.length - batch.length;
    if (batch.length === 0) return { status: 'ok', persisted: 0, pending };

    const settled = await withConcurrencyLimit(
        batch,
        CALENDAR_ANALYSIS_PARALLEL_LIMIT,
        row => analyzeAndPersistEvent(row, repo, country, logLabel)
    );
    const failures = settled.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
    );
    if (failures.length > 0) {
        console.warn(
            `[${logLabel}] ${failures.length}/${batch.length} analyze failed`,
            failures.map(f => f.reason)
        );
    }
    if (failures.length > batch.length / MAJORITY_DIVISOR) {
        console.error(
            `[${logLabel}] majority analyze failure (${failures.length}/${batch.length})`
        );
    }

    const persisted = settled.filter(
        r => r.status === 'fulfilled' && r.value === true
    ).length;
    if (persisted > 0) {
        // 인제스션과 같은 국가별 캘린더 태그만 무효화 — 다음 렌더가 분석 채워진 행을 읽는다.
        revalidateTag(economyCalendarCacheTag(country), 'max');
    }
    return { status: 'ok', persisted, pending };
}
