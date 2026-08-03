import 'server-only';
import {
    runAnalysis,
    runOverallAnalysis,
    runFundamentalAnalysis,
    runFinancialsAnalysis,
    runCongressTrend,
    isEtRegularSessionOpen,
    computeFinancialsScorecard,
    DEEPSEEK_V4_FLASH_MODEL,
    type RunAnalysisResult,
    type RunOverallAnalysisResult,
    type RunFundamentalAnalysisResult,
    type RunFinancialsAnalysisResult,
    type RunCongressTrendResult,
    type EnrichedNewsItem,
    type FinancialsScorecard,
    type OptionsSnapshot,
} from '@y0ngha/siglens-core';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { getDatabaseClient } from '@/shared/db/client';
import { getFinancialsSnapshot } from '@/entities/financials-statements/lib/getFinancialsSnapshot';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import {
    NEWS_ANALYSIS_LOOKBACK_MS,
    buildAnalysisNewsItems,
} from '@/entities/news-article';
import { getNextEarningsReport } from '@/entities/earnings-report';
// Cross-entity: overall이 options-chain 스냅샷을 조합한다. submitOverallAnalysisAction과
// 동일한 의도적 예외(entities/CLAUDE.md).
import { fetchOptionsSnapshot } from '@/entities/options-chain/lib/optionsDataCache';
import { isOpenInterestSnapshotStale } from '@/shared/lib/options/openInterestStale';

/**
 * 이 파일의 모든 seam이 `modelId: DEEPSEEK_V4_FLASH_MODEL`을 직접 명시 전달하는
 * 이유 — 익명/free 방문자가 실제로 보내는 기본 모델이다. `SymbolModelContext`의
 * `useSelectedModel` 기본값(`DEFAULT_MODEL = DEEPSEEK_V4_FLASH_MODEL`)과
 * 동일 — `[symbol]/page.tsx`·`[symbol]/overall/page.tsx`의 SSR peek도 이
 * 값으로 캐시를 읽는다. core의 각 submit 함수는 `modelId`를 옵션으로 받을 때
 * "생략(undefined)"에 대해 서로 다르게 동작한다: technical(`submitAnalysis`)만
 * 내부적으로 `DEFAULT_ANALYSIS_MODEL_ID`('analysis-worker')로 폴백하고, 나머지
 * 축(fundamental/financials/congress/news/options/overall)은 `modelId`를
 * 캐시 키에 그대로 사용하므로 생략 시 실제 방문자가 쓰는 키와 어긋난다. 그래서
 * 모든 seam이 `DEEPSEEK_V4_FLASH_MODEL`을 명시적으로 전달해 anonymous writer와
 * 캐시 키를 맞춘다(스펙 §7 캐시 키 5축 정합).
 */

/**
 * SEO pre-warm 전용 technical submit (spec 2026-07-24 §4 seam).
 * 익명 free 방문자의 submitAnalysisAction 익명 브랜치와 동일한 core 호출을
 * 재현한다(캐시 키 5축 정합: model default / tier free / reasoning false /
 * no bucket / 동일 core fingerprint). 차이는 skipEnqueueIfMiss:false와 force 뿐.
 * ⚠️ request-context 호출(요청 헤더 읽기·세션 사용자 조회·봇 판별·쿠키 접근)
 * 금지 — cron의 after() 컨텍스트에서 실행되며 React 요청 스코프가 없다.
 */
export async function prewarmTechnical(
    symbol: string,
    companyName: string,
    fmpSymbol: string | undefined,
    force: boolean
): Promise<RunAnalysisResult> {
    const marketProfile = await resolveMarketProfile(symbol);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const marketDataProvider = getCachedMarketDataProvider(
        sessionSpecFor(marketProfile)
    );
    return runAnalysis(symbol, companyName, '1Day', force, fmpSymbol, {
        modelId: DEEPSEEK_V4_FLASH_MODEL,
        skipEnqueueIfMiss: false,
        marketDataProvider,
        assetClass,
        tierContext: { userId: null, tier: 'free' },
        reasoning: false,
        positionBucket: undefined,
    });
}

/**
 * SEO pre-warm 전용 fundamental submit (spec 2026-07-24 §4 seam, Task 7).
 * `submitFundamentalAnalysisAction`의 비봇 경로를 request-context 없이 재현한다.
 */
export async function prewarmFundamental(
    symbol: string,
    force: boolean
): Promise<RunFundamentalAnalysisResult> {
    return runFundamentalAnalysis({
        symbol,
        modelId: DEEPSEEK_V4_FLASH_MODEL,
        dataProvider: getFundamentalDataProvider(),
        tier: 'free',
        reasoning: false,
        skipEnqueueIfMiss: false,
        ...(force ? { force: true } : {}),
    });
}

/**
 * SEO pre-warm 전용 financials submit (spec 2026-07-24 §4 seam, Task 7).
 * `submitFinancialsAnalysisAction`의 비봇 경로를 request-context 없이 재현한다.
 */
export async function prewarmFinancials(
    symbol: string,
    force: boolean
): Promise<RunFinancialsAnalysisResult> {
    return runFinancialsAnalysis({
        symbol,
        modelId: DEEPSEEK_V4_FLASH_MODEL,
        dataProvider: getFinancialStatementsProvider(),
        tier: 'free',
        reasoning: false,
        skipEnqueueIfMiss: false,
        ...(force ? { force: true } : {}),
    });
}

/**
 * SEO pre-warm 전용 congress submit (spec 2026-07-24 §4 seam, Task 7).
 * `submitCongressTrendAction`의 비봇 경로를 request-context 없이 재현한다.
 * 이 경로는 액션 레이어(BYOK 게이트 포함)를 우회해 core를 직접 호출한다 — 실 사용자
 * 컨텍스트가 없는 pre-warm이라 gate 대상이 아니다. 항상 free-tier 비프리미엄 모델
 * (DEEPSEEK_V4_FLASH_MODEL)만 사용하므로 프리미엄/BYOK 상황 자체가 발생하지 않는다.
 */
export async function prewarmCongress(
    symbol: string,
    force: boolean
): Promise<RunCongressTrendResult> {
    return runCongressTrend({
        symbol,
        modelId: DEEPSEEK_V4_FLASH_MODEL,
        dataProvider: getCongressTradesProvider(),
        skipEnqueueIfMiss: false,
        reasoning: false,
        tier: 'free',
        ...(force ? { force: true } : {}),
    });
}

/**
 * SEO pre-warm 전용 overall(4축 종합) submit (spec 2026-07-24 §4 seam, Task 7).
 * `submitOverallAnalysisAction`의 비봇 경로를 request-context 없이 재현한다.
 *
 * ⚠️ 봇 트래픽에서는 skip되던 options snapshot·financials scorecard fetch가
 * prewarm에서는 항상 실행된다 — 의도된 동작이다(spec §8 FMP 예산 산정에 포함됨).
 */
export async function prewarmOverall(
    symbol: string,
    companyName: string,
    force: boolean
): Promise<RunOverallAnalysisResult> {
    const { db } = getDatabaseClient();
    const newsRepo = new DrizzleNewsRepository(db);

    const optionsSnapshotPromise: Promise<OptionsSnapshot | null> =
        fetchOptionsSnapshot(symbol).catch(error => {
            console.warn(
                '[prewarmOverall] options snapshot fetch failed:',
                error
            );
            return null;
        });

    const financialsScorecardPromise: Promise<FinancialsScorecard | undefined> =
        getFinancialsSnapshot(symbol)
            .then(snapshot => computeFinancialsScorecard(snapshot))
            .catch(error => {
                console.warn(
                    '[prewarmOverall] financials scorecard fetch failed:',
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

    const enrichedNews: ReadonlyArray<EnrichedNewsItem> =
        buildAnalysisNewsItems(rows);

    // 정규장 시간대에는 OI=0 비율이 높아도 stale로 보지 않는다 (submitOverallAnalysisAction과 동일).
    const optionsOiStale =
        optionsSnapshot !== null &&
        !isEtRegularSessionOpen(new Date()) &&
        isOpenInterestSnapshotStale(optionsSnapshot);

    const marketProfile = await resolveMarketProfile(symbol);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const marketDataProvider = getCachedMarketDataProvider(
        sessionSpecFor(marketProfile)
    );

    return runOverallAnalysis({
        symbol,
        companyName,
        timeframe: '1Day',
        modelId: DEEPSEEK_V4_FLASH_MODEL,
        fundamentalProvider: getFundamentalDataProvider(),
        marketDataProvider,
        newsItems: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        technical: { tierContext: { userId: null, tier: 'free' } },
        tier: 'free',
        reasoning: false,
        skipEnqueueIfMiss: false,
        assetClass,
        optionsSnapshot: optionsSnapshot ?? undefined,
        optionsOiStale,
        financialsScorecard,
        ...(force ? { force: true } : {}),
    });
}
