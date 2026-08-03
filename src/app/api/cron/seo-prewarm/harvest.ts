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
import { markSkipped, clearInFlight } from './lock';
import type { PrewarmBatchCounts } from './runPrewarmBatch';

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
        console.warn(`[seo-prewarm] skip ${symbol}:${tab} — null result`);
        await markSkipped(symbol, tab);
        await clearInFlight(symbol, tab);
        return false;
    }

    if (result.status === 'cached' || result.status === 'done') {
        await repo.upsert({
            symbol,
            tab,
            content: result.result,
            // 저장소 `model` 필드는 seam이 보낸 modelId(DEEPSEEK_V4_FLASH_MODEL)와
            // 통일한다: 어떤 축의 cached 결과도 자체적으로 모델 식별자를 싣지
            // 않는다(spec 2026-07-24 Task 9 결의 §"resolveHarvest" — 각 결과
            // 타입에 model 필드가 없음을 확인).
            model: DEEPSEEK_V4_FLASH_MODEL,
            generatedAt: new Date(),
        });
        counts.harvested++;
        await clearInFlight(symbol, tab);
        return true;
    }

    console.warn(
        `[seo-prewarm] skip ${symbol}:${tab} — status=${result.status}`
    );
    await markSkipped(symbol, tab);
    await clearInFlight(symbol, tab);
    return false;
}
