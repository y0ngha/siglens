'use server';

import { waitUntil } from '@vercel/functions';
import { headers } from 'next/headers';
import {
    submitOverallAnalysis,
    type EnrichedNewsItem,
    type OptionsSnapshot,
    type SubmitOverallAnalysisOptions,
    type SubmitOverallAnalysisResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/shared/api/fmp/fundamentalClient';
import { getDatabaseClient } from '@/shared/db/client';
import {
    DrizzleNewsRepository,
    NEWS_ANALYSIS_LOOKBACK_MS,
    isEnrichedRow,
    toEnrichedNewsItem,
} from '@/entities/news-article';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
// Cross-entity: options-chain fetchOptionsSnapshot 필요. Phase 9에서 features 레이어 도입 시 해소.
import { fetchOptionsSnapshot } from '@/entities/options-chain/lib/optionsDataCache';
import {
    isOpenInterestSnapshotStale,
    isUsOptionsRegularSession,
} from '@/shared/lib/marketSession';
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
        // 스냅샷을 위해 Yahoo를 두드리지 않는다 — 크롤러가 Yahoo rate-limit을
        // 소진시키는 시나리오 차단. 일반 유저는 fetchOptionsSnapshot의 cross-
        // request 캐시(Upstash)로 흡수.
        // news / earnings / options 세 fetch는 서로 독립이므로 Promise.all로
        // 병렬화해 직렬 대기 비용 (~1-3s)을 제거한다.
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

        const [rows, next, optionsSnapshot] = await Promise.all([
            newsRepo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
            getNextEarningsReport(symbol, db),
            optionsSnapshotPromise,
        ]);

        const enrichedNews: ReadonlyArray<EnrichedNewsItem> = rows
            .filter(isEnrichedRow)
            .map(toEnrichedNewsItem);

        // 정규장 시간대에는 OI=0 비율이 높아도 stale로 보지 않는다 — deep OTM strike
        // OI 0이 흔하므로 false positive 위험. 정규장 외에서만 stale 휴리스틱 적용.
        const optionsOiStale =
            optionsSnapshot !== null &&
            !isUsOptionsRegularSession(new Date()) &&
            isOpenInterestSnapshotStale(optionsSnapshot);

        return await submitOverallAnalysis({
            symbol,
            companyName,
            timeframe,
            modelId,
            fundamentalProvider: new FmpFundamentalClient(),
            newsItems: enrichedNews,
            upcomingCalendar: next !== null ? [next] : [],
            technical: { tierContext: { userId, tier: gate.tier } },
            waitUntil,
            tier: gate.tier,
            skipEnqueueIfMiss,
            optionsSnapshot: optionsSnapshot ?? undefined,
            optionsOiStale,
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
