import type { ModelId, Timeframe } from '@y0ngha/siglens-core';
import { runOverallAnalysisAction } from '@/entities/analysis/actions/runOverallAnalysisAction';
import { DrizzleAnalysisHistoryRepository } from '@/entities/analysis/analysisHistoryRepository';
import { tryAcquireReanalyzeCooldown } from '@/entities/analysis/actions/tryAcquireReanalyzeCooldown';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { findMarketEventsForPrompt } from '@/entities/news-article/marketEventsRepository';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDatabaseClient } from '@/shared/db/client';
import type { Locale } from '@/shared/i18n/locales';
import { shouldAttemptReanalyze } from '../generationQuota';
import { releaseCooldownQuietly } from './releaseCooldown';
import type { DispatchParams, DispatchQuotaContext } from './types';

interface OverallPromptInputs {
    technicalPriorAnalyses: Awaited<
        ReturnType<DrizzleAnalysisHistoryRepository['findRecentForPrompt']>
    >;
    overallPriorAnalyses: Awaited<
        ReturnType<DrizzleAnalysisHistoryRepository['findRecentForPrompt']>
    >;
    marketEvents: Awaited<ReturnType<typeof findMarketEventsForPrompt>>;
}

/**
 * 종합 분석 이력·이벤트 입력을 한 번에 읽는다.
 *
 * core가 `priorAnalyses` 지문을 캐시 키에 접으므로 **무조건, core 호출 전에** 읽어야 한다. 읽기를
 * 미스 때로 미루면 키 계산과 프롬프트 렌더가 같은 요청에 서로 다른 이력을 보게 된다(요청당 인덱스
 * 쿼리 한 번). 봇 요청도 건너뛰지 않는다 — 봇의 캐시 미스도 사람과 똑같이 생성하므로 건너뛰면 같은
 * 캐시 키에 프롬프트 입력만 다른 두 벌의 본문이 생긴다.
 *
 * 이력은 두 벌을 따로 읽는다 — technical 탭과 overall의 technical 축은 recency 윈도우가 다르다
 * (`ANALYSIS_CACHE_TTL[timeframe]` vs `OVERALL_CACHE_TTL_SECONDS`, `analysisHistoryQuery`의 axis 인자).
 * 한 배열을 두 곳에 흘리면 한쪽은 틀린 창으로 읽은 이력을 갖는다.
 */
async function loadOverallPromptInputs(
    symbol: string,
    timeframe: Timeframe
): Promise<OverallPromptInputs> {
    const db = getDatabaseClient().db;
    const historyRepo = new DrizzleAnalysisHistoryRepository(db);
    // 이벤트 창의 세션 — `runOverallAnalysisAction`이 technical 축에 넘기는 것과 같은 프로필에서 만든다.
    // 이벤트는 technical 탭과 공유하는 캐시 키에 접히므로 다른 세션을 쓰면 overall이 technical을 한 번 더 생성한다.
    const session = sessionSpecFor(await resolveMarketProfile(symbol));
    const [technicalPriorAnalyses, overallPriorAnalyses, marketEvents] =
        await Promise.all([
            // overall의 **technical 축**이 참고할 이력. technical 탭과 캐시 키(`:hist=`)를 공유하려면
            // 그 탭과 같은 axis(기본값 'technical')로 읽어야 한다. overall 결과는 `PriorAnalysis`가
            // 요구하는 trend/riskLevel이 없어 `toPriorAnalysis`가 버리므로 `tab: 'overall'`로는 비어 있다.
            // `session`은 이력 쿼리의 `generatedBeforeMs`가 core의 캐시 키 경계(세션 마감)와 맞게 한다.
            historyRepo.findRecentForPrompt({
                symbol,
                timeframe,
                tab: 'technical',
                session,
            }),
            // overall **자신의** top-level `priorAnalyses` — overall의 recency 윈도우로 읽는다.
            historyRepo.findRecentForPrompt({
                symbol,
                timeframe,
                tab: 'technical',
                axis: 'overall',
                session,
            }),
            findMarketEventsForPrompt(db, {
                symbol,
                ...marketEventsLookback(timeframe, session),
            }),
        ]);
    return { technicalPriorAnalyses, overallPriorAnalyses, marketEvents };
}

/**
 * `overall` 종류의 `DISPATCH` 핸들러. technical과 같은 규칙으로 재분석 의도를 쿨다운 획득으로
 * 판정한다 — 키 namespace를 분리해(`<tf>:overall`) 기술적 분석 재분석이 종합 분석 재분석을 막지 않게 한다.
 *
 * 쿨다운 중이면 `reanalyze_cooldown` 봉투를 돌려주고, 분석이 실패하면 획득한 쿨다운을 되돌린다.
 * 결과는 이력으로 저장하지 않는다: `OverallAnalysisResponse`에는 trend/riskLevel이 없어 저장해도
 * `toPriorAnalysis`가 전부 버리고 사문 행과 프롬프트 블롭만 남는다. 이 축이 참고하는 이력은 technical 쪽이다.
 */
export async function runOverallDispatch(
    params: DispatchParams,
    signal: AbortSignal | undefined,
    locale: Locale,
    quota: DispatchQuotaContext
): Promise<unknown> {
    const symbol = params.symbol as string;
    const timeframe = params.timeframe as Timeframe;
    const cooldownTimeframe = `${timeframe}:overall` as Timeframe;

    const cooldown = shouldAttemptReanalyze(params.reanalyze, quota.rateLimited)
        ? await tryAcquireReanalyzeCooldown(symbol, cooldownTimeframe)
        : null;
    if (cooldown !== null && !cooldown.ok) {
        return {
            status: 'reanalyze_cooldown' as const,
            remainingMs: cooldown.remainingMs,
        };
    }

    const inputs = await loadOverallPromptInputs(symbol, timeframe);

    return runOverallAnalysisAction(
        symbol,
        params.companyName as string,
        timeframe,
        params.modelId as ModelId,
        locale,
        {
            force: cooldown?.ok === true,
            reasoning: params.reasoning as boolean | undefined,
            priorAnalyses: inputs.overallPriorAnalyses,
            technicalPriorAnalyses: inputs.technicalPriorAnalyses,
            marketEvents: inputs.marketEvents,
            cacheOnly: quota.cacheOnly,
            onPromptAssembled: quota.onPromptAssembled,
        },
        signal
    ).catch(async (err: unknown) => {
        if (cooldown?.ok === true) {
            await releaseCooldownQuietly(
                symbol,
                cooldownTimeframe,
                '[streamAnalysisRoute] overall cooldown release failed:'
            );
        }
        throw err;
    });
}
