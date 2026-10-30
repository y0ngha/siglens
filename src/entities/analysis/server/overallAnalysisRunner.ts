import 'server-only';
import type { Locale } from '@/shared/i18n/locales';
import {
    runOverallAnalysis,
    type AssembledPromptRecord,
    type EnrichedNewsItem,
    type MarketEvent,
    type PriorAnalysis,
    type SubmitOverallAnalysisOptions,
    type RunOverallAnalysisResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { resolveKrxTickTable } from '@/entities/ticker/lib/resolveKrxTickTable';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { getDatabaseClient } from '@/shared/db/client';
// Cross-entity(investor-flows): 종합 분석이 수급 점수표를 입력으로 받는다 — `src/entities/CLAUDE.md`
// "의도적 예외" 표에 등재된 허용 경로.
import { getOverallInvestorFlowsScorecard } from '@/entities/investor-flows/server/getOverallInvestorFlowsScorecard';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '@/entities/news-article/lib/newsLookback';
import { buildAnalysisNewsItems } from '@/entities/news-article/lib/buildAnalysisNewsItems';
import {
    getNextEarningsReport,
    listEarningsDatesAfterRefresh,
} from '@/entities/earnings-report/api';
import { loadNewsMacroCalendar } from '@/entities/economy/api/loadNewsMacroCalendar';
import { resolveReasoning } from '@/shared/lib/byokGate';
import { resolveHoldingPositionBucket } from '@/entities/portfolio/lib/resolveHoldingPositionBucket';
import {
    resolveCallerKeyOptions,
    type AnalysisCaller,
} from '@/shared/lib/byokOnly';
import {
    isOptionsOiStale,
    loadFinancialsScorecardOrUndefined,
    loadOptionsSnapshotOrNull,
} from './overallAxisInputs';

/**
 * 재분석(force) 같이 axis 일반 인자가 아니라 호출자 의도를 전달하기 위한 옵션.
 * 현재는 `force` 하나만 있지만 향후 확장 가능하도록 객체로 받는다.
 */
export interface SubmitOverallAnalysisActionOptions {
    force?: boolean;
    /**
     * 클라이언트가 요청한 "깊은 생각" 토글 값. 회원·pro tier에서만 반영된다 —
     * 비회원·무료 호출자는 이 값과 무관하게 `resolveReasoning`이 `false`로 강제한다.
     */
    reasoning?: boolean;
    /**
     * 이전 분석 히스토리 저장을 위해 그대로 core에 전달한다 —
     * `OverallDependencyInputs.onPromptAssembled`와 동일 계약(캐시 미스에서 정확히
     * 한 번, 프로바이더 호출 직전 동기 호출; 동시 요청의 패자는 호출받지 않음).
     * 여기서 가공하지 않는다.
     */
    onPromptAssembled?: (record: AssembledPromptRecord) => void | Promise<void>;
    /**
     * 이전 분석 히스토리를 core의 **overall 축**(top-level `priorAnalyses`)에 그대로
     * 전달한다. `analysisHistoryQuery(timeframe, 'overall')`로 읽은 값이어야 한다 —
     * technical 축과 recency 윈도우가 다르다(overall은 `OVERALL_CACHE_TTL_SECONDS`,
     * technical은 `ANALYSIS_CACHE_TTL[timeframe]`).
     * 호출자(SSE 라우트)가 core 호출 **이전에** 읽어 넘긴다 — core가 이 값의
     * fingerprint를 캐시 키에 접기 때문에, 캐시 미스에서만 지연 조회하면 같은
     * 요청이 키 계산 시점과 프롬프트 렌더 시점에 서로 다른 히스토리 집합을
     * 보게 된다. 여기서는 가공하지 않고 그대로 넘긴다.
     */
    priorAnalyses?: readonly PriorAnalysis[];
    /**
     * 이전 분석 히스토리를 core의 **technical 축**(`technical.priorAnalyses`)에
     * 전달한다. technical 탭 스트림 경로가 `runAnalysis`에 넘기는 것과 **같은 값**
     * (`analysisHistoryQuery(timeframe, 'technical')`로 읽은)이어야 그 축이 technical
     * 탭과 캐시 키를 공유한다.
     *
     * `priorAnalyses`(overall 축)와 별개 필드다 — 과거엔 하나의 배열을 두 곳에
     * 동시에 흘려보냈는데, 두 축의 recency 윈도우가 다르므로(overall이 하루,
     * technical이 타임프레임별 TTL) 같은 배열을 공유하면 한쪽이 틀린 윈도우로
     * 읽은 이력을 갖게 된다.
     */
    technicalPriorAnalyses?: readonly PriorAnalysis[];
    /**
     * technical 탭 스트림 경로가 `runAnalysis`에 넘기는 것과 같은 시장 이벤트.
     * `technicalPriorAnalyses`와 함께 overall의 technical 축에도 넘겨야 그 축의
     * 캐시 키(`:hist=`·`:evt=`)가 technical 탭과 같아진다 — 한쪽만 넘기면 같은
     * 분석이 한 번 더 생성된다. 가공하지 않고 그대로 넘긴다.
     */
    marketEvents?: readonly MarketEvent[];
    /**
     * 캐시만 조회하고 미스면 생성하지 않는다(`miss_no_trigger`). SSE 라우트가
     * 생성 한도를 넘긴 요청을 강등할 때 켠다. 생략·`false`면 기존 동작 그대로다.
     */
    cacheOnly?: boolean;
}

/** 쿠키 액션과 공개 API가 함께 부르는 {@link executeOverallAnalysis}의 입력. */
export interface ExecuteOverallAnalysisParams {
    /** 누구의 이름으로 어떤 키로 부르는지 — 쿠키 액션도 공개 API도 호출부가 정해 넘긴다. */
    readonly caller: AnalysisCaller;
    readonly symbol: string;
    readonly companyName: string;
    readonly timeframe: Timeframe;
    readonly modelId: SubmitOverallAnalysisOptions['modelId'];
    readonly locale: Locale;
    readonly options?: SubmitOverallAnalysisActionOptions;
    readonly signal?: AbortSignal;
}

/**
 * 종합 분석 본문 — 4축 입력 조립(뉴스·실적·옵션·재무) 후 core `runOverallAnalysis`.
 *
 * `runOverallAnalysisAction`(쿠키 세션)과 공개 API의 `run_fresh_analysis`가 공유한다. 세션을 읽지
 * 않고 `caller`(userId·tier·userApiKey)만 쓴다 — 어떤 키로 LLM을 부르는지는 호출부가 정하고,
 * `caller.byokOnly`면 `resolveCallerKeyOptions`가 core에 `keyPolicy: 'byok-only'`를 싣는다. 캐시 확인(`cacheOnly`)은
 * 키 없이 보내며, core는 적중이면 키 없이 돌려주고 미스면 `miss_no_trigger`로 끝낸다(단일 축과 같다).
 *
 * 예외는 삼키지 않고 던진다. 쿠키 액션은 자기 catch-all로 게이트 오류로 바꾸고, API는 provider
 * 상태 코드를 보존해 502로 바꾼다. (`'use server'` 파일이 아니므로 클라이언트에서 호출할 수 없다.)
 */
export async function executeOverallAnalysis({
    caller,
    symbol,
    companyName,
    timeframe,
    modelId,
    locale,
    options = {},
    signal,
}: ExecuteOverallAnalysisParams): Promise<RunOverallAnalysisResult> {
    const userId = caller.userId;
    const keyOptions = resolveCallerKeyOptions(
        caller,
        options.cacheOnly === true
    );
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
    const optionsSnapshotPromise = loadOptionsSnapshotOrNull(
        symbol,
        '[runOverallAnalysisAction]'
    );
    const financialsScorecardPromise = loadFinancialsScorecardOrUndefined(
        symbol,
        '[runOverallAnalysisAction]'
    );

    // 시장 프로필은 아래에서도 쓴다 — 수급 점수표가 미국 주식에만 붙으므로 먼저 시작해 다른 fetch와 겹친다.
    const marketProfilePromise = resolveMarketProfile(symbol);
    const krxTickTablePromise = resolveKrxTickTable(symbol);
    // 일찍 시작해 아래 `Promise.all` 뒤에 기다린다 — 그사이 거부되면 처리기가 없어
    // unhandled rejection이 된다. 처리기를 먼저 달아 두고, 아래 `await`가 원래 오류를 그대로 전한다.
    void krxTickTablePromise.catch(() => undefined);
    /**
     * 수급(기관·내부자·공매도) 점수표. 미국 주식이 아니거나 장애면 `undefined`(= 종합에 넣지 않음),
     * 미국 주식인데 데이터가 없으면 `null`(= 프롬프트가 "데이터 없음"을 명시). 세 경로(웹·공개 API·프리웜)가
     * 같은 함수를 불러야 inputHash가 같다 — `getOverallInvestorFlowsScorecard` JSDoc.
     */
    const investorFlowsScorecardPromise = marketProfilePromise.then(profile =>
        getOverallInvestorFlowsScorecard(symbol, profile)
    );

    // 실적 발표일은 같은 갱신(`getNextEarningsReport`) 뒤에 DB에서 읽는다 — 별도 갱신을
    // 또 돌리면 FMP 호출이 겹친다. 갱신이 실패해도 분석은 계속(`undefined` = 캘린더 모름).
    const nextEarningsPromise = getNextEarningsReport(symbol, db);
    const earningsDatesPromise = listEarningsDatesAfterRefresh(
        nextEarningsPromise,
        symbol,
        db
    );

    const [
        rows,
        next,
        optionsSnapshot,
        financialsScorecard,
        investorFlowsScorecard,
        macroCalendar,
        earningsDates,
    ] = await Promise.all([
        newsRepo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
        nextEarningsPromise,
        optionsSnapshotPromise,
        financialsScorecardPromise,
        investorFlowsScorecardPromise,
        loadNewsMacroCalendar(),
        earningsDatesPromise,
    ]);

    // 종합의 뉴스 축은 core 안에서 동일한 `runNewsAnalysis`를 호출한다
    // (dependencyResolver → runNewsAnalysis). `/news` 페이지의 호출과 같은 뉴스 입력을
    // 보내야 캐시 키가 일치해 축 분석을 그대로 적중한다 — 두 호출자 모두
    // `buildAnalysisNewsItems`를 통과시켜 입력 파이프라인을 통일한다.
    const enrichedNews: ReadonlyArray<EnrichedNewsItem> =
        buildAnalysisNewsItems(rows);

    const optionsOiStale = isOptionsOiStale(optionsSnapshot, new Date());

    // 프로필을 한 번만 해석해 assetClass와 세션 스펙을 둘 다 거기서 도출한다 —
    // `sessionSpecFor` 호출 시 assetClass→profileId로 되돌리며 정보가 손실되는 왕복을
    // 피한다. assetClass 덕에 core는 암호화폐(technical + news 2축)에서 펀더멘털·옵션·
    // 실적이 없는 것을 주식 데이터 누락이 아니라 의도로 취급한다.
    const [marketProfile, krxTickTable] = await Promise.all([
        marketProfilePromise,
        krxTickTablePromise,
    ]);
    const descriptor = getDescriptor(marketProfile);
    const { assetClass } = descriptor;
    const session = sessionSpecFor(marketProfile);
    const marketDataProvider = getCachedMarketDataProvider(session);
    // 보유 종목이 있는 회원의 technical 탭은 `:pos=` 키로 캐시된다. technical
    // 축에도 같은 버킷을 넘겨야 그 키를 그대로 맞힌다 — 빠지면 overall을 열
    // 때마다 technical을 한 번 더 생성했다(2026-09-29 감사). SSE 라우트의
    // technical 분기와 같은 헬퍼·같은 조건(free·비회원은 undefined)이다.
    const positionBucket = await resolveHoldingPositionBucket({
        userId,
        tier: caller.tier,
        symbol,
        marketDataProvider,
        logTag: '[runOverallAnalysisAction] position bucket resolution failed, degrading to no-bucket:',
    });

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
            tierContext: { userId, tier: caller.tier },
            // provider와 같은 세션 — technical 축 캐시 만료를 해당 시장의 다음
            // 마감에 맞춘다(생략 시 KST 05:00 경계).
            session,
            // technical 탭과 캐시 키를 맞춘다 — 위 `technicalPriorAnalyses`
            // JSDoc 참고. overall 축 전용인 `options.priorAnalyses`와는
            // 다른 값이다.
            ...(options.technicalPriorAnalyses !== undefined
                ? { priorAnalyses: options.technicalPriorAnalyses }
                : {}),
            ...(options.marketEvents !== undefined
                ? { marketEvents: options.marketEvents }
                : {}),
            // 이 회사의 실적 발표일 — 캐시 키에 접히지 않고 프롬프트의 이벤트 라벨만 바꾼다.
            // `undefined`는 "캘린더 모름"(안전 쪽)이라 생략과 같다.
            ...(earningsDates !== undefined ? { earningsDates } : {}),
            ...(positionBucket !== undefined ? { positionBucket } : {}),
        },
        tier: caller.tier,
        reasoning: resolveReasoning(caller.tier, options.reasoning),
        // 2026-09-27: 더 이상 UA로 가르지 않는다 — 봇의 캐시 미스도 사람과
        // 같은 본문을 생성해야 한다(route.ts 상단 불변식과 동일 원칙).
        // 켜지는 경우는 생성 한도 초과 강등뿐이다(`cacheOnly` JSDoc).
        skipEnqueueIfMiss: options.cacheOnly === true,
        assetClass,
        // core는 통화를 심볼에서 추론하지 않는다 — 시장 프로필이 소유한 값을 넘긴다.
        currency: descriptor.priceFormat.currency,
        // technical 탭·프리웜과 같은 호가 표 — core 캐시 키에 접히지 않는다.
        krxTickTable,
        optionsSnapshot: optionsSnapshot ?? undefined,
        optionsOiStale,
        financialsScorecard,
        // `undefined`면 필드를 생략한 것과 같다(core: 캐시 키·프롬프트가 도입 전과 바이트 동일).
        investorFlowsScorecard,
        signal,
        ...keyOptions,
        ...(options.force ? { force: true } : {}),
        ...(options.onPromptAssembled !== undefined
            ? { onPromptAssembled: options.onPromptAssembled }
            : {}),
        ...(options.priorAnalyses !== undefined
            ? { priorAnalyses: options.priorAnalyses }
            : {}),
    });
}
