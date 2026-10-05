import 'server-only';
import { DEEPSEEK_V4_1_FLASH_MODEL } from '@y0ngha/siglens-core';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot/model';
import { hasProseForTab } from '@/entities/seo-snapshot/lib/hasProseForTab';
import type { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import {
    prewarmTechnical,
    prewarmOverall,
    prewarmFundamental,
    prewarmFinancials,
    prewarmCongress,
} from '@/entities/analysis/api';
import {
    DrizzleNewsRepository,
    prewarmNews,
} from '@/entities/news-article/api';
import { hasAnalyzableNews } from '@/entities/news-article/lib/hasAnalyzableNews';
import { rewriteToPlainLanguage } from '@/entities/analysis-plain/api';
import {
    resolveCurrentPrice,
    resolvePriceAsOf,
} from '@/entities/analysis-plain/lib/currentPrice';
import {
    currencyForSymbol,
    isKrEquitySymbol,
} from '@/shared/config/marketProfile/registry';
import { prewarmOptions } from '@/entities/options-chain/api';
import { prewarmSessionSpecFor } from '@/entities/seo-snapshot/lib/applicability';
import {
    secondsUntilNextSnapshotBoundary,
    snapshotCloseBoundaryFor,
} from '@/entities/seo-snapshot/lib/freshness';
import {
    isSnapshotBasisStale,
    readSnapshotBasis,
} from '@/entities/seo-snapshot/lib/snapshotBasis';
import {
    addFmpBudget,
    claimBasisForce,
    markSkipped,
    clearInFlight,
    clearStructurallyUnavailable,
    markStructurallyUnavailable,
    NO_RECENT_NEWS_SKIP_TTL_SECONDS,
    TRANSIENT_SKIP_TTL_SECONDS,
} from './lock';
import { fetchPageLastClose } from './lastClose';
import { getDatabaseClient } from '@/shared/db/client';
import type { PrewarmBatchCounts } from './runPrewarmBatch';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

/**
 * 프리웜 평이화 마감. 사용자 경로 기본값(15초)보다 넉넉한 30초. 이 호출은 여기 대신
 * 기다리는 사람이 없다 — 프리웜은 스냅샷을 굽고 끝난다.
 *
 * 30초를 고른 이유는 "얼마나 여유로운가"가 아니라 **이 호출이 어느
 * 예산 안에 있는가**다. `resolveHarvest`는 `runPrewarmBatch.ts`의
 * `UNIT_TIMEOUT_MS`(2분) `Promise.race`가 **끝난 뒤** 실행되므로 그
 * 유닛 타임아웃의 보호를 받지 못하고, 여기서 쓰는 시간은 그대로
 * `BATCH_DEADLINE_MS`(10분)에 순증한다. `deadline exceeded`는 프리웜
 * 유닛의 약 1%뿐이라 그 1%에 +15초를 더하는 비용은 무시할 만하지만,
 * 심볼당 7개 탭이 전부 60초까지 매달리면 배치 예산을 그대로 먹어
 * 스냅샷 커버리지가 준다 — 그래서 45초도 60초도 아니고 30초다.
 */
const PREWARM_PLAIN_DEADLINE_MS = 30_000;

/**
 * "이 유닛은 만들 데이터가 존재하지 않는다"를 뜻하는 seam status.
 *
 * 여기 실린 값만 구조적 불가로 **영구** 확정된다. 확정은 TTL이 없으므로 목록을
 * 늘릴 때는 그 status가 정말 데이터 부재를 뜻하는지 — 일시적 실패나 호출자 설정의
 * 산물이 아닌지 — 확인해야 한다.
 */
const NO_DATA_STATUSES = new Set(['no_trades', 'no_chains_error']);

interface TabSeamContext {
    symbol: string;
    companyName: string;
    fmpSymbol: string | undefined;
}

/**
 * 각 탭 seam의 실제 반환 타입은 서로 다른 discriminated union이지만,
 * `resolveHarvest`가 필요로 하는 최소 구조는 `status`(+ `cached`/`done`일 때만
 * 존재하는 `result`)뿐이다: `cached`/`done`(content 보유 — run*의 "완료" 상태),
 * 그 외 전부(terminal skip). 단일 인터페이스로 잡아야 리터럴 유니온과의
 * narrowing 충돌(TS2339)을 피할 수 있다.
 */
export interface SeamOutcome {
    status: string;
    result?: unknown;
    /**
     * core가 `status:'error'`에 함께 싣는 세부 사유(`no_news`,
     * `usage_limit_exceeded`, `fetch_failed` 등). `status`만으로는 "다시 시도하면
     * 되는 실패"와 "재료가 없어서 못 만드는 실패"가 구분되지 않는다 — 실제로
     * CloudWatch에 `status=error`만 찍히는 바람에 41개 심볼이 무의미하게 재시도되는
     * 걸 알아채는 데 오래 걸렸다. 로그와 backoff 결정 양쪽에서 쓴다.
     */
    code?: string;
    /**
     * overall 전용. core가 어느 축에서 실패했는지를 싣는다. backoff 판단에는
     * 쓰지 않고 **로그에만** 넣는다 — core 1.14.0부터 overall은 뉴스 축의
     * `no_news`를 abstain으로 처리하므로, overall이 `axis:'news'`로 떨어지는 건
     * 재시도하면 달라지는 실패(뉴스 LLM·사용량 한도)뿐이라 기본 30분이 맞다.
     */
    axis?: string;
    /**
     * `prewarmNews` 전용. 이번 실행에서 **외부 적재가 실패**했음을 뜻한다
     * (FMP 장애·402 — 적재는 fail-open이라 그대로 진행된다).
     *
     * 이게 없으면 "30일간 뉴스 없음"과 "오늘 뉴스를 못 가져옴"이 DB 상에서
     * 똑같아 보인다. 전자는 24시간 묶어도 되지만 후자는 30분 티어가 지켜야 할
     * 바로 그 상황이다 — 장애 중에 신규·저커버리지 심볼이 하루 묶이면 안 된다.
     */
    newsFetchFailed?: true;
}

type TabSeamDispatch = (
    ctx: TabSeamContext,
    force?: boolean
) => Promise<SeamOutcome | null>;

/**
 * 탭 → seam 디스패치. **기본은 force=false**다(Task 9 결의: 일상 경로에 force-retry 없음).
 *
 * `force=true`는 한 경우에만 쓴다 — harvest가 캐시된 분석의 기준 시각이 직전 완료 세션보다
 * 앞선 것을 발견했을 때 **경계당 한 번**(`claimBasisForce`) 다시 만든다(`resolveHarvest`).
 */
export const TAB_SEAMS: Record<SeoSnapshotTab, TabSeamDispatch> = {
    technical: (ctx, force = false) =>
        prewarmTechnical(ctx.symbol, ctx.companyName, ctx.fmpSymbol, force),
    overall: (ctx, force = false) =>
        prewarmOverall(ctx.symbol, ctx.companyName, force),
    fundamental: (ctx, force = false) => prewarmFundamental(ctx.symbol, force),
    financials: (ctx, force = false) => prewarmFinancials(ctx.symbol, force),
    congress: (ctx, force = false) => prewarmCongress(ctx.symbol, force),
    news: (ctx, force = false) =>
        prewarmNews(ctx.symbol, ctx.companyName, force),
    options: (ctx, force = false) =>
        prewarmOptions(ctx.symbol, ctx.companyName, force),
};

/**
 * 기준일 검사 대상 탭.
 *
 * technical만이다. 이 탭의 결과(`AnalysisResponse`)가 `analyzedAt`·`dataAsOf`를 싣고, 신선도가
 * **시장 세션 마감**에 묶여 있다(분석 글의 가격이 페이지 종가와 같아야 한다).
 *
 * 다른 탭이 빠진 이유는 서로 다르다:
 *  - options: 결과(`OptionsAnalysisResponse`)에 `analyzedAt`이 있지만 프리웜 대상이 아니고
 *    (`PREWARM_TABS`), 옵션 체인은 세션 마감 가격과 묶인 글이 아니라 기준 봉도 가격도 없다.
 *  - overall·fundamental·financials·congress·news: 결과에 읽을 타임스탬프 필드가 없다
 *    (뉴스 탭의 신선도는 기사 적재가 정한다). 프리웜이 다시 켜지고 core가 필드를 싣게 되면
 *    이 집합에 더한다.
 */
const BASIS_CHECKED_TABS: ReadonlySet<SeoSnapshotTab> = new Set(['technical']);

/** 페이지 종가 조회의 상한. 넘기면 가격 비교만 건너뛴다. */
const PAGE_CLOSE_TIMEOUT_MS = 12_000;

/** 페이지 종가 조회가 부를 수 있는 FMP 호출 수(`runPrewarmBatch`의 탭당 추정과 같은 규모). */
const FMP_CALLS_FOR_PAGE_CLOSE = 1;

/** 가격 불일치 임계값 — 글의 기준 가격이 페이지 종가와 0.3% 넘게 다르면 stale. */
const PRICE_MISMATCH_RATIO = 0.003;

/**
 * 강제 재생성 한 번의 상한. `resolveHarvest`는 유닛 타임아웃(`UNIT_TIMEOUT_MS`) race가 끝난
 * **뒤**에 도므로 그 보호를 못 받는다 — 같은 2분을 여기서 따로 건다(멎은 호출이 배치
 * 예산과 락을 붙들지 않게). 호출 자체는 취소되지 않는다(`runPrewarmBatch`의 같은 한계).
 */
const FORCED_REGEN_TIMEOUT_MS = 120_000;

/** `resolveHarvest`가 기준일 검사·강제 재생성을 하는 데 필요한 문맥. */
export interface HarvestBasisContext {
    readonly seam: TabSeamContext;
    /** 달력 시각 — 마감 경계를 고르는 `now`와 같은 값(배치가 한 번 읽은 것). */
    readonly now: Date;
}

function isHarvestable(result: SeamOutcome | null): result is SeamOutcome {
    return (
        result !== null &&
        (result.status === 'cached' || result.status === 'done')
    );
}

/**
 * 결과의 기준(분석 시각·마지막 봉·가격)이 직전 완료 세션보다 오래됐는가.
 *
 * 시각 검사(`isSnapshotBasisStale`)가 먼저다 — 값싸고 크립토까지 덮는다. 시각이 통과한
 * `cached` 결과에 한해, 비크립토에서 글의 기준 가격을 페이지가 보여 주는 종가와 대조한다
 * (0.3% 초과면 stale). 크립토는 일봉이 장중에도 계속 움직여 비교가 성립하지 않는다.
 * 종가를 못 읽으면(`null`) 비교를 건너뛴다 — 보조 검사가 배치를 막지 않는다.
 *
 * 글의 기준 가격은 `dataAsOf.close`(분석에 쓴 바로 그 봉의 종가)를 우선하고, `dataAsOf`가 없는
 * 옛 결과에서만 `planCheck.currentPrice`로 물러난다(`readSnapshotBasis`). **장중에 만들어진
 * `cached` 결과는 마감 종가와 달라 정당하게 stale로 센다** — 시각 검사가 이미 같은 결론을
 * 내리지만, 시각 정보가 없는 결과에서도 가격이 그것을 잡는다. 어느 쪽이든 강제 재생성은
 * 경계당 한 번이다.
 */
async function isOutcomeStale(
    symbol: string,
    result: SeamOutcome,
    ctx: HarvestBasisContext
): Promise<boolean> {
    const basis = readSnapshotBasis(result.result);
    if (isSnapshotBasisStale(symbol, basis, ctx.now)) return true;
    if (result.status !== 'cached' || basis.close === null) return false;
    if (prewarmSessionSpecFor(symbol).kind === 'always-open') return false;

    // 짧은 상한을 건다 — 이 호출은 유닛 타임아웃 race **밖**이고, 캐시가 비어 있으면 실제
    // 시세 제공자 호출이다. 시간 안에 못 읽으면 가격 비교를 건너뛴다(보조 검사).
    const pageClose = await withTimeoutOrNull(
        fetchPageLastClose(symbol, ctx.seam.fmpSymbol),
        PAGE_CLOSE_TIMEOUT_MS
    );
    // 이 조회는 FMP를 부를 수 있다(KR은 Yahoo라 FMP 예산과 무관) — 실제로 돈 경우에만 센다.
    if (!isKrEquitySymbol(symbol)) await addFmpBudget(FMP_CALLS_FOR_PAGE_CLOSE);
    if (pageClose === null) return false;
    return Math.abs(basis.close - pageClose) / pageClose > PRICE_MISMATCH_RATIO;
}

/** `Promise`를 `ms` 안에 못 끝내면 `null`. 이긴 쪽이 정해지면 타이머를 치운다. */
function withTimeoutOrNull<T>(work: Promise<T>, ms: number): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
        const timer = setTimeout(() => resolve(null), ms);
        timer.unref();
        work.then(resolve, reject).finally(() => clearTimeout(timer));
    });
}

interface BasisEvaluation {
    /** 이후 분기가 다룰 결과 — 강제 재생성이 일어났으면 그 결과다. */
    readonly outcome: SeamOutcome | null;
    /** 최종 결과의 기준이 여전히 직전 완료 세션보다 오래됐는가. */
    readonly stale: boolean;
}

/**
 * harvest 전에 결과의 기준일을 검사하고, 필요하면 **한 번만** 강제 재생성한다.
 *
 * 왜 필요한가: seam이 `cached`를 돌려주면 이 함수는 `generatedAt = new Date()`를 찍는다.
 * 캐시에 있던 분석이 마감 전(또는 전 세션)에 만들어진 것이어도 행은 "오늘 기준"이 되고,
 * 글의 "현재가"가 페이지 상단 종가와 어긋난다(2026-10-05 운영 감사: KR 차트 20개 중 17개).
 *
 * 강제는 `cached`일 때만 의미가 있다 — `done`은 방금 새로 만든 결과라 다시 만들어도 같은
 * 데이터가 나온다(데이터 미발행). 그 경우는 stale로 표시한 채 저장 경로가 처리한다.
 * 강제는 경계당 `(symbol, tab)`마다 한 번(`claimBasisForce` SET NX): 마커가 이미 있으면
 * 이전 tick이 이미 시도했으므로 다시 하지 않는다 — 루프 없음.
 */
async function evaluateBasis(
    symbol: string,
    tab: SeoSnapshotTab,
    result: SeamOutcome,
    ctx: HarvestBasisContext
): Promise<BasisEvaluation> {
    const stale = await isOutcomeStale(symbol, result, ctx);
    if (!stale || result.status !== 'cached') return { outcome: result, stale };

    const boundaryMs = snapshotCloseBoundaryFor(symbol, ctx.now).getTime();
    const claimed = await claimBasisForce(
        symbol,
        tab,
        boundaryMs,
        secondsUntilNextSnapshotBoundary(symbol, ctx.now)
    ).catch(() => false);
    if (!claimed) return { outcome: result, stale: true };

    console.warn(
        `[seo-prewarm] stale-basis ${symbol}:${tab} — forcing one regeneration`
    );
    const forced = await withTimeoutOrNull(
        TAB_SEAMS[tab](ctx.seam, true),
        FORCED_REGEN_TIMEOUT_MS
    );
    if (forced === null) {
        // 시간 초과(또는 seam이 null). 옛 결과는 저장하지 않고 일시적 실패(`error`)로
        // 되돌린다 — 아래 분기가 30분 backoff를 건다.
        console.warn(
            `[seo-prewarm] forced regeneration unavailable ${symbol}:${tab}`
        );
        return {
            outcome: { status: 'error', code: 'forced_regen_unavailable' },
            stale: true,
        };
    }
    if (!isHarvestable(forced)) return { outcome: forced, stale: true };
    return {
        outcome: forced,
        stale: await isOutcomeStale(symbol, forced, ctx),
    };
}

/**
 * 기준일 검사 대상이면 `evaluateBasis`를, 아니면(문맥 없음·대상 탭 아님·harvest 불가 결과)
 * 결과를 그대로 `stale: false`로 돌려준다.
 */
async function resolveBasis(
    symbol: string,
    tab: SeoSnapshotTab,
    seamResult: SeamOutcome | null,
    basis: HarvestBasisContext | undefined
): Promise<BasisEvaluation> {
    if (
        basis === undefined ||
        !BASIS_CHECKED_TABS.has(tab) ||
        !isHarvestable(seamResult)
    ) {
        return { outcome: seamResult, stale: false };
    }
    return evaluateBasis(symbol, tab, seamResult, basis);
}

/**
 * seam 결과를 저장소에 반영한다 (Task 9 결의 — freshness는 오직
 * `seo_analysis_snapshots.generatedAt`으로만 판단한다).
 *
 * seam의 cached 결과 자체에서 생성 시각을 읽지 않는다: 7개 탭 결과 타입 중
 * `AnalysisResponse`(technical, 선택적)와 `OptionsAnalysisResponse`(options)만
 * `analyzedAt`을 갖고 overall/fundamental/financials/congress/news는 아예
 * 타임스탬프 필드가 없다 — 이 정보로 매 tick force-retry를 판단하면 5개 탭이
 * 영원히 "timestamp missing → force" 루프에 빠져 스냅샷을 절대 못 채운다.
 * 대신 `status==='cached'`를 그 자체로 "지금 harvest 가능"으로 취급하고
 * `generatedAt=new Date()`를 찍는다 — 다음 tick은 우리 스냅샷 테이블의
 * `generatedAt` vs boundary로만 stale 여부를 재판단한다(단일 진실 소스).
 *
 * **단, technical은 저장 전에 기준일을 한 번 더 검사한다**(`evaluateBasis`). `cached`가
 * "지금 만든 것"을 뜻하지 않기 때문이다 — 캐시에 있던 분석이 직전 세션 마감 전 데이터로
 * 쓰였다면 `generatedAt`만 오늘인 옛 글이 된다. 그 경우 경계당 한 번 강제 재생성하고,
 * 그래도 stale이면 실제 기준 시각을 담은 채 저장하고 일시적 backoff를 건다.
 * 기준일 검사 대상 탭과 그 이유는 `BASIS_CHECKED_TABS`에 있다.
 *
 * run* 함수는 블로킹이므로 `cached`/`done` 외 모든 상태는 terminal skip이다.
 *
 * FIX C(감사) — terminal 상태(`error`/`miss_no_trigger`/`no_trades`/
 * `no_chains_error`/null result)는 `console.warn`(CloudWatch 가시성 확보 —
 * 기존 `console.debug`는 로그 파이프라인에서 조용히 사라진다)과 함께 6h
 * backoff 마커(`markSkipped`)를 남긴다. backoff 없이 두면 이 유닛이 매
 * 5분 tick마다(하룻밤 ~96회) 재시도되며 head 슬롯을 영구 점유한다 — 6h TTL로
 * 하룻밤 최대 ~2회로 줄인다. 일시적 `error`도 다음날 밤엔 자연 재시도된다
 * (영구 배제 아님).
 *
 * harvest(`cached`/`done`) 또는 terminal skip으로 확정되면 `clearInFlight`로
 * in-flight 마커를 즉시 제거한다 — 그대로 두면 다음 tick이 이미 끝난(또는
 * cleanup된) jobId를 30분 TTL이 만료될 때까지 계속 재-poll 시도한다.
 *
 * @returns 이번 실행으로 해당 탭이 fresh가 되었는지 여부(revalidate 판단용).
 */
export async function resolveHarvest(
    symbol: string,
    tab: SeoSnapshotTab,
    seamResult: SeamOutcome | null,
    repo: DrizzleSeoSnapshotRepository,
    counts: PrewarmBatchCounts,
    basis?: HarvestBasisContext
): Promise<boolean> {
    const { outcome: result, stale: basisStale } = await resolveBasis(
        symbol,
        tab,
        seamResult,
        basis
    );

    if (result === null) {
        /**
         * **여기서는 구조적 불가로 확정하지 않는다** — 의도된 판단이다.
         *
         * `null`을 내는 실질적 경로는 `prewarmOptions`의 NoChains인데,
         * `fetchOptionsSnapshot`의 `null`은 "옵션 없는 종목"과 "Yahoo 일시 장애"를
         * 구분하지 않는다(그쪽 JSDoc이 명시). 확정하면 장애 한 번에 그 종목의
         * options 탭이 영구히 죽는다. `hasOptionsMarket`도 판별자가 못 된다 —
         * 예외에도 `false`를 돌려주므로 같은 혼동을 그대로 물려받는다.
         *
         * 그리고 확정하지 않아도 이 자리에서 영구 stale이 생기지 않는다:
         * `applicableTabsFor`가 `POPULAR_OPTIONS_TICKERS` 화이트리스트로 options
         * 탭을 걸기 때문에, 옵션이 없는 종목에는 애초에 이 탭이 붙지 않는다.
         * 화이트리스트 종목이 옵션 시장을 영구히 잃는 경우는 그 목록에서 빼는 것이
         * 옳은 대응이지, 런타임 블랙리스트가 아니다.
         *
         * 즉 6시간 backoff로 충분하다. 상류 seam이 NoChains와 장애를 구분해 서로
         * 다른 status로 돌려주게 되면 그때 이 분기도 확정 대상이 된다.
         */
        console.warn(`[seo-prewarm] skip ${symbol}:${tab} — null result`);
        await markSkipped(symbol, tab);
        await clearInFlight(symbol, tab);
        return false;
    }

    if (result.status === 'cached' || result.status === 'done') {
        /**
         * 렌더 가능한 산문이 없는 결과는 **저장하지 않는다.** 페이지는 산문이 없으면 noindex
         * (`no-prose`)이고 sitemap도 뺀다 — 서사 필드가 빈 결과로 옛 행을 덮으면 멀쩡하던 종목이
         * 곧바로 색인에서 빠진다. 저장을 건너뛰면 옛 행이 `SNAPSHOT_MAX_AGE_MS`(7일) 동안
         * 남아 일시 실패에 대한 히스테리시스가 된다. 평이화(LLM) 호출 **전에** 끊어 비용도
         * 아낀다. 일시적 빈 응답일 수 있어 TRANSIENT backoff를 건다(영구 확정 아님).
         */
        if (!hasProseForTab(tab, result.result)) {
            console.warn(
                `[seo-prewarm] skip ${symbol}:${tab} — result has no renderable prose (upsert skipped)`
            );
            await markSkipped(symbol, tab, TRANSIENT_SKIP_TTL_SECONDS);
            await clearInFlight(symbol, tab);
            return false;
        }

        /**
         * 평이화("쉽게보기")를 스냅샷과 **같은 시점에** 굽는다.
         *
         * 여섯 탭(overall·news·fundamental·financials·options·congress)은
         * 스냅샷이 있으면 클라이언트 AI 위젯을 아예 마운트하지 않는다
         * (`hasCongressProse`·`hasOverallProse` 등의 XOR 게이팅). 위젯이 없으면
         * 거기 붙어 있던 쉽게보기 토글도 함께 사라져, 실제로는 차트 탭에서만
         * 동작했다 — 실증으로 확인한 결함이다.
         *
         * 방문 시점에 평이화를 돌리는 대신 여기서 굽는 이유: 그 탭들은 스냅샷을
         * 그대로 서빙하므로 방문마다 LLM 왕복이 순증한다. 프리웜은 심볼당 하루
         * 한 번꼴이라 비용이 상수로 묶인다.
         *
         * 실패하면 `null`이다 — `rewriteToPlainLanguage`는 절대 throw하지 않고,
         * 소비자는 `null`이면 토글 없이 원문만 보여준다. 즉 이 호출이 실패해도
         * 스냅샷 자체는 예전과 똑같이 저장된다.
         */
        /*
         * 현재가를 함께 넘긴다. `fundamental`·`news`·`financials` payload에는
         * 숫자 필드가 없어, 없이 돌리면 모델이 "현재 주가가 어느 수준인지는
         * 제시된 자료에 명시되어 있지 않지만"으로 글을 연다 — 실제로 이 배선이
         * 빠진 채 구운 fundamental 평이화가 그 문장으로 시작했고, 그대로 검색
         * 스니펫에 실린다.
         */
        const plain = await rewriteToPlainLanguage(
            result.result,
            symbol,
            DEFAULT_LOCALE,
            currencyForSymbol(symbol),
            await resolveCurrentPrice(symbol, result.result),
            // 가격 기준 시점 — 구운 글이 며칠 뒤에도 "지금"으로 읽히지 않게 한다.
            await resolvePriceAsOf(symbol, DEFAULT_LOCALE, result.result),
            PREWARM_PLAIN_DEADLINE_MS
        );

        await repo.upsert({
            symbol,
            tab,
            plain,
            // 프리웜은 현재 한국어로만 생성한다 — 로케일별 프리웜은 화이트리스트로
            // 통제해야 해서(설계 §2.5·§6.4) 별도 작업이다. 컬럼을 명시해 두면
            // 그 작업이 이 값만 바꾸면 되고, 지금 저장되는 행이 어느 언어인지도
            // 분명해진다.
            locale: DEFAULT_LOCALE,
            content: result.result,
            // 저장소 `model` 필드는 seam이 보낸 modelId(DEEPSEEK_V4_1_FLASH_MODEL)와
            // 통일한다: 어떤 축의 cached 결과도 자체적으로 모델 식별자를 싣지
            // 않는다(spec 2026-07-24 Task 9 결의 §"resolveHarvest" — 각 결과
            // 타입에 model 필드가 없음을 확인).
            model: DEEPSEEK_V4_1_FLASH_MODEL,
            generatedAt: new Date(),
        });
        counts.harvested++;
        if (basisStale) {
            /**
             * 강제 재생성 뒤에도(또는 강제할 수 없어서) 기준이 직전 완료 세션보다 오래됐다 —
             * 데이터가 아직 발행되지 않은 경우다. 행은 저장하되(내용의 `analyzedAt`·`dataAsOf`가
             * 실제 기준 시각을 그대로 담고 있어 캡션이 정직해진다) 다음 tick이 같은 유닛을
             * 바로 다시 집지 않게 일시적 backoff를 건다. 루프는 없다 — 강제는 경계당 한 번이다.
             */
            console.warn(
                `[seo-prewarm] stale-basis ${symbol}:${tab} — stored with its real basis time, backing off`
            );
            await markSkipped(symbol, tab, TRANSIENT_SKIP_TTL_SECONDS);
        }
        /**
         * 구조는 변한다 — 의회 거래가 없던 종목에 거래가 신고되고, 옵션이 새로
         * 상장된다. 한 번이라도 만들어졌으면 그 조합은 더 이상 "불가능"이 아니므로
         * 확정을 해제한다. 이게 자동 복구 경로다: 선별(stale 판정)에서는 빠지지만
         * 다른 탭이 stale해져 심볼이 선택되면 6시간 backoff가 만료된 뒤 한 번
         * 재시도되고, 그때 성공하면 여기서 풀린다.
         */
        await clearStructurallyUnavailable(symbol, tab);
        await clearInFlight(symbol, tab);
        return true;
    }

    /**
     * `status:'error'`는 **일시적 실패**로 본다 — core의 fundamental/financials/congress
     * 축은 FMP fetch 실패를 throw가 아니라 `{status:'error', code:'fetch_failed'}`로
     * **반환**한다(overall은 fundamental 축 실패를 그대로 전파). 즉 FMP 장애 한 번이
     * 이 경로로 들어오는데, 여기에 기본 6시간 backoff를 걸면 4개 축이 그날 밤 내내
     * (창이 7.5시간) 배제된다 — 스냅샷이 24시간 더 낡고, 그게 2026-07 노출 절벽의
     * 느린 붕괴 경로다.
     *
     * 구조적으로 불가능한 유닛(`no_trades`, `no_chains_error`, `miss_no_trigger`,
     * null 결과)만 6시간 기본값을 유지한다.
     */
    const isTransient = result.status === 'error';
    /**
     * `error` 중에서도 "최근 30일 뉴스 없음"은 30분 뒤에 달라질 수 있는 상태가
     * 아니다. 이 갈래만 24시간으로 늘린다 — 근거와 실측은
     * `NO_RECENT_NEWS_SKIP_TTL_SECONDS` 주석에 있다.
     *
     * `code:'no_news'`만으로 확정하지 않고 **DB를 한 번 더 본다**. 그 code는
     * "이번 호출에 넘긴 배열이 비었다"는 뜻일 뿐이고, `prewarmNews`는 이 시점에
     * 이미 적재를 마쳤으므로 여기서도 0건이어야 "이번 창에 쓸 재료가 실제로
     * 없다"가 성립한다.
     */
    const noRecentNews =
        isTransient &&
        // **`news` 탭 전용이다.** core 1.14.0부터 `runOverallAnalysis`는 뉴스 축의
        // `no_news`를 abstain으로 처리하므로 overall은 뉴스가 없다고 실패하지
        // 않는다 — 이제 overall이 `axis:'news'`로 떨어지는 건 뉴스 LLM 실패나
        // 사용량 한도처럼 **재시도하면 달라지는** 상태뿐이라 30분이 맞다.
        // (탭을 넓히면 `newsFetchFailed`도 함께 넓혀야 한다. 그 신호는
        // `prewarmNews`만 만들 수 있어 overall에서는 항상 미설정이고, 그러면
        // FMP 장애 중에 overall만 24h로 묶이는 비대칭이 생긴다.)
        tab === 'news' &&
        // 적재 자체가 실패한 밤은 판단 근거가 없다 — 일시적 실패로 되돌린다.
        result.newsFetchFailed !== true &&
        result.code === 'no_news' &&
        !(await hasAnalyzableNews(
            new DrizzleNewsRepository(getDatabaseClient().db),
            symbol
        ));

    console.warn(
        `[seo-prewarm] skip ${symbol}:${tab} — status=${result.status}` +
            `${result.code !== undefined ? ` code=${result.code}` : ''}` +
            `${result.axis !== undefined ? ` axis=${result.axis}` : ''}` +
            `${noRecentNews ? ' (no analyzable news in window — 24h backoff)' : ''}`
    );
    await markSkipped(
        symbol,
        tab,
        noRecentNews
            ? NO_RECENT_NEWS_SKIP_TTL_SECONDS
            : isTransient
              ? TRANSIENT_SKIP_TTL_SECONDS
              : undefined
    );
    /**
     * 구조적으로 불가능한 유닛은 **영속** 집합에도 넣는다 — backoff만으로는
     * 6시간마다 되살아나 배치 슬롯을 먹고, 무엇보다 그 심볼이 stale 집합에서
     * 영영 못 빠져나온다(`loadStructurallyUnavailable` JSDoc의 실측 참고).
     *
     * **화이트리스트로 판정한다.** `SeamOutcome.status`가 `string`이라 타입이
     * 좁혀지지 않으므로, "이것들만 아니면 구조적"이라는 부정 조건은 코드가 모르는
     * 미래의 status를 기본값으로 영구 블랙리스트한다 — 확정은 TTL이 없어 되돌리기
     * 어려운 방향이라, 모를 때는 확정하지 않는 쪽이 안전하다.
     *
     * 그래서 아래 두 상태는 목록에 없다:
     *
     * - `error`(=`isTransient`): FMP 장애 한 번이 이 경로로 들어온다. 영구 확정하면
     *   장애가 끝나도 그 유닛이 다시는 안 만들어진다.
     * - `miss_no_trigger`: core 계약상 **호출자가 `skipEnqueueIfMiss: true`를 넘겼을
     *   때만** 나온다 — 데이터 부재가 아니라 caller 설정의 산물이다. 지금은 모든
     *   prewarm seam이 `false`를 하드코딩해 도달 불가능하지만, 그 불변식이 이
     *   분류에 묶여 있지 않다.
     */
    if (NO_DATA_STATUSES.has(result.status)) {
        await markStructurallyUnavailable(symbol, tab);
    }
    await clearInFlight(symbol, tab);
    return false;
}
