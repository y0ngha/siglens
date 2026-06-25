'use server';

import { headers } from 'next/headers';
import {
    isEtRegularSessionOpen,
    submitOverallAnalysis,
    computeFinancialsScorecard,
    type EnrichedNewsItem,
    type FinancialsScorecard,
    type OptionsSnapshot,
    type SubmitOverallAnalysisOptions,
    type SubmitOverallAnalysisResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';
import { getDatabaseClient } from '@/shared/db/client';
import { getFinancialsSnapshot } from '@/entities/financials-statements/lib/getFinancialsSnapshot';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import {
    NEWS_ANALYSIS_LOOKBACK_MS,
    buildAnalysisNewsItems,
} from '@/entities/news-article';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
// Cross-entity: options-chain fetchOptionsSnapshot 필요. Phase 9에서 features 레이어 도입 시 해소.
import { fetchOptionsSnapshot } from '@/entities/options-chain/lib/optionsDataCache';
import { isOpenInterestSnapshotStale } from '@/shared/lib/options/openInterestStale';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/** Final return type — core's overall result + our siglens-side gate errors. */
export type SubmitOverallAnalysisActionResult =
    | SubmitOverallAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * 재분석(force) 같이 axis 일반 인자가 아니라 호출자 의도를 전달하기 위한 옵션.
 * 현재는 `force` 하나만 있지만 향후 확장 가능하도록 객체로 받는다.
 */
export interface SubmitOverallAnalysisActionOptions {
    force?: boolean;
}

/** Server Action: tier + BYOK gate, then submit a 4-axis overall analysis job; loads enriched news + earnings from DB, options snapshot, injects FMP provider; returns `cached | submitted | pending_dependencies | error`. */
export async function submitOverallAnalysisAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: SubmitOverallAnalysisOptions['modelId'],
    options: SubmitOverallAnalysisActionOptions = {}
): Promise<SubmitOverallAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // submitAnalysisAction).
        if (isE2E()) {
            const { e2eCachedOverall } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedOverall();
        }
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        const { db } = getDatabaseClient();
        const newsRepo = new DrizzleNewsRepository(db);

        // bot 트래픽은 어차피 enqueue를 skip하므로 (`skipEnqueueIfMiss`) 옵션
        // 스냅샷 및 financials 스냅샷을 fetch하지 않는다 — 크롤러가 외부 API
        // rate-limit을 소진시키는 시나리오 차단. 일반 유저는 각 fetch의 cross-
        // request 캐시(Upstash / Next data cache)로 흡수.
        // news / earnings / options / financials 네 fetch는 서로 독립이므로
        // Promise.all로 병렬화해 직렬 대기 비용 (~1-3s)을 제거한다.
        const optionsSnapshotPromise: Promise<OptionsSnapshot | null> =
            skipEnqueueIfMiss
                ? Promise.resolve(null)
                : fetchOptionsSnapshot(symbol).catch(error => {
                      console.warn(
                          '[submitOverallAnalysisAction] options snapshot fetch failed:',
                          error
                      );
                      return null;
                  });

        /**
         * financials scorecard는 봇에선 skip한다(options snapshot과 동일 정책).
         * fetch/compute 실패 시 undefined로 graceful degradation — financials가
         * 없어도 나머지 4축으로 종합 분석을 계속 진행한다.
         */
        const financialsScorecardPromise: Promise<
            FinancialsScorecard | undefined
        > = skipEnqueueIfMiss
            ? Promise.resolve(undefined)
            : getFinancialsSnapshot(symbol)
                  .then(snapshot => computeFinancialsScorecard(snapshot))
                  .catch(error => {
                      console.warn(
                          '[submitOverallAnalysisAction] financials scorecard fetch failed:',
                          error
                      );
                      return undefined;
                  });

        const [rows, next, optionsSnapshot, financialsScorecard] =
            await Promise.all([
                newsRepo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
                getNextEarningsReport(symbol, db),
                optionsSnapshotPromise,
                financialsScorecardPromise,
            ]);

        // Overall news axis는 core 안에서 동일한 `submitNewsAnalysis`를 호출한다
        // (dependencyResolver → submitNewsAnalysis). `/news` 페이지의 호출과 동일한
        // news input을 보내야 cache key가 일치해 axis 분석을 그대로 hit한다 —
        // 두 호출자 모두 `buildAnalysisNewsItems`를 통과해 input pipeline을 통일한다.
        const enrichedNews: ReadonlyArray<EnrichedNewsItem> =
            buildAnalysisNewsItems(rows);

        // 정규장 시간대에는 OI=0 비율이 높아도 stale로 보지 않는다 — deep OTM strike
        // OI 0이 흔하므로 false positive 위험. 정규장 외에서만 stale 휴리스틱 적용.
        const optionsOiStale =
            optionsSnapshot !== null &&
            !isEtRegularSessionOpen(new Date()) &&
            isOpenInterestSnapshotStale(optionsSnapshot);

        // Resolve profile once; derive both assetClass and session spec from it
        // to avoid a lossy assetClass→profileId round-trip at the sessionSpecFor call.
        // assetClass lets core treat absent fundamentals/options/earnings as intentional
        // for crypto (2-axis: technical + news) rather than missing stock data.
        const marketProfile = await resolveMarketProfile(symbol);
        const assetClass = getDescriptor(marketProfile).assetClass;
        const marketDataProvider = getCachedMarketDataProvider(
            sessionSpecFor(marketProfile)
        );

        return await submitOverallAnalysis({
            symbol,
            companyName,
            timeframe,
            modelId,
            fundamentalProvider: getFundamentalDataProvider(),
            marketDataProvider,
            newsItems: enrichedNews,
            upcomingCalendar: next !== null ? [next] : [],
            technical: { tierContext: { userId, tier: gate.tier } },
            tier: gate.tier,
            skipEnqueueIfMiss,
            assetClass,
            optionsSnapshot: optionsSnapshot ?? undefined,
            optionsOiStale,
            financialsScorecard,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
            ...(options.force ? { force: true } : {}),
        });
    } catch (err) {
        console.error('[submitOverallAnalysisAction] unexpected error:', err);
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
