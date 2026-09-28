'use server';

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
import { getNextEarningsReport } from '@/entities/earnings-report';
import { loadNewsMacroCalendar } from '@/entities/economy/api/loadNewsMacroCalendar';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    resolveTierAndByok,
    resolveReasoning,
    buildGateError,
} from '@/shared/lib/byokGate';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';

/** Final return type — core's news result + our siglens-side gate errors. */
export type SubmitNewsAnalysisActionResult =
    | RunNewsAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then load last-7d enriched news from DB + next earnings, then submit via siglens-core; returns `cached | submitted | error`. */
export async function submitNewsAnalysisAction(
    symbol: string,
    companyName: string,
    modelId: SubmitNewsAnalysisOptions['modelId'],
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Only honored for member/pro tiers.
     */
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데
     * `/api/*`는 next-intl matcher 밖이라 액션이 스스로 알 수 없다.
     * **기본값을 두지 않는다** — 두면 호출부에서 빠져도 타입체커가 못 잡는다
     * (실측: `resolveRequestLocale`을 상수로 바꿔도 10,516개 테스트가 초록이었다).
     */
    locale: Locale,
    reasoning?: boolean,
    signal?: AbortSignal
): Promise<SubmitNewsAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // SSE 분석 라우트의 technical 분기).
        if (isE2E()) {
            const { e2eCachedNews } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedNews();
        }
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId, locale);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

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
            tier: gate.tier,
            reasoning: resolveReasoning(gate.tier, reasoning),
            // 2026-09-27: 더 이상 UA로 가르지 않는다 — 봇의 캐시 미스도 사람과
            // 같은 본문을 생성해야 한다(siglens/src/app/api/analysis/stream/route.ts
            // 상단 불변식과 동일 원칙).
            skipEnqueueIfMiss: false,
            assetClass,
            // core는 통화를 심볼에서 추론하지 않는다 — 한국 종목 프레이밍·실적 추정 통화.
            currency: descriptor.priceFormat.currency,
            signal,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error('[submitNewsAnalysisAction] unexpected error:', err);
        return {
            status: 'error',
            error: await buildGateError(caughtAnalysisErrorCode(err), locale),
        };
    }
}
