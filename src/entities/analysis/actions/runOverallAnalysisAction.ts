'use server';

import type { Locale } from '@/shared/i18n/locales';
import {
    isEtRegularSessionOpen,
    runOverallAnalysis,
    computeFinancialsScorecard,
    type AssembledPromptRecord,
    type EnrichedNewsItem,
    type FinancialsScorecard,
    type MarketEvent,
    type OptionsSnapshot,
    type PriorAnalysis,
    type SubmitOverallAnalysisOptions,
    type RunOverallAnalysisResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { getDatabaseClient } from '@/shared/db/client';
import { getFinancialsSnapshot } from '@/entities/financials-statements/lib/getFinancialsSnapshot';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '@/entities/news-article/lib/newsLookback';
import { buildAnalysisNewsItems } from '@/entities/news-article/lib/buildAnalysisNewsItems';
import { getNextEarningsReport } from '@/entities/earnings-report/api';
import { loadNewsMacroCalendar } from '@/entities/economy/api/loadNewsMacroCalendar';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    resolveTierAndByok,
    resolveReasoning,
    buildGateError,
} from '@/shared/lib/byokGate';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import { isE2E } from '@/shared/api/e2eEnv';
// Cross-entity(options-chain): overall은 옵션 스냅샷까지 조합하는 multi-entity
// orchestration이다 — `src/entities/CLAUDE.md` "의도적 예외" 표에 등재된 허용 경로.
// features로 옮기지 않는 이유: 호출부가 SSE 분석 라우트·챗 `run_fresh_analysis` 툴(app)
// 이고, 같은 입력 조립을 캐시 키 정합을 위해 그대로 따라 하는 cron용
// `prewarmOverall`(`analysis/api.ts`)이 이 슬라이스에 있다 — 옮기면 둘을 함께
// 재배치하고 테스트 mock 경로까지 바꾸는 큰 리팩터가 된다.
import { fetchOptionsSnapshot } from '@/entities/options-chain/lib/optionsDataCache';
import { isOpenInterestSnapshotStale } from '@/shared/lib/options/openInterestStale';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/** Final return type — core's overall result + our siglens-side gate errors. */
export type RunOverallAnalysisActionResult =
    | RunOverallAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * 재분석(force) 같이 axis 일반 인자가 아니라 호출자 의도를 전달하기 위한 옵션.
 * 현재는 `force` 하나만 있지만 향후 확장 가능하도록 객체로 받는다.
 */
export interface SubmitOverallAnalysisActionOptions {
    force?: boolean;
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Only honored for member/pro tiers — forced `false` for
     * anonymous/free callers by `resolveReasoning` regardless of this value.
     */
    reasoning?: boolean;
    /**
     * Prior-analysis-context 히스토리 저장(Task S2)을 위해 그대로 core에
     * 전달한다 — `OverallDependencyInputs.onPromptAssembled`와 동일 계약
     * (캐시 미스에서 정확히 한 번, 프로바이더 호출 직전 동기 호출; 동시
     * 요청의 패자는 호출받지 않음). 여기서 가공하지 않는다.
     */
    onPromptAssembled?: (record: AssembledPromptRecord) => void | Promise<void>;
    /**
     * Prior-analysis-context 히스토리(Task S3)를 그대로 core에 전달한다.
     * 호출자(SSE 라우트)가 core 호출 **이전에** 읽어 넘긴다 — core가 이 값의
     * fingerprint를 캐시 키에 접기 때문에, 캐시 미스에서만 지연 조회하면 같은
     * 요청이 키 계산 시점과 프롬프트 렌더 시점에 서로 다른 히스토리 집합을
     * 보게 된다. 여기서는 가공하지 않고 그대로 넘긴다.
     */
    priorAnalyses?: readonly PriorAnalysis[];
    /**
     * technical 탭 스트림 경로가 `runAnalysis`에 넘기는 것과 같은 시장 이벤트.
     * `priorAnalyses`와 함께 overall의 technical 축에도 넘겨야 그 축의 캐시 키
     * (`:hist=`·`:evt=`)가 technical 탭과 같아진다 — 한쪽만 넘기면 같은 분석이
     * 한 번 더 생성된다. 가공하지 않고 그대로 넘긴다.
     */
    marketEvents?: readonly MarketEvent[];
}

/** Server Action: tier + BYOK gate, then submit a 4-axis overall analysis job; loads enriched news + earnings from DB, options snapshot, injects FMP provider; returns `cached | done | error`. */
export async function runOverallAnalysisAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: SubmitOverallAnalysisOptions['modelId'],
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데 `/api/*`는
     * next-intl matcher 밖이라 액션이 스스로 알 수 없다. **기본값을 두지 않는다**
     * — 두면 호출부에서 빠져도 타입체커가 못 잡는다.
     */
    locale: Locale,
    options: SubmitOverallAnalysisActionOptions = {},
    signal?: AbortSignal
): Promise<RunOverallAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // SSE 분석 라우트의 technical 분기).
        if (isE2E()) {
            const { e2eCachedOverall } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedOverall();
        }
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId, locale);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        const { db } = getDatabaseClient();
        const newsRepo = new DrizzleNewsRepository(db);

        // 2026-09-27: 더 이상 봇 트래픽이라고 이 fetch들을 skip하지 않는다.
        //
        // 왜: 스킵하면 봇의 입력값(옵션 스냅샷/financials)이 사람과 달라지고,
        // 그 값이 그대로 캐시 키에 접힌다 — core `runOverallAnalysis`가 계산하는
        // inputHash는 `{ t, f, n, o: stableOptions, fin: financialsScorecard,
        // ph: historyFingerprint }`를 해시해 `buildOverallCacheKey`에 넣는다.
        // 옵션/financials를 null/undefined로 스킵하면 사람과 다른 inputHash →
        // 다른 캐시 키가 나온다. technical 축도 동일 패턴으로 `buildAnalysisCacheKey`가
        // historyFingerprint/eventsFingerprint(priorAnalyses/marketEvents)를 키에
        // 접는다 — 그래서 분석 이력 저장 기능이 붙은 2026-09-03 이후 이력이 쌓인
        // 심볼은 봇의 캐시 미스가 항상 prewarm 캐시를 못 맞혔다. 이게 바로 이 PR이
        // 고치는 버그이고, 옵션/financials도 같은 병이다.
        //
        // 순서: 이 fetch들은 core의 캐시 조회보다 먼저(무조건, hit/miss 무관)
        // 실행된다 — overall의 inputHash 자체가 옵션/financials 값을 필요로
        // 하므로 core가 캐시를 보기 전에 이미 이 값들을 쥐고 있어야 한다. 즉
        // "캐시 hit이면 이 fetch가 생략된다"는 최적화는 이 코드에 없다.
        //
        // rate-limit 우려는 감수한다: 봇 트래픽 대다수는 sitemap에 실려 SEO
        // prewarm이 캐시를 미리 채워두는 심볼로 몰린다. 게다가 이 두 fetch
        // 자체가 심볼당 TTL 캐시를 가진다(옵션 1분~4시간 — optionsDataCache.ts
        // OPTIONS_SNAPSHOT_TTL_SECONDS, financials 24시간 — getFinancialsSnapshot.ts) —
        // 매 요청이 FMP/Yahoo 라이브 호출로 이어지지 않는다. 실패 시
        // null/undefined로 graceful degradation한다. FMP 사용량 집계는
        // prewarm 자신의 FMP 호출만 세는 카운터뿐이다(seo-prewarm:fmp-budget:<ET date>,
        // src/app/api/cron/seo-prewarm/lock.ts) — 이 request-path(방문자/크롤러)
        // FMP/Yahoo 호출은 오늘 어디에도 집계되지 않는다(알려진 모니터링 공백).
        // 크롤러 트래픽이 실제로 한도를 위협하면 고칠 것은 UA 분기가 아니라
        // UA-무관 per-IP/session rate limit이다(후속 작업).
        //
        // news / earnings / options / financials 네 fetch는 서로 독립이므로
        // Promise.all로 병렬화해 직렬 대기 비용 (~1-3s)을 제거한다.
        const optionsSnapshotPromise: Promise<OptionsSnapshot | null> =
            fetchOptionsSnapshot(symbol).catch(error => {
                console.warn(
                    '[runOverallAnalysisAction] options snapshot fetch failed:',
                    error
                );
                return null;
            });

        /**
         * fetch/compute 실패 시 undefined로 graceful degradation — financials가
         * 없어도 나머지 4축으로 종합 분석을 계속 진행한다.
         */
        const financialsScorecardPromise: Promise<
            FinancialsScorecard | undefined
        > = getFinancialsSnapshot(symbol)
            .then(snapshot => computeFinancialsScorecard(snapshot))
            .catch(error => {
                console.warn(
                    '[runOverallAnalysisAction] financials scorecard fetch failed:',
                    error
                );
                return undefined;
            });

        const [
            rows,
            next,
            optionsSnapshot,
            financialsScorecard,
            macroCalendar,
        ] = await Promise.all([
            newsRepo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
            getNextEarningsReport(symbol, db),
            optionsSnapshotPromise,
            financialsScorecardPromise,
            loadNewsMacroCalendar(),
        ]);

        // Overall news axis는 core 안에서 동일한 `runNewsAnalysis`를 호출한다
        // (dependencyResolver → runNewsAnalysis). `/news` 페이지의 호출과 동일한
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
        const descriptor = getDescriptor(marketProfile);
        const { assetClass } = descriptor;
        const marketDataProvider = getCachedMarketDataProvider(
            sessionSpecFor(marketProfile)
        );

        return await runOverallAnalysis({
            symbol,
            // 화면 로케일을 AI 산출물 언어로 그대로 넘긴다 — core 0.53.0부터
            // 받는다. `ko`는 접미 없는 기존 캐시 키를 그대로 맞힌다.
            locale,
            companyName,
            timeframe,
            modelId,
            fundamentalProvider: getFundamentalDataProvider(symbol),
            marketDataProvider,
            newsItems: enrichedNews,
            upcomingCalendar: next !== null ? [next] : [],
            // `/news` 경로와 같은 헬퍼 — 뉴스 축 캐시 키 일치 불변식.
            macroCalendar,
            technical: {
                tierContext: { userId, tier: gate.tier },
                // technical 탭과 캐시 키를 맞춘다 — 위 옵션 JSDoc 참고.
                ...(options.priorAnalyses !== undefined
                    ? { priorAnalyses: options.priorAnalyses }
                    : {}),
                ...(options.marketEvents !== undefined
                    ? { marketEvents: options.marketEvents }
                    : {}),
            },
            tier: gate.tier,
            reasoning: resolveReasoning(gate.tier, options.reasoning),
            // 2026-09-27: 더 이상 UA로 가르지 않는다 — 봇의 캐시 미스도 사람과
            // 같은 본문을 생성해야 한다(route.ts 상단 불변식과 동일 원칙).
            skipEnqueueIfMiss: false,
            assetClass,
            // core는 통화를 심볼에서 추론하지 않는다 — 시장 프로필이 소유한 값을 넘긴다.
            currency: descriptor.priceFormat.currency,
            optionsSnapshot: optionsSnapshot ?? undefined,
            optionsOiStale,
            financialsScorecard,
            signal,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
            ...(options.force ? { force: true } : {}),
            ...(options.onPromptAssembled !== undefined
                ? { onPromptAssembled: options.onPromptAssembled }
                : {}),
            ...(options.priorAnalyses !== undefined
                ? { priorAnalyses: options.priorAnalyses }
                : {}),
        });
    } catch (err) {
        console.error('[runOverallAnalysisAction] unexpected error:', err);
        return {
            status: 'error',
            error: await buildGateError(caughtAnalysisErrorCode(err), locale),
        };
    }
}
