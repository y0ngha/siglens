import 'server-only';
import type { Locale } from '@/shared/i18n/locales';
import {
    runNewsAnalysis,
    type EnrichedNewsItem,
    type SubmitNewsAnalysisOptions,
    type RunNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '../lib/newsLookback';
import { buildAnalysisNewsItems } from '../lib/buildAnalysisNewsItems';
import { getNextEarningsReport } from '@/entities/earnings-report/api';
import { loadNewsMacroCalendar } from '@/entities/economy/api/loadNewsMacroCalendar';
import { resolveReasoning } from '@/shared/lib/byokGate';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import {
    assertCallerRouting,
    type AnalysisCaller,
} from '@/shared/lib/byokOnly';

export interface ExecuteNewsAnalysisParams {
    /** 누구의 이름으로 어떤 키로 부르는지 — 쿠키 액션도 공개 API도 호출부가 정해 넘긴다. */
    readonly caller: AnalysisCaller;
    readonly symbol: string;
    readonly companyName: string;
    readonly modelId: SubmitNewsAnalysisOptions['modelId'];
    readonly locale: Locale;
    /** 클라이언트 "깊은 생각" 토글 — `resolveReasoning`이 tier로 한 번 더 거른다. */
    readonly reasoning?: boolean;
    readonly signal?: AbortSignal;
    /** 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). */
    readonly cacheOnly?: boolean;
}

/**
 * 뉴스 분석 본문 — 저장된 보강 뉴스·실적·매크로 캘린더를 모아 core `runNewsAnalysis`.
 *
 * `submitNewsAnalysisAction`(쿠키 세션)과 공개 API의 `run_fresh_analysis`가 공유한다. 세션을 읽지
 * 않고 `caller`만 쓴다. 예외는 삼키지 않고 던진다(호출부가 각자 오류 모양으로 바꾼다).
 */
export async function executeNewsAnalysis({
    caller,
    symbol,
    companyName,
    modelId,
    locale,
    reasoning,
    signal,
    cacheOnly = false,
}: ExecuteNewsAnalysisParams): Promise<RunNewsAnalysisResult> {
    assertCallerRouting(caller, modelId, cacheOnly);
    // Resolve profile once; derive both assetClass and currency from it
    // (same pattern as runOverallAnalysisAction/prewarmOverall).
    const marketProfile = await resolveMarketProfile(symbol);
    const descriptor = getDescriptor(marketProfile);
    const { assetClass } = descriptor;
    const { db } = getDatabaseClient();
    const newsRepo = new DrizzleNewsRepository(db);

    const [rows, next, macroCalendar] = await Promise.all([
        newsRepo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
        getNextEarningsReport(symbol, db),
        loadNewsMacroCalendar(),
    ]);

    // The per-card stage and 30-day window above are untouched — buildAnalysisNewsItems
    // bounds what the aggregate prompt sees(top 25 by priceImpact). 동일 pipeline을
    // submitOverallAnalysisAction이 공유해 news axis cache가 같은 키로 hit한다.
    const enrichedNews: ReadonlyArray<EnrichedNewsItem> =
        buildAnalysisNewsItems(rows);

    return await runNewsAnalysis({
        symbol,
        // 화면 로케일을 AI 산출물 언어로 그대로 넘긴다 — core 0.53.0부터
        // 받는다. `ko`는 접미 없는 기존 캐시 키를 그대로 맞힌다.
        locale,
        companyName,
        modelId,
        news: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        // overall 뉴스 축과 같은 헬퍼 — 캐시 키 일치 불변식.
        macroCalendar,
        tier: caller.tier,
        reasoning: resolveReasoning(caller.tier, reasoning),
        // 2026-09-27: 더 이상 UA로 가르지 않는다 — 봇의 캐시 미스도 사람과
        // 같은 본문을 생성해야 한다(siglens/src/app/api/analysis/stream/route.ts
        // 상단 불변식과 동일 원칙). `cacheOnly`는 UA가 아니라 클라이언트의 AI 자동
        // 실행 게이트(첫 입력 전 조회)에서 온다.
        skipEnqueueIfMiss: cacheOnly,
        assetClass,
        // core는 통화를 심볼에서 추론하지 않는다 — 한국 종목 프레이밍·실적 추정 통화.
        currency: descriptor.priceFormat.currency,
        signal,
        ...(caller.userApiKey !== undefined
            ? { userApiKey: caller.userApiKey }
            : {}),
    });
}
