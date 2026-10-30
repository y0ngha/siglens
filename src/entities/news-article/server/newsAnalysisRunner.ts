import 'server-only';
import {
    runNewsAnalysis,
    type EnrichedNewsItem,
    type SubmitNewsAnalysisOptions,
    type RunNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { getDatabaseClient } from '@/shared/db/client';
import { getNextEarningsReport } from '@/entities/earnings-report/api';
import { loadNewsMacroCalendar } from '@/entities/economy/api/loadNewsMacroCalendar';
import { resolveReasoning } from '@/shared/lib/byokGate';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import {
    resolveCallerKeyOptions,
    type AnalysisCaller,
} from '@/shared/lib/byokOnly';
import { DrizzleNewsRepository } from '../api';
import { buildAnalysisNewsItems } from '../lib/buildAnalysisNewsItems';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '../lib/newsLookback';

/** 뉴스 분석 본문의 입력 — 쿠키 액션과 공개 API가 같은 형상으로 넘긴다. */
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
    const keyOptions = resolveCallerKeyOptions(caller, cacheOnly);
    // 프로필을 한 번만 resolve해 assetClass와 currency를 모두 거기서 얻는다
    // (runOverallAnalysisAction/prewarmOverall과 같은 방식).
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

    // buildAnalysisNewsItems가 집계 프롬프트가 보는 기사를 제한한다(priceImpact 상위 25건).
    // submitOverallAnalysisAction이 같은 파이프라인을 공유해 news axis cache가 같은 키로
    // hit한다.
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
        ...keyOptions,
    });
}
