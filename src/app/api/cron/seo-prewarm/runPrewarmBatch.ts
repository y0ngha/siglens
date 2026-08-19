import 'server-only';
import { revalidateTag } from 'next/cache';
import {
    buildPrewarmUniverse,
    isSnapshotFresh,
    shouldDeferPrewarmWhileOpen,
    snapshotCloseBoundaryFor,
    type PrewarmSymbol,
    type SeoSnapshotTab,
} from '@/entities/seo-snapshot';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { getDatabaseClient } from '@/shared/db/client';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getFmpErrorStatus } from '@/shared/api/fmp/fmpUserMessage';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import {
    addFmpBudget,
    advanceRotationCursor,
    clearInFlight,
    getFmpBudgetUsed,
    getInFlightMarker,
    isSkipped,
    markInFlight,
    markSkipped,
    TRANSIENT_SKIP_TTL_SECONDS,
} from './lock';
import { TAB_SEAMS, resolveHarvest } from './harvest';

export interface PrewarmBatchCounts {
    harvested: number;
    /**
     * 이번 tick 시작 시점의 stale 심볼 총량과 배치 wall-clock(ms).
     *
     * 커버리지 침식은 데드라인에 **걸리기 전부터** 시작된다: 유닛 지연이 늘어 배치가
     * tick 주기(5분)를 넘기면 Redis 락 때문에 다음 배치가 한 tick 밀리고, 하룻밤
     * 처리량이 반토막 난다 — 그런데 `BATCH_DEADLINE_MS`(10분)에는 안 걸리니
     * deadline 알람도 안 뜬다. 이 두 값이 그 구간을 보는 유일한 창이다.
     */
    staleTotal: number;
    durationMs: number;
    revalidated: number;
    remaining: number;
    fmpBudgetUsed: number;
}

/**
 * FIX Z(감사) — run* 함수가 LLM 블로킹 호출이라 심볼당 소요 시간이 길다.
 * 원래 10 → 6으로 낮춰 청크(SYMBOL_CONCURRENCY와 같아 1청크)당 최악 대기가
 * 과도해지지 않게 한다 — 실제 상한은 BATCH_DEADLINE_MS가 건다(이 상수는
 * "정상 tick의 목표 처리량"일 뿐, 배치 전체를 막는 하드 캡이 아니다).
 */
const SYMBOLS_PER_TICK = 6;
/**
 * 한 청크에서 병렬 처리할 심볼 수.
 *
 * 3 → 6으로 올렸다. worker 시절에는 seam이 submit만 하고 즉시 반환해(LLM은 워커에서
 * 돌고, 못 끝낸 유닛은 jobId로 다음 tick이 이어받았다) 배치 wall-clock이 LLM 지연과
 * 무관했다. 지금은 `run*`가 LLM 왕복 내내 블로킹하므로 배치 시간이 그대로 지연에 비례한다.
 *
 * 탭 루프는 심볼 안에서 **직렬**이므로(캐시 재사용 목적), 배치 시간 ≈
 * `ceil(SYMBOLS_PER_TICK / SYMBOL_CONCURRENCY) × 탭수 × 유닛지연`이다. 3이면 2청크라
 * 유닛당 ~21초만 넘어도 하룻밤에 유니버스(294심볼)를 못 돈다. 실측 유닛 지연은
 * 콜드 상태에서 30초대(dev 서버 계측: technical 31.8s/34.3s, market briefing 46s)라
 * 그 선을 이미 넘는다. 6이면 1청크가 되어 배치 시간이 절반이 되고 tick 간격(5분)
 * 안에 들어온다.
 *
 * 비용: core fundamental이 Promise.all로 ~13개 FMP 호출을 한번에 쏘므로 순간 버스트가
 * 3×13≈40 → 6×13≈78로 는다. FMP 예산 집계(`addFmpBudget`)와 429 백오프(`fmpRetry`)가
 * 그대로 받는다. 버스트가 문제가 되면 이 값이 아니라 스케줄 폭을 넓히는 쪽이 맞다 —
 * `BATCH_DEADLINE_MS`는 회전 불변식(아래) 때문에 못 올린다.
 */
const SYMBOL_CONCURRENCY = 6;
// FIX A(감사) — bounded in-flight/backoff 후보 스캔 폭. selectFairBatch 참고.
//
// 2026-08 감사(KR 5종목 prewarm 미도달) — 예전엔 이 값이 "회전 오프셋이 시각에서 파생돼 배치가
// 지연되면 창을 건너뛸 수 있다"는 불변식(`BATCH_DEADLINE_MS + 스케줄주기 ≤
// SYMBOLS_PER_TICK × CANDIDATE_WINDOW_MULTIPLIER`)의 절반을 담당했다 — 그 불변식은
// "정확히 경계"라 여유가 없었다(경계 유도 과정은 git blame으로 확인 가능).
// 오프셋을 Redis 영속 커서(`lock.ts`의 `advanceRotationCursor`, 실행 1회당
// `SYMBOLS_PER_TICK`만큼만 전진)로 바꾼 뒤로는 배치가 아무리 지연돼도 창이 건너뛰지
// 않으므로 이 불변식 자체가 사라졌다 — 지금 이 상수는 순수하게 "bounded 스캔 비용"만
// 결정한다(아래 selectFairBatch doc-comment ②).
const CANDIDATE_WINDOW_MULTIPLIER = 3;
// FIX G(감사) — 배치 전체 wall-clock 상한. LOCK_TTL_SECONDS(900s)보다 충분히
// 작고 5분 tick 주기보다는 커서, 정상 배치가 잘리지 않으면서도 락 만료 전에
// 반드시 끝나 "락 만료 → 다음 tick이 새 락 획득 → 배치 2개 동시 실행" 오버랩을
// 막는다(FMP 429 폭풍 중 심볼당 최악 ~75s(10s 타임아웃 + 10/15/20s 재시도)로
// 10심볼 배치가 900s를 넘길 수 있었던 문제).
// 2026-08 감사(KR 5종목 prewarm 미도달) — 예전엔 이 값을 늘리면 회전 불변식이 깨졌다(위
// CANDIDATE_WINDOW_MULTIPLIER 주석 참고). 오프셋이 Redis 영속 커서 기반으로
// 바뀐 뒤로는 이 값과 회전 폭 사이에 더 이상 결합이 없다 — 늘려도 안전하다
// (물론 LOCK_TTL_SECONDS보다는 작아야 한다는 원래 제약은 그대로 남는다).
const BATCH_DEADLINE_MS = 600_000; // 10min
/**
 * 유닛(심볼×탭) 하나당 LLM 왕복 최대 대기 시간.
 *
 * LOCK_TTL_SECONDS(900s)와의 관계: BATCH_DEADLINE_MS(600s)가 더 작은 상한이라
 * 락 보호는 실질적으로 BATCH_DEADLINE_MS가 담당한다. 그러나 BATCH_DEADLINE_MS는
 * 탭 사이에서만 검사되므로, 마지막 유닛이 이 타임아웃 없이 무한정 블로킹하면
 * LOCK_TTL(900s)까지 락이 안 풀릴 수 있고, 그 사이 다음 EventBridge tick이
 * 새 락을 획득해 두 배치가 동시에 돌 수 있다.
 *
 * ⚠️ 이 타임아웃이 발동해도 core의 run* 호출은 취소되지 않는다 — prewarm* seam이
 * AbortSignal을 받지 않으므로 orphaned promise가 백그라운드에서 계속 실행된다.
 * 이 타임아웃의 목적은 배치 슬롯(락)을 보호하는 것이지, 작업을 취소하는 게 아니다.
 * AbortSignal threading은 별도 작업으로 대응한다.
 */
const UNIT_TIMEOUT_MS = 120_000; // 2min
// overall을 마지막에 둬 bars/scorecard 등 다른 축이 이미 채운 Redis 캐시를 HIT로 재활용한다.
const TAB_ORDER: readonly SeoSnapshotTab[] = [
    'technical',
    'fundamental',
    'financials',
    'congress',
    'news',
    'options',
    'overall',
];
// spec §8 추정치 — 모니터링용, 정밀 계측 아님. 심볼 전체 탭 수 기준 총량을
// 실제 seam이 "실행된"(=submit이 호출된) 탭 수에 비례 배분한다(탭 하나당 평균
// FMP 호출수). equity: 22 calls / 7 tabs ≈ 3. crypto: 2 calls / 3 tabs(CRYPTO_TABS) ≈ 1.
// 이미 fresh인 탭·backoff(skip) 중인 탭·in-flight 탭은 submit 자체가 안
// 불리므로 예산에서 제외된다. 그렇지 않으면 실제 FMP 호출이 0건인데도 예산이
// 계상되어 getFmpBudgetUsed가 실사용량을 과대평가한다.
const FMP_CALLS_PER_TAB_EQUITY = 3;
const FMP_CALLS_PER_TAB_CRYPTO = 1;

const CRYPTO_SYMBOL_SET = new Set<string>(POPULAR_CRYPTOS);

// 2026-08 감사(starvation watch) — 정상 회전(위 2026-08 감사, KR 5종목 prewarm 미도달)이면 하룻밤 안에
// 유니버스 전체가 한 번은 후보가 된다. 이 문턱을 넘겨도 stale인 심볼은 "아직
// 오늘 밤 순번이 안 왔다"가 아니라 "회전에서 구조적으로 빠지고 있다"는 신호다
// (원인 사례: KR 5종목이 POPULAR_TICKERS의 KR 블록 head라는 이유만으로 몇 달간
// 한 번도 선택되지 못했다 — findStarvedSymbols 참고). 여유를 위해 24h(하루
// 단위 마감 주기)의 두 배로 잡는다.
const STARVATION_AGE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48h
const STARVATION_LOG_LIMIT = 5;

/** runPrewarmBatch/pollUntilSettled가 시간을 읽고 기다리는 방식을 추상화한다
 * (기본값은 실제 wall-clock). 테스트가 결정적으로 주입할 수 있도록 분리한다. */
export interface PrewarmClock {
    now: () => number;
    sleep: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        // unref: 유닛 타임아웃 race에서 진 타이머가 최대 UNIT_TIMEOUT_MS 동안 남는다
        // (유닛 하나당 하나, 배치당 수십 개). unref하지 않으면 그 타이머들이 이벤트
        // 루프를 붙들어 배치가 끝나도 프로세스가 바로 정리되지 않는다.
        setTimeout(resolve, ms).unref();
    });
}

const DEFAULT_CLOCK: PrewarmClock = { now: Date.now, sleep: defaultSleep };

// findGeneratedAtMap(api.ts)이 UPPERCASE 심볼로 키를 저장/조회하므로
// 여기서도 대문자화해야 한다 — 소문자 심볼이 유입되면(현재는 화이트리스트가
// 우연히 전부 대문자라 드러나지 않음) freshness lookup이 항상 miss한다.
function snapshotKey(symbol: string, tab: SeoSnapshotTab): string {
    return `${symbol.toUpperCase()}:${tab}`;
}

interface StarvedSymbol {
    symbol: string;
    /** 마지막 생성 이후 경과 ms. 탭 하나라도 한 번도 생성된 적 없으면 null(="never"). */
    ageMs: number | null;
}

/**
 * 2026-08 감사(starvation watch) — stale 심볼 중 "얼마나 오래" 밀려 있는지 랭킹한다.
 *
 * 별도 Redis 상태나 심볼별 카운터 없이, 이미 이번 tick에 한 번 읽어 온
 * `generatedAtMap`(DB, 배치당 1회)만 재사용한다. "몇 tick 연속 stale인가"를
 * 정확히 세려면 심볼별 카운터가 있어야 하지만, 그러려면 심볼당 Redis 왕복이
 * 하나 늘어난다 — 대신 "마지막 생성 이후 경과 시간"을 대리 지표로 쓴다. 정보량은
 * 오히려 더 많고(단순 tick 수보다 "몇 시간 밀렸는지"가 운영자에게 바로 의미
 * 있다) 비용은 0이다.
 *
 * 심볼의 탭 중 하나라도 생성된 적이 없으면(generatedAtMap에 그 키가 없음) 그
 * 심볼 전체를 "never"로 표시한다 — 정확히 이번 KR 5종목 인시던트의 모양이다
 * (전 탭·news 테이블까지 0행). 일부 탭만 없는 경우도 보수적으로 "never"로
 * 잡는다 — 부분 커버리지도 이 워치의 목적상 완전 미도달과 같은 우선순위로
 * 취급하는 편이 안전하다.
 */
function findStarvedSymbols(
    staleSymbols: PrewarmSymbol[],
    generatedAtMap: Map<string, Date>,
    nowMs: number
): StarvedSymbol[] {
    return staleSymbols
        .map(u => {
            let oldestGeneratedAt: Date | undefined;
            let neverGenerated = false;
            for (const tab of u.tabs) {
                const generatedAt = generatedAtMap.get(
                    snapshotKey(u.symbol, tab)
                );
                if (generatedAt === undefined) {
                    neverGenerated = true;
                    continue;
                }
                if (
                    oldestGeneratedAt === undefined ||
                    generatedAt < oldestGeneratedAt
                ) {
                    oldestGeneratedAt = generatedAt;
                }
            }
            const ageMs =
                neverGenerated || oldestGeneratedAt === undefined
                    ? null
                    : nowMs - oldestGeneratedAt.getTime();
            return { symbol: u.symbol, ageMs };
        })
        .filter(s => s.ageMs === null || s.ageMs > STARVATION_AGE_THRESHOLD_MS)
        .toSorted((a, b) => {
            if (a.ageMs === null) return b.ageMs === null ? 0 : -1;
            if (b.ageMs === null) return 1;
            return b.ageMs - a.ageMs;
        });
}

/** findStarvedSymbols 결과를 CloudWatch에서 grep 가능한 한 줄로 남긴다.
 * 정상 야간(모든 stale이 문턱 이내)에는 아무것도 로그하지 않는다 — 매 tick
 * 찍히는 로그는 신호를 잡음에 묻는다. */
function logStarvationWatch(
    staleSymbols: PrewarmSymbol[],
    generatedAtMap: Map<string, Date>,
    nowMs: number
): void {
    const starved = findStarvedSymbols(staleSymbols, generatedAtMap, nowMs);
    if (starved.length === 0) return;
    const worst = starved
        .slice(0, STARVATION_LOG_LIMIT)
        .map(s =>
            s.ageMs === null
                ? `${s.symbol}(never)`
                : `${s.symbol}(${Math.floor(s.ageMs / (60 * 60 * 1000))}h)`
        );
    console.warn(
        `[seo-prewarm] starvation watch: ${starved.length} symbol(s) stale > 48h — worst: ${worst.join(', ')}`
    );
}

/**
 * SEO pre-warm 배치 오케스트레이터 (spec 2026-07-24 §6~§8, Task 9. FIX A/C/G/Z audit).
 *
 * select(공정 선별 — `selectFairBatch`) → run(탭별 seam force=false 호출 +
 * submitted면 즉시 poll-resume까지) → harvest(cached/done 결과 upsert) →
 * revalidate(전 탭 fresh 시 태그 무효화) 순으로 진행한다. 유닛(심볼×탭) 단위로
 * 에러를 격리해 하나가 실패해도 배치 전체는 중단되지 않는다(fail-open —
 * 오래된 스냅샷이 그대로 남을 뿐).
 */
export async function runPrewarmBatch(
    clock: PrewarmClock = DEFAULT_CLOCK
): Promise<PrewarmBatchCounts> {
    const batchDeadline = clock.now() + BATCH_DEADLINE_MS;
    const isPastDeadline = () => clock.now() > batchDeadline;
    // **의도적으로 `clock.now()`가 아니다.** `PrewarmClock`은 경과 시간 예산
    // (데드라인·sleep)을 테스트가 조작하기 위한 것이고, 그 테스트들은 epoch에서
    // 파생한 임의의 값을 넣는다. 반면 여기 두 판정(마감 경계, 장중 여부)은 **달력**이
    // 필요해서 그 값으로는 의미가 없다. 테스트는 `vi.setSystemTime`으로 이쪽을 따로
    // 고정한다. 하나로 합치면 데드라인 테스트가 깨진다.
    //
    // 회전 오프셋은 더 이상 이 시계 어느 쪽과도 무관하다(2026-08 감사) — Redis
    // 영속 커서에서 나온다(`selectFairBatch` doc-comment 참고).
    const now = new Date();
    // 심볼마다 자기 시장의 마감을 경계로 쓴다. 하나의 ET 경계를 전 심볼에 쓰면 국내
    // 종목이 두 방향으로 다 어긋난다 — 미국 휴장일(KRX 개장)엔 하루 묵은 스냅샷이
    // fresh로 통과하고, 한국 공휴일엔 바뀐 게 없는데 전 국내 종목을 재생성한다.
    const boundaryFor = (symbol: string) =>
        snapshotCloseBoundaryFor(symbol, now);
    const universe = buildPrewarmUniverse();
    const repo = new DrizzleSeoSnapshotRepository(getDatabaseClient().db);
    const generatedAtMap = await repo.findGeneratedAtMap(
        universe.map(u => u.symbol)
    );

    const staleSymbols = universe.filter(u => {
        const boundary = boundaryFor(u.symbol);
        return u.tabs.some(
            tab =>
                !isSnapshotFresh(
                    generatedAtMap.get(snapshotKey(u.symbol, tab)),
                    boundary
                )
        );
    });
    // 2026-08 감사(starvation watch) — 회전에서 구조적으로 빠지고 있는 심볼을
    // 로그에 이름으로 남긴다. 이미 배치당 1회 읽은 `generatedAtMap`(DB)만
    // 재사용하므로 심볼당 Redis 왕복이 늘지 않는다(findStarvedSymbols 참고).
    logStarvationWatch(staleSymbols, generatedAtMap, now.getTime());
    // 자기 시장이 장중인 심볼은 이번 틱에서 뺀다. 창의 뒤쪽 4시간이 KRX 장중이라,
    // 그 틱에 걸린 국내 종목은 형성 중인 일봉으로 만든 서술이 다음 마감까지 굳는다.
    //
    // `staleSymbols` **다음에** 거르는 것이 중요하다. `staleTotal`은 운영자가 야간
    // 처리 여력을 판단하는 신호인데(`docs/architecture/SITEMAP_SCOPE.md` §2), 유니버스
    // 단계에서 빼면 장중 시간대에 조회한 값이 실제 백로그보다 작게 나온다 — 미뤄진
    // 심볼도 아직 처리해야 할 대상이다.
    const selectable = staleSymbols.filter(
        u => !shouldDeferPrewarmWhileOpen(u.symbol, now)
    );
    const batch = await selectFairBatch(
        selectable,
        generatedAtMap,
        boundaryFor
    );
    const counts: PrewarmBatchCounts = {
        harvested: 0,
        staleTotal: staleSymbols.length,
        durationMs: 0,
        revalidated: 0,
        remaining: Math.max(0, staleSymbols.length - batch.length),
        fmpBudgetUsed: 0,
    };

    // shared `withConcurrencyLimit`(shared/lib)은 쓰지 않는다 — 그 헬퍼는 청크
    // 사이에 훅이 없어 BATCH_DEADLINE_MS(FIX G)를 매 청크 경계에서 검사해 조기
    // 탈출(counts.remaining 정확히 집계)할 수 없고, processSymbol이 poll 루프
    // 재개용 `clock`/`batchDeadline`을 받아야 하는데 헬퍼의 `fn: (item) => …`
    // 시그니처는 그 두 값을 청크마다 다시 넘길 자리가 없다. 대신 아래 명시적
    // 루프로 청크 경계마다 데드라인을 검사한다. 격리는 각 processSymbol 호출의
    // `.catch`가 보장하므로 Promise.all 기반 청크 처리와 동일하게 안전하다.
    let droppedByDeadline = 0;
    for (let i = 0; i < batch.length; i += SYMBOL_CONCURRENCY) {
        if (isPastDeadline()) {
            const remainingCount = batch.length - i;
            counts.remaining += remainingCount;
            console.warn(
                `[seo-prewarm] batch deadline reached — ${i} symbols processed, ${remainingCount} remaining`
            );
            break;
        }
        const chunk = batch.slice(i, i + SYMBOL_CONCURRENCY);
        const dropped = await Promise.all(
            chunk.map(u =>
                processSymbol(
                    u,
                    boundaryFor(u.symbol),
                    generatedAtMap,
                    repo,
                    counts,
                    isPastDeadline,
                    clock
                ).catch(error => {
                    console.error(`[seo-prewarm] ${u.symbol} failed:`, error);
                    return 0;
                })
            )
        );
        droppedByDeadline += dropped.reduce((sum, n) => sum + n, 0);
    }

    /**
     * 데드라인으로 버려진 작업을 **여기서** 로깅한다.
     *
     * 위 청크 경계 검사는 `SYMBOLS_PER_TICK === SYMBOL_CONCURRENCY`인 현재 상수 조합에서
     * 배치가 항상 1청크라 도달하지 않는다. 실제로 발동하는 건 심볼 안의 탭 경계 검사인데
     * 그건 조용히 건너뛰기만 했다 — 즉 알람을 붙여 놔도 영원히 발화하지 않는 상태였다.
     * 커버리지가 야금야금 줄어드는 걸 잡는 유일한 신호이므로 마커를 반드시 남긴다.
     */
    if (droppedByDeadline > 0) {
        counts.remaining += droppedByDeadline;
        console.warn(
            `[seo-prewarm] batch deadline reached — ${droppedByDeadline} tabs dropped`
        );
    }

    counts.fmpBudgetUsed = await getFmpBudgetUsed();
    counts.durationMs = clock.now() - (batchDeadline - BATCH_DEADLINE_MS);
    return counts;
}

/**
 * FIX A(감사) — 공정 선별 정책. 두 문제를 함께 푼다:
 *
 * ① 회전 오프셋(head-of-line 편향 방지): 원래 구현은 `staleSymbols.slice(0, N)`으로
 * 항상 index 0부터 뽑았다. `lastCompletedEtCloseWithBuffer`가 매 거래일 넘어갈
 * 때마다 boundary를 갱신해 전 심볼이 하룻밤 새 다시 stale이 되므로, 매일 밤
 * 선택이 index 0부터 재시작돼 유니버스 tail(POPULAR_CRYPTOS 29종, `buildPrewarmUniverse`가
 * 배열 끝에 붙임)이 평일엔 영원히 도달하지 못했다.
 *
 * ⚠️ **offset은 "완료 여부"에서 파생하면 안 된다** (2026-07-26 인시던트). 최초
 * 구현은 offset을 "전 탭이 fresh로 완료된 심볼 수"(freshCount)로 잡았다. 진행이
 * 있을 때는 잘 흘러가지만, 창 안 후보가 **전부 blocked**가 되는 순간 아무것도
 * 완료되지 않아 freshCount가 얼어붙고, 그러면 offset도 얼어붙어 다음 tick이
 * **같은 창을 재검사**한다 — 스스로 빠져나올 수 없는 livelock이다. 첫 야간
 * 운영에서 실제로 발생했다: `submitted:0 / remaining:153`이 반복되며 221/295
 * 심볼에서 정지(skip 마커 69 + in-flight 7이 창 18칸을 덮음).
 *
 * 그 뒤 두 번째 구현은 offset을 tick **시각**에서 뽑았다 — `floor(now /
 * TICK_ROTATION_MS) * SYMBOLS_PER_TICK`. livelock은 고쳤지만 새 구멍을 열었다
 * (2026-08 감사, KR 5종목 prewarm 미도달): 배치 하나가 지연되면 다음 실제 실행
 * 시각이 몇 틱씩 밀리고, 그만큼 offset이 **경과 시간에 비례해 점프**해 창 폭을
 * 넘으면 그 구간이 그 날 밤 영영 후보가 되지 못했다 — `BATCH_DEADLINE_MS(600s)
 * + 스케줄주기(300s) ≤ 창 폭(18)`이라는 불변식이 "정확히 경계"였기 때문에 아주
 * 작은 추가 지연도 이 구멍을 열 수 있었다. 실제로 `POPULAR_TICKERS`의 KR 블록
 * head 5종목이 이 경로로 몇 달째 한 번도 선택되지 못했다(SEO snapshot 0행,
 * `news` 테이블도 0행).
 *
 * 그래서 offset을 다시 바꾼다 — 이번엔 Redis에 절대값으로 영속시키고
 * (`lock.ts`의 `advanceRotationCursor`), **실제 배치 실행 1회당** `SYMBOLS_PER_TICK`
 * 만큼만 전진시킨다. "경과 시각"도 "완료 개수"도 아니라 "실행 횟수"에 묶는 게
 * 핵심이다:
 * - livelock 불가 — 매 호출마다 분류 결과와 무관하게 무조건 전진한다(첫 번째
 *   구현이 못 하던 것).
 * - skip 불가 — 실행이 아무리 늦게 일어나도 전진 폭은 항상 `SYMBOLS_PER_TICK`
 *   하나뿐이라 이전 창과 바로 이어 붙는다(두 번째 구현이 못 하던 것).
 *
 * Math.random 없이 결정적이며(같은 커서 값에서 항상 같은 창), 실행 횟수에만
 * 묶이므로 재시도가 이 로직에 도달하기 전에 이미 Redis 루트 락이 중첩 실행을
 * 막는다(`route.ts`) — 따로 멱등성을 신경 쓸 필요가 없다.
 *
 * ② bounded in-flight/backoff 스캔: `getInFlightMarker`/`isSkipped`는 (symbol, tab)당
 * 비동기 Redis 조회라 유니버스 전체(290×≤7)를 매 tick 걸면 ~1900회 왕복이 든다.
 * 대신 후보 폭을 `SYMBOLS_PER_TICK * CANDIDATE_WINDOW_MULTIPLIER`개로 제한하고,
 * 그 창 안에서만 심볼당 최대 2회(마커 조회 1 + 마커가 아예 없을 때만 skip 조회 1)×stale
 * 탭 수를 조회한다 — worst case `SYMBOLS_PER_TICK * CANDIDATE_WINDOW_MULTIPLIER
 * (=18) × 7탭 × 2 = 252회/tick`(≪1900). 마커가 present면 skip 조회를 생략하므로
 * (present 자체가 "이번 tick엔 손대지 마라"는 뜻) 실측 평균은 이보다 낮다.
 *
 * FIX 2(감사, PR #698 리뷰) — 이 창 안의 후보 분류(`classifySymbol`)는 서로
 * 독립적이고 순서에 의존하지 않으므로 `Promise.all`로 병렬 실행한다(이전엔
 * `for`-루프 안에서 순차 `await` — worst case 252회 왕복이 전부 직렬이었다).
 * 결과 배열은 Promise.all이 입력 순서 그대로 반환하므로 회전 결정성이 유지된다.
 *
 * FIX C(감사) — 모든 stale 탭이 backoff(skip) 상태이거나 in-flight
 * 마커로 막혀 있는 심볼은 'blocked'로 분류해 배제한다(terminal skip 또는
 * 살아 있는 in-flight가 head 슬롯을 점유하는 걸 막는다).
 */
async function selectFairBatch(
    staleSymbols: PrewarmSymbol[],
    generatedAtMap: Map<string, Date>,
    boundaryFor: (symbol: string) => Date
): Promise<PrewarmSymbol[]> {
    if (staleSymbols.length === 0) return [];

    // 회전 오프셋은 Redis 영속 커서에서 뽑는다(아래 doc-comment ① 참조) — 이
    // 호출 자체가 "이번 tick에 배치를 시도했다"는 뜻이므로, 분류 결과와 무관하게
    // 매번 SYMBOLS_PER_TICK만큼 무조건 전진한다.
    const base = await advanceRotationCursor(SYMBOLS_PER_TICK);
    const offset = base % staleSymbols.length;
    const windowSize = Math.min(
        staleSymbols.length,
        SYMBOLS_PER_TICK * CANDIDATE_WINDOW_MULTIPLIER
    );

    const windowCandidates: PrewarmSymbol[] = Array.from(
        { length: windowSize },
        (_, i) => staleSymbols[(offset + i) % staleSymbols.length]
    );
    // FIX 2 — 분류는 서로 독립적이므로 병렬로 돌리고, 결과는 windowCandidates와
    // 같은(=원래 회전 순서) 인덱스로 되돌아온다.
    const classifications = await Promise.all(
        windowCandidates.map(candidate =>
            classifySymbol(
                candidate,
                generatedAtMap,
                boundaryFor(candidate.symbol)
            )
        )
    );

    const fresh: PrewarmSymbol[] = [];
    windowCandidates.forEach((candidate, i) => {
        if (classifications[i] === 'fresh') fresh.push(candidate);
        // 'blocked' → 배제(모든 stale 탭이 backoff 또는 in-flight 중).
    });
    return fresh.slice(0, SYMBOLS_PER_TICK);
}

type SymbolCandidacy = 'fresh' | 'blocked';

/**
 * 후보 분류: in-flight 마커가 있는 탭은 actionable 아님(재제출 대상 아님).
 * `processSymbol`이 그 탭을 skip하는 것과 동일하게, 모든 stale 탭이 in-flight
 * 또는 backoff 상태인 심볼은 'blocked'로 분류해 배치 슬롯을 소비하지 않게 한다.
 */
async function classifySymbol(
    u: PrewarmSymbol,
    generatedAtMap: Map<string, Date>,
    boundary: Date
): Promise<SymbolCandidacy> {
    const staleTabs = u.tabs.filter(
        tab =>
            !isSnapshotFresh(
                generatedAtMap.get(snapshotKey(u.symbol, tab)),
                boundary
            )
    );
    if (staleTabs.length === 0) return 'blocked'; // 이론상 도달 안 함(staleSymbols 필터로 보장).

    let anyActionable = false;
    for (const tab of staleTabs) {
        const marker = await getInFlightMarker(u.symbol, tab);
        if (marker.present) continue; // in-flight — 이번 tick엔 actionable 아님(TTL 대기).
        if (!(await isSkipped(u.symbol, tab))) anyActionable = true;
    }
    return anyActionable ? 'fresh' : 'blocked';
}

async function processSymbol(
    u: PrewarmSymbol,
    boundary: Date,
    generatedAtMap: Map<string, Date>,
    repo: DrizzleSeoSnapshotRepository,
    counts: PrewarmBatchCounts,
    /**
     * 탭 하나하나가 LLM 왕복만큼(수십 초~수 분) 블로킹한다. 청크 경계에서만
     * 데드라인을 보면 마지막 청크가 4탭을 연달아 돌며 LOCK_TTL_SECONDS(900s)를
     * 넘길 수 있고, 그러면 락이 만료돼 다음 tick이 같은 심볼을 동시에 잡는다.
     * 탭 사이에서도 검사해 그 창을 닫는다.
     */
    isPastDeadline: () => boolean,
    clock: PrewarmClock
): Promise<number> {
    const { assetInfo } = await getAssetInfoResilient(u.symbol);
    const companyName = assetInfo?.name ?? u.symbol;
    const fmpSymbol = assetInfo?.fmpSymbol;

    let freshTabCount = 0;
    // 실제로 TAB_SEAMS[tab](submit)을 호출한(=새 FMP 호출이 발생했을 수 있는) 탭 수.
    // 이미 fresh거나 backoff(skip) 중인 탭, 그리고 poll-resume(신규 submit 아님)은 제외한다.
    let seamsRunForSymbol = 0;

    let tabsDroppedByDeadline = 0;
    for (const tab of TAB_ORDER) {
        if (!u.tabs.includes(tab)) continue;

        // 데드라인 검사보다 **먼저** 신선도를 본다. 순서가 반대면 두 가지가 깨진다:
        // ① 이미 fresh한 탭까지 "데드라인으로 버려짐"으로 세어 마커 수치가 부풀고,
        // ② `freshTabCount`가 안 올라가 아래 "전 탭 fresh" 게이트가 실패한다 —
        //    그러면 방금 harvest한 스냅샷의 `revalidateTag`가 안 돌고, 다음 tick엔
        //    그 심볼이 stale 목록에서 빠져 페이지 revalidate TTL(6~24h)까지 노출이
        //    지연된다. 신선도 판정은 로컬 맵 조회라 비용도 없다.
        const alreadyFresh = isSnapshotFresh(
            generatedAtMap.get(snapshotKey(u.symbol, tab)),
            boundary
        );
        if (alreadyFresh) {
            freshTabCount++;
            continue;
        }

        if (isPastDeadline()) {
            // 실제로 할 일이 남은 탭만 센다. 조용히 건너뛰기만 하면 데드라인으로
            // 버려진 작업이 어떤 카운트에도, 어떤 로그에도 남지 않아 알람이 붙어
            // 있어도 영원히 발화하지 않는다.
            tabsDroppedByDeadline += 1;
            continue;
        }

        try {
            const marker = await getInFlightMarker(u.symbol, tab);
            // FIX 1(감사, PR #698 리뷰) — in-flight 마커가 있으면 이번 tick은
            // 건너뛴다. TTL(30min) 만료 후 다음 tick이 새로 submit한다.
            if (marker.present) continue;
            if (await isSkipped(u.symbol, tab)) continue; // FIX C: terminal backoff 중.

            seamsRunForSymbol++;
            await markInFlight(u.symbol, tab);
            try {
                // FIX 1(감사) — 유닛 타임아웃: core run* 함수가 UNIT_TIMEOUT_MS 안에
                // 반환하지 않으면 기다리기를 포기한다. 타임아웃이 발동해도 orphaned
                // promise는 백그라운드에서 계속 실행된다 — UNIT_TIMEOUT_MS 상수 주석
                // 참조(AbortSignal 미지원으로 취소 불가).
                const raceResult = await Promise.race([
                    TAB_SEAMS[tab]({
                        symbol: u.symbol,
                        companyName,
                        fmpSymbol,
                    }).then(r => ({ timedOut: false as const, value: r })),
                    clock
                        .sleep(UNIT_TIMEOUT_MS)
                        .then(() => ({ timedOut: true as const })),
                ]);

                if (raceResult.timedOut) {
                    console.warn(
                        `[seo-prewarm] unit-timeout ${u.symbol}:${tab} — abandoned wait, core call still running in background`
                    );
                    // 타임아웃도 일시적 실패로 본다 — 포기한 core 호출은 백그라운드에서
                    // 계속 돌아 대개 곧 캐시를 채우므로, 다음 tick이면 값싼 HIT가 된다.
                    // 6시간을 걸면 그 HIT 기회를 통째로 버린다.
                    await markSkipped(
                        u.symbol,
                        tab,
                        TRANSIENT_SKIP_TTL_SECONDS
                    );
                    continue;
                }

                const harvested = await resolveHarvest(
                    u.symbol,
                    tab,
                    raceResult.value,
                    repo,
                    counts
                );
                if (harvested) freshTabCount++;
            } finally {
                // 완료(done/error) 즉시 마커를 제거해 다음 tick이 TTL(30min) 만료를
                // 기다리지 않고 바로 최신 상태를 반영하게 한다.
                void clearInFlight(u.symbol, tab);
            }
        } catch (error) {
            if (getFmpErrorStatus(error) === 402) {
                // 402는 심볼 단위 이슈(플랜/쿼터) — 배치 중단 사유가 아니다.
                // backoff 마커를 남기지 않는다: 플랜이 변경되면 다음 tick에 자동 재시도된다.
                console.error(`[seo-prewarm] fmp-402 ${u.symbol}:${tab}`);
            } else {
                console.error(
                    `[seo-prewarm] unit-error ${u.symbol}:${tab}`,
                    error
                );
                // FIX 2(감사) — worker 제거 이후 run* 함수가 {status:'error'}를 반환하는
                // 대신 throw하게 됐다. resolveHarvest가 error 상태를 markSkipped로 변환하던
                // 경로가 bypass되므로 여기서 backoff 마커를 남긴다. 없으면 실패한 유닛이
                // 매 5분 tick마다 재시도되며 배치 슬롯을 영구 점유한다.
                //
                // 단 TTL은 6시간이 아니라 30분이다. throw의 대다수는 프로바이더 장애·
                // 타임아웃 같은 **일시적** 실패인데, 장애 중엔 모든 유닛이 동시에 throw하므로
                // 6시간을 걸면 20분짜리 장애가 prewarm을 반나절 멈춰 세운다. 30분이면
                // 슬롯 점유(매 tick 재시도)는 막으면서 회복 후 복귀도 빠르다. 구조적으로
                // 불가능한 유닛의 6시간 backoff는 `resolveHarvest`의 상태 기반 경로가 계속 담당한다.
                await markSkipped(u.symbol, tab, TRANSIENT_SKIP_TTL_SECONDS);
            }
            // 오래된 스냅샷이 그대로 남는다(fail-open) — 여기서 rethrow하지 않는다.
        }
    }

    if (seamsRunForSymbol > 0) {
        const fmpCallsPerTab = CRYPTO_SYMBOL_SET.has(u.symbol.toUpperCase())
            ? FMP_CALLS_PER_TAB_CRYPTO
            : FMP_CALLS_PER_TAB_EQUITY;
        await addFmpBudget(fmpCallsPerTab * seamsRunForSymbol);
    }

    if (u.tabs.length > 0 && freshTabCount === u.tabs.length) {
        // FIX B(감사) — 이 태그는 더 이상 소비자 없는 no-op이 아니다. Phase 2가
        // `getSeoSnapshotsStatic`(entities/seo-snapshot/lib/getSnapshotStatic.ts)에서
        // `seo-snapshot:{SYMBOL}` 태그로 읽고, 7개 탭 페이지 + `generateMetadata`가
        // 전부 그걸 구독한다. 즉 이 호출이 없으면 새로 harvest한 스냅샷이 각
        // 페이지의 `revalidate` TTL(6~24h)까지 조용히 지연 노출된다 — 이 라인이
        // 바로 "cron이 채운 데이터를 SSR HTML에 즉시 반영"시키는 지점이다.
        // revalidatePath는 쓰지 않는다: 스냅샷을 태그 없이 재생성만 하는 순수
        // ISR-write 비용이라 여기선 이점이 없다(태그 무효화가 정확한 지점).
        revalidateTag(`seo-snapshot:${u.symbol.toUpperCase()}`, 'max');
        counts.revalidated++;
    }

    return tabsDroppedByDeadline;
}
