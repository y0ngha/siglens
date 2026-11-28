import 'server-only';
import { revalidateTag } from 'next/cache';
import { hasPrewarmedOverall } from '@/entities/analysis/api';
import { overallPeekTag } from '@/entities/analysis/lib/overallPeekTag';
import {
    secondsUntilNextSnapshotBoundary,
    shouldDeferPrewarmWhileOpen,
    snapshotCloseBoundaryFor,
} from '@/entities/seo-snapshot/lib/freshness';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';
import { MS_PER_HOUR } from '@/shared/config/time';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { TAB_SEAMS } from './harvest';
import {
    addFmpBudget,
    addOverallWarmPending,
    bumpOverallWarmPendingChecks,
    claimOverallWarm,
    getOverallWarmStartsToday,
    incrementOverallWarmStartsToday,
    isOverallWarmClaimed,
    listOverallWarmPending,
    removeOverallWarmPending,
    type OverallWarmPendingEntry,
} from './lock';

/**
 * 종합(overall) 분석 사전 생성 한 번(자산 정보 조회 + core 호출)의 상한(ms).
 *
 * 저장소가 적어 둔 종합 분석 한 번의 상한이 250초다(`getCachedAnalysis.ts`의 "30~250초짜리 종합 분석",
 * `runFreshAnalysis.ts`의 "SSE 슬롯 30–250s"). 탭 유닛 상한(`UNIT_TIMEOUT_MS` 120초)을 그대로 쓰면 느린
 * 밤에 포기한 호출이 곧 캐시를 채우는데도 태그를 못 털어 페이지가 빈 엿보기를 몇 시간 들고 있다.
 * 자산 정보 조회(배치 FMP 정책의 긴 timeout·429 대기)도 이 상한 **안**에서 돈다 — 경쟁 밖에 두면 시작
 * 한도 산식이 덮지 못한다.
 */
export const OVERALL_WARM_TIMEOUT_MS = 250_000;

/**
 * 종합 단계가 끝난 뒤 배치 예산(`BATCH_WALL_CLOCK_BUDGET_MS`) 안에 남겨 둘 몫(ms) — IndexNow 제출(자체
 * 상한 5초), 펀더멘털 스탬프, 예산 집계, 그리고 같은 락 안에서 이어 도는 옵션 워밍(`runSeoPrewarmJob`)의 몫.
 */
export const OVERALL_WARM_TAIL_RESERVE_MS = 120_000;

/**
 * 한 tick에서 시작하는 종합 사전 생성 수의 상한. 종합 한 번이 최대 250초라 무제한이면 tick 하나가
 * 5분 주기를 넘겨 다음 tick이 락에 막힌다(`SYMBOLS_PER_TICK` 주석의 처리량 반토막 경로). 상위 목록은
 * 밤새 이어지는 tick들에 나뉘어 돈다.
 */
export const OVERALL_WARM_MAX_PER_TICK = 5;

/**
 * UTC 하루 동안 시작할 수 있는 종합 사전 생성의 **하드 상한**(전 시장 합계).
 *
 * "경계당 상위 20개"는 비용 상한이 아니다 — 상위 목록은 tick마다 다시 계산되고(미국 창은 KST 낮 시간이라
 * 조회가 쌓이는 중이다) 목록에 새로 들어온 심볼은 각자 claim을 얻는다. 이 카운터가 시작 수 자체를 끊는다.
 * 주간 최악: 24시작 × 7일 × 시작당 신규 LLM 호출 3(펀더멘털·옵션·종합 축 — technical·news 축은 앞서 구운
 * 캐시를 맞힌다) = 504호출. 경계당 한 번 claim(`claimOverallWarm`)은 그 안에서 같은 심볼의 재시도를 막는다.
 */
export const OVERALL_WARM_MAX_STARTS_PER_UTC_DAY = 24;

/**
 * 포기한 호출의 대기 항목이 살아 있는 최대 시간. 프리웜 창 사이 가장 긴 공백(7.5시간)에 여유를 더한
 * 12시간 — 항목은 시작 시각 기준으로 이때 버려진다(영원히 남지 않는다).
 */
export const OVERALL_WARM_PENDING_MAX_AGE_MS = 12 * MS_PER_HOUR;

/** 캐시 확인이 계속 "아직 없음"이면 이 횟수에서 항목을 버린다(tick당 한 번 확인). */
export const OVERALL_WARM_PENDING_MAX_CHECKS = 12;

/*
 * 시작 가능 조건(예산 산식). 배치 예산 `BATCH_WALL_CLOCK_BUDGET_MS`는 락 TTL 900초에서 안전 여유 60초를
 * 뺀 840초이고, 기준점은 **락 획득 시각**이다(배치 시작이 아니다 — 신호 이력 단계가 그 앞에서 최대 60초를
 * 쓴다). 한 건을 시작하는 시각 `t`가
 *
 *   t + OVERALL_WARM_TIMEOUT_MS(250s) + OVERALL_WARM_TAIL_RESERVE_MS(120s) <= 락 획득 + 840s
 *
 * 를 만족해야 한다, 즉 락 획득 후 470초 안에만 시작한다. 모자라면 **claim을 잡지 않고** 건너뛰고
 * (`overallWarmSkippedByBudget`) 다음 tick이 다시 본다.
 */
export interface OverallWarmCounts {
    /** 종합을 만들어(`cached`/`done`) 태그를 턴 심볼 수. */
    overallWarmed: number;
    /** 시간 예산이 모자라 claim 없이 건너뛴 (심볼, tick) 수. 다음 tick이 다시 시도한다. */
    overallWarmSkippedByBudget: number;
    /** 이번 tick에 심볼 처리 대기열이 남아 단계 전체를 건너뛴 tick 수(0 또는 1). */
    overallWarmSkippedByBacklog: number;
    /** UTC 하루 시작 상한에 닿아 claim 없이 건너뛴 (심볼, tick) 수. */
    overallWarmSkippedByDailyCap: number;
    /** `OVERALL_WARM_TIMEOUT_MS`를 넘겨 기다리기를 포기한 수. 대기 목록에 올린다. */
    overallWarmTimedOut: number;
    /** `cached`/`done`이 아니거나 던진 수. */
    overallWarmFailed: number;
    /** 포기한 뒤 캐시 적중을 확인하고 이번 tick에 태그를 턴 수. */
    overallWarmPendingRevalidated: number;
}

export interface OverallWarmClock {
    now: () => number;
    sleep: (ms: number) => Promise<void>;
}

export interface OverallWarmInput {
    /** 조회 많은 순 상위 심볼(`ViewDemand.overallWarm`, 최대 20). */
    readonly symbols: readonly string[];
    /** 달력 시각(마감 경계·UTC 날짜 계산용). */
    readonly now: Date;
    readonly clock: OverallWarmClock;
    /** 락 획득 시각 + `BATCH_WALL_CLOCK_BUDGET_MS`(ms). */
    readonly wallClockEndMs: number;
    /**
     * 이번 tick의 심볼 처리에 대기열이 남았는가(배치가 가득 찼거나 마감에 걸렸다). 심볼 처리가 종합
     * 사전 생성보다 우선한다 — 종합은 한 번에 최대 250초라 락을 오래 쥐어 다음 tick을 밀어낸다.
     */
    readonly hasBacklog: boolean;
    /** 이 심볼의 technical 스냅샷이 현재 경계 기준으로 fresh한가(이번 실행에서 막 만든 것 포함). */
    readonly isTechnicalFresh: (symbol: string) => boolean;
    /** 탭 하나당 FMP 호출 추정치(`runPrewarmBatch`와 같은 값). */
    readonly fmpCallsPerTab: (symbol: string) => number;
    readonly counts: OverallWarmCounts;
}

/**
 * 종합 사전 생성 단계 — tick마다 심볼 처리와 **무관하게** 상위 목록을 훑는다.
 *
 * 심볼 처리 안에 두면 그 심볼이 이번 tick에 stale이 아니거나 마감이 지난 뒤 도달했을 때 그날 밤 아무
 * tick도 다시 방문하지 않아 사전 생성이 소리 없이 사라진다. 여기서는 (1) 앞서 포기한 호출의 대기 목록을
 * 먼저 확인하고(싸다, LLM 없음 — 대기열이 있어도 돈다), (2) 대기열이 없을 때만 목록을 돌며 시작 가능한
 * 심볼을 시도한다.
 *
 * 스냅샷 행은 쓰지 않고 평이화도 하지 않는다 — 이 탭은 페이지가 항상 noindex이고 행이 있어도
 * `getSnapshotStatic`이 버린다. 결과는 core의 분석 캐시에만 남는다(사용자 경로와 같은 키).
 * 어떤 오류도 던지지 않는다(다른 유닛과 같은 fail-open).
 */
export async function runOverallWarmStep(
    input: OverallWarmInput
): Promise<void> {
    await revalidateAbandonedWarms(input);
    if (input.symbols.length === 0) return;
    if (input.hasBacklog) {
        input.counts.overallWarmSkippedByBacklog++;
        return;
    }
    await warmFrom(input.symbols, input, 0);
}

/**
 * 시간 초과로 포기한 호출의 태그 재검증. 대기 목록은 오늘의 상위 목록과 무관하게 전부 읽는다.
 *
 * 항목마다: 12시간이 지났거나 확인 횟수가 찼으면 버린다(영원히 남지 않는다). `OVERALL_WARM_TIMEOUT_MS`가
 * 지나기 전이면 기다린다. 지났으면 캐시에 이 호출 시작 이후의 **새 결과**가 있는지 읽기 전용으로 확인하고(`hasPrewarmedOverall` —
 * 페이지가 읽는 것과 같은 캐시, LLM 없음) 있을 때만 태그를 턴다. 아직 없으면(이전 결과만 있어도 같다) 확인 횟수만 올려 다음 tick에
 * 다시 본다 — 그냥 털면 페이지가 빈 엿보기를 다시 몇 시간 캐시한다. 포기한 promise에는 아무것도 매달지
 * 않는다(프로세스가 끝나면 함께 사라진다).
 */
async function revalidateAbandonedWarms(input: OverallWarmInput) {
    const entries = await loadPendingEntries();
    await Promise.all(entries.map(entry => settlePending(entry, input)));
}

async function loadPendingEntries(): Promise<OverallWarmPendingEntry[]> {
    try {
        return await listOverallWarmPending();
    } catch (error) {
        console.error(
            '[seo-prewarm] overall-warm pending list error',
            redactDbErrorForLog(error)
        );
        return [];
    }
}

/**
 * 캐시 확인은 항목의 `analyzedAt`이 이 호출의 시작 시각 이후인지로 새 결과를 가린다
 * (`hasPrewarmedOverall`). 엿보기 키는 최신 결과를 덮어쓰는 포인터라 어제의 사전 생성이나 방문자가 만든
 * 이전 결과도 "있다"로 읽히는데, 그걸로 태그를 털면 새 결과가 아직 안 올라온 채 항목만 지워진다.
 * `analyzedAt`이 없는 옛 항목은 이전 결과로 보고 계속 기다린다.
 */
async function settlePending(
    entry: OverallWarmPendingEntry,
    input: OverallWarmInput
) {
    try {
        const ageMs = input.clock.now() - entry.startedAtMs;
        if (
            ageMs >= OVERALL_WARM_PENDING_MAX_AGE_MS ||
            entry.checks >= OVERALL_WARM_PENDING_MAX_CHECKS
        ) {
            await removeOverallWarmPending(entry.member);
            console.warn(
                `[seo-prewarm] overall-warm pending dropped ${entry.symbol} after ${entry.checks} checks — cache never showed the result`
            );
            return;
        }
        if (ageMs < OVERALL_WARM_TIMEOUT_MS) return;
        if (await hasPrewarmedOverall(entry.symbol, entry.startedAtMs)) {
            revalidateTag(overallPeekTag(entry.symbol), 'max');
            await removeOverallWarmPending(entry.member);
            input.counts.overallWarmPendingRevalidated++;
            return;
        }
        await bumpOverallWarmPendingChecks(entry);
    } catch (error) {
        console.error(
            `[seo-prewarm] overall-warm pending revalidate error ${entry.symbol}`,
            redactDbErrorForLog(error)
        );
    }
}

/** 목록을 앞에서부터 순서대로 훑는다(재귀 — 한 번에 하나, 시작한 수를 들고 간다). */
async function warmFrom(
    remaining: readonly string[],
    input: OverallWarmInput,
    started: number
): Promise<void> {
    const [symbol, ...rest] = remaining;
    if (symbol === undefined || started >= OVERALL_WARM_MAX_PER_TICK) return;
    const didStart = await tryWarm(symbol, input);
    return warmFrom(rest, input, started + (didStart ? 1 : 0));
}

/** @returns 이번에 종합 호출을 실제로 시작했으면 true. */
async function tryWarm(
    symbol: string,
    input: OverallWarmInput
): Promise<boolean> {
    const { now, clock, counts } = input;
    try {
        // 자기 시장이 장중이면 형성 중인 봉으로 만들게 되므로 탭 유닛과 같이 미룬다.
        if (shouldDeferPrewarmWhileOpen(symbol, now)) return false;
        if (!input.isTechnicalFresh(symbol)) return false;

        const boundaryMs = snapshotCloseBoundaryFor(symbol, now).getTime();
        // 이미 시도한 심볼은 예산 부족·일일 상한으로도 세지 않는다.
        if (await isOverallWarmClaimed(symbol, boundaryMs)) return false;

        const startsBy =
            input.wallClockEndMs -
            OVERALL_WARM_TAIL_RESERVE_MS -
            OVERALL_WARM_TIMEOUT_MS;
        if (clock.now() > startsBy) {
            counts.overallWarmSkippedByBudget++;
            return false;
        }

        const utcDay = now.toISOString().slice(0, 10);
        if (
            (await getOverallWarmStartsToday(utcDay)) >=
            OVERALL_WARM_MAX_STARTS_PER_UTC_DAY
        ) {
            counts.overallWarmSkippedByDailyCap++;
            return false;
        }

        const claimed = await claimOverallWarm(
            symbol,
            boundaryMs,
            secondsUntilNextSnapshotBoundary(symbol, now)
        );
        if (!claimed) return false;

        // 실제로 시작하는 순간에만 센다.
        await incrementOverallWarmStartsToday(utcDay);
        await warmOne(symbol, input);
        return true;
    } catch (error) {
        counts.overallWarmFailed++;
        console.error(
            `[seo-prewarm] overall-warm error ${symbol}`,
            redactDbErrorForLog(error)
        );
        return false;
    }
}

async function warmOne(symbol: string, input: OverallWarmInput) {
    const { clock, counts } = input;
    const startedAtMs = clock.now();
    const raceResult = await Promise.race([
        // 자산 정보 조회도 같은 상한 안에서 돈다.
        getAssetInfoResilient(symbol)
            .then(({ assetInfo }) =>
                TAB_SEAMS.overall({
                    symbol,
                    companyName: assetInfo?.name ?? symbol,
                    fmpSymbol: assetInfo?.fmpSymbol,
                })
            )
            .then(value => ({ timedOut: false as const, value })),
        clock
            .sleep(OVERALL_WARM_TIMEOUT_MS)
            .then(() => ({ timedOut: true as const })),
    ]);

    if (raceResult.timedOut) {
        counts.overallWarmTimedOut++;
        console.warn(
            `[seo-prewarm] overall-warm timed out ${symbol} after ${OVERALL_WARM_TIMEOUT_MS}ms — core call may still finish, revalidation deferred to a later tick`
        );
        await addOverallWarmPending(symbol, startedAtMs);
        return;
    }

    const status = raceResult.value?.status ?? 'null';
    if (status !== 'cached' && status !== 'done') {
        counts.overallWarmFailed++;
        console.warn(
            `[seo-prewarm] overall-warm skip ${symbol}: status=${status}`
        );
        return;
    }
    revalidateTag(overallPeekTag(symbol), 'max');
    counts.overallWarmed++;
    await addFmpBudget(input.fmpCallsPerTab(symbol));
}
