'use server';

import { waitUntil } from '@vercel/functions';
import { headers } from 'next/headers';
import {
    submitOverallAnalysis,
    type EnrichedNewsItem,
    type SubmitOverallAnalysisOptions,
    type SubmitOverallAnalysisResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '@/infrastructure/market/newsLookback';
import {
    isEnrichedRow,
    toEnrichedNewsItem,
} from '@/infrastructure/market/newsEnrichment';
import { getNextEarningsReport } from '@/infrastructure/market/nextEarningsReport';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import {
    resolveTierAndByok,
    buildGateError,
} from '@/infrastructure/market/byokGate';
import { isBot } from '@/infrastructure/http/isBot';
import { fetchOptionsSnapshot } from '@/infrastructure/options/optionsDataCache';
import {
    isOpenInterestSnapshotStale,
    isUsOptionsRegularSession,
} from '@/domain/market/session';
import type { AnalysisGateBlockedResult } from '@/domain/types';

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

        const [rows, next] = await Promise.all([
            newsRepo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
            getNextEarningsReport(symbol, db),
        ]);

        const enrichedNews: ReadonlyArray<EnrichedNewsItem> = rows
            .filter(isEnrichedRow)
            .map(toEnrichedNewsItem);

        // 옵션 스냅샷 조회 실패는 4번째 axis가 graceful skip되는 시나리오로 처리한다.
        // NoChains 종목(SPXUSD 등) 또는 Yahoo 일시 장애에도 overall 분석은 진행돼야 한다.
        const optionsSnapshot = await fetchOptionsSnapshot(symbol).catch(
            error => {
                console.warn(
                    '[submitOverallAnalysisAction] options snapshot fetch failed:',
                    error
                );
                return null;
            }
        );

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
