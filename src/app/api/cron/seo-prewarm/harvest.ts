import 'server-only';
import { DEEPSEEK_V4_FLASH_MODEL } from '@y0ngha/siglens-core';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import type { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import {
    prewarmTechnical,
    prewarmOverall,
    prewarmFundamental,
    prewarmFinancials,
    prewarmCongress,
} from '@/entities/analysis/api';
import { prewarmNews } from '@/entities/news-article/api';
import { prewarmOptions } from '@/entities/options-chain/api';
import {
    markSkipped,
    clearInFlight,
    clearStructurallyUnavailable,
    markStructurallyUnavailable,
    TRANSIENT_SKIP_TTL_SECONDS,
} from './lock';
import type { PrewarmBatchCounts } from './runPrewarmBatch';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

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
}

type TabSeamDispatch = (ctx: TabSeamContext) => Promise<SeamOutcome | null>;

/** 탭 → seam 디스패치. 모든 seam은 force=false로 호출한다(Task 9 결의: force-retry 경로 없음). */
export const TAB_SEAMS: Record<SeoSnapshotTab, TabSeamDispatch> = {
    technical: ctx =>
        prewarmTechnical(ctx.symbol, ctx.companyName, ctx.fmpSymbol, false),
    overall: ctx => prewarmOverall(ctx.symbol, ctx.companyName, false),
    fundamental: ctx => prewarmFundamental(ctx.symbol, false),
    financials: ctx => prewarmFinancials(ctx.symbol, false),
    congress: ctx => prewarmCongress(ctx.symbol, false),
    news: ctx => prewarmNews(ctx.symbol, ctx.companyName, false),
    options: ctx => prewarmOptions(ctx.symbol, ctx.companyName, false),
};

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
    result: SeamOutcome | null,
    repo: DrizzleSeoSnapshotRepository,
    counts: PrewarmBatchCounts
): Promise<boolean> {
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
        await repo.upsert({
            symbol,
            tab,
            // 프리웜은 현재 한국어로만 생성한다 — 로케일별 프리웜은 화이트리스트로
            // 통제해야 해서(설계 §2.5·§6.4) 별도 작업이다. 컬럼을 명시해 두면
            // 그 작업이 이 값만 바꾸면 되고, 지금 저장되는 행이 어느 언어인지도
            // 분명해진다.
            locale: DEFAULT_LOCALE,
            content: result.result,
            // 저장소 `model` 필드는 seam이 보낸 modelId(DEEPSEEK_V4_FLASH_MODEL)와
            // 통일한다: 어떤 축의 cached 결과도 자체적으로 모델 식별자를 싣지
            // 않는다(spec 2026-07-24 Task 9 결의 §"resolveHarvest" — 각 결과
            // 타입에 model 필드가 없음을 확인).
            model: DEEPSEEK_V4_FLASH_MODEL,
            generatedAt: new Date(),
        });
        counts.harvested++;
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
    console.warn(
        `[seo-prewarm] skip ${symbol}:${tab} — status=${result.status}`
    );
    await markSkipped(
        symbol,
        tab,
        isTransient ? TRANSIENT_SKIP_TTL_SECONDS : undefined
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
