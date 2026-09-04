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
    type AssembledPromptRecord,
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
// analysis_history는 barrel(index.ts) 제외 대상이다 — 이 파일 자체가 이미
// entities/analysis 슬라이스 내부이므로 barrel을 거치지 않고 직접 import한다
// (analysisHistoryRepository.ts 상단 JSDoc 참고: server-only + node:crypto
// 의존이라 barrel에 실으면 client 번들로 새어나간다).
import {
    DrizzleAnalysisHistoryRepository,
    resolveGeneratedAt,
    type AnalysisHistoryTab,
} from '@/entities/analysis/analysisHistoryRepository';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

/**
 * 이 파일의 모든 seam이 `modelId: DEEPSEEK_V4_FLASH_MODEL`을 직접 명시 전달하는
 * 이유 — 익명/free 방문자가 실제로 보내는 기본 모델이다. `SymbolModelContext`의
 * `useSelectedModel` 기본값(`DEFAULT_MODEL = DEEPSEEK_V4_FLASH_MODEL`)과
 * 동일 — `[symbol]/page.tsx`·`[symbol]/overall/page.tsx`의 SSR peek도 이
 * 값으로 캐시를 읽는다. core의 각 submit 함수는 `modelId`를 옵션으로 받을 때
 * "생략(undefined)"에 대해 서로 다르게 동작한다: technical(`runAnalysis`)만
 * 내부적으로 `DEFAULT_ANALYSIS_MODEL_ID`('analysis-worker')로 폴백하고, 나머지
 * 축(fundamental/financials/congress/news/options/overall)은 `modelId`를
 * 캐시 키에 그대로 사용하므로 생략 시 실제 방문자가 쓰는 키와 어긋난다. 그래서
 * 모든 seam이 `DEEPSEEK_V4_FLASH_MODEL`을 명시적으로 전달해 anonymous writer와
 * 캐시 키를 맞춘다(스펙 §7 캐시 키 5축 정합).
 */

/**
 * Task S3 (prior-analysis-context) — prewarm 결과를 `analysis_history`에
 * best-effort로 기록한다. SSE 경로(`app/api/analysis/stream/route.ts`의
 * `schedulePersistAnalysisHistory`)와 같은 목적, 같은 컬럼 집합이지만
 * **`after()`로 감싸지 않는다.**
 *
 * `prewarmTechnical`/`prewarmOverall`은 이미 seo-prewarm cron route의
 * `after()` 콜백 안에서 실행된다(`route.ts` PATCH → `after()` →
 * `runPrewarmBatch()` → `harvest.ts`의 `TAB_SEAMS` → 여기). 즉 호출 시점에
 * 이미 응답이 나간 뒤의 백그라운드 실행이므로, SSE 경로처럼 "사용자 체감
 * 지연을 피하려고" 한 겹 더 `after()`로 미룰 이유가 없다 — 그냥 곧장
 * await한다.
 *
 * 실제로 이 자리에 중첩 `after()`를 넣으면 오히려 위험하다: Next.js 소스
 * (`next/dist/server/after/after-context.js`)를 확인한 결과 중첩 `after()`
 * 호출 자체는 기술적으로 지원된다(`afterTaskAsyncStorage`의
 * `rootTaskSpawnPhase`가 최상위/중첩 호출을 구분하도록 명시적으로 설계돼
 * 있다). 하지만 이 cron route의 SIGTERM 드레인은 그 큐를 모른다 —
 * `route.ts`는 `fireAndForget(batchDone)`으로 `runPrewarmBatch()`가
 * **반환하는 순간**만 기다리고, 그 안에서 중첩 `after()`가 예약한 콜백은
 * 별도 큐에 남아 있을 수 있다. SIGTERM이 그 사이에 오면 락 해제 후
 * 프로세스가 종료되며 예약된 쓰기가 고아가 된다. 직접 호출하면 이 레이스
 * 자체가 존재하지 않는다.
 *
 * `saveAnalysisHistory`는 절대 throw하지 않는다(내부에서 catch+log) — 이
 * 함수도 마찬가지로 실패를 삼킨다(`getDatabaseClient`가 동기적으로 던질
 * 가능성까지 방어).
 */
async function persistPrewarmAnalysis(input: {
    symbol: string;
    timeframe: string;
    tab: AnalysisHistoryTab;
    result: unknown;
    prompt: AssembledPromptRecord | undefined;
}): Promise<void> {
    try {
        const { db } = getDatabaseClient();
        await new DrizzleAnalysisHistoryRepository(db).saveAnalysisHistory({
            symbol: input.symbol,
            timeframe: input.timeframe,
            tab: input.tab,
            modelId: DEEPSEEK_V4_FLASH_MODEL,
            // 프리웜은 현재 한국어로만 생성한다(harvest.ts의 `resolveHarvest`가
            // 같은 이유로 스냅샷에 `DEFAULT_LOCALE`을 적는 것과 동일한 근거).
            locale: DEFAULT_LOCALE,
            result: input.result,
            generatedAt: resolveGeneratedAt(input.result),
            prompt: input.prompt,
        });
    } catch (err) {
        console.error(
            '[entities/analysis/api] persistPrewarmAnalysis failed:',
            err
        );
    }
}

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
    const descriptor = getDescriptor(marketProfile);
    const { assetClass } = descriptor;
    const marketDataProvider = getCachedMarketDataProvider(
        sessionSpecFor(marketProfile)
    );
    const timeframe = '1Day';

    // Task S3 (prior-analysis-context) — read BEFORE the core call,
    // unconditionally (unlike the SSE route's crawler-request skip: prewarm
    // has no request context to derive that signal from, and it always
    // intends to trigger a generation, so there is no "will not generate"
    // case to short-circuit for). core folds a fingerprint of this into the
    // cache key (see `SubmitAnalysisOptions.priorAnalyses` JSDoc in core) —
    // omitting it here once `analysis_history` starts accumulating rows
    // (which this same change makes happen) would make prewarm compute a
    // DIFFERENT cache key than the non-bot SSE path for the same
    // (symbol, timeframe, tab), defeating the entire point of prewarming
    // that cache entry for a real visitor to hit.
    const priorAnalyses = await new DrizzleAnalysisHistoryRepository(
        getDatabaseClient().db
    ).findRecentForPrompt({ symbol, timeframe, tab: 'technical' });

    // core의 `onPromptAssembled`는 캐시 미스에서 정확히 한 번, 프로바이더
    // 호출 직전에 **동기로** 캡처만 한다(SSE 경로와 동일 계약 —
    // `schedulePersistAnalysisHistory` 주석 참고).
    let capturedPrompt: AssembledPromptRecord | undefined;

    const result = await runAnalysis(
        symbol,
        companyName,
        timeframe,
        force,
        fmpSymbol,
        {
            modelId: DEEPSEEK_V4_FLASH_MODEL,
            skipEnqueueIfMiss: false,
            marketDataProvider,
            assetClass,
            // 스트림 경로와 같은 5축 정합을 유지한다 — 통화가 빠지면 prewarm이 쓴
            // 캐시와 방문자 요청의 산출 텍스트가 갈린다.
            currency: descriptor.priceFormat.currency,
            tierContext: { userId: null, tier: 'free' },
            reasoning: false,
            positionBucket: undefined,
            priorAnalyses,
            onPromptAssembled: record => {
                capturedPrompt = record;
            },
        }
    );

    // 'cached'는 이미 존재하는 행을 가리키므로 다시 저장하지 않는다 — 새로
    // 생성된('done') 결과만 히스토리에 남긴다(SSE 경로와 동일 규칙).
    if (result.status === 'done') {
        await persistPrewarmAnalysis({
            symbol,
            timeframe,
            tab: 'technical',
            result: result.result,
            prompt: capturedPrompt,
        });
    }

    return result;
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
        dataProvider: getFundamentalDataProvider(symbol),
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
        dataProvider: getFinancialStatementsProvider(symbol),
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
    const timeframe = '1Day';

    // Task S3 (prior-analysis-context) — same cache-key parity rationale as
    // `prewarmTechnical` (see that function's comment on the read call).
    const priorAnalyses = await new DrizzleAnalysisHistoryRepository(
        db
    ).findRecentForPrompt({ symbol, timeframe, tab: 'overall' });

    let capturedPrompt: AssembledPromptRecord | undefined;

    const result = await runOverallAnalysis({
        symbol,
        companyName,
        timeframe,
        modelId: DEEPSEEK_V4_FLASH_MODEL,
        fundamentalProvider: getFundamentalDataProvider(symbol),
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
        priorAnalyses,
        onPromptAssembled: record => {
            capturedPrompt = record;
        },
        ...(force ? { force: true } : {}),
    });

    // 'cached'는 이미 존재하는 행을 가리키므로 다시 저장하지 않는다 — 새로
    // 생성된('done') 결과만 히스토리에 남긴다(SSE 경로와 동일 규칙).
    if (result.status === 'done') {
        await persistPrewarmAnalysis({
            symbol,
            timeframe,
            tab: 'overall',
            result: result.result,
            prompt: capturedPrompt,
        });
    }

    return result;
}
