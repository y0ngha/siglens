import 'server-only';
import { revalidateTag } from 'next/cache';
import {
    buildPrewarmUniverse,
    isSnapshotFresh,
    lastCompletedEtCloseWithBuffer,
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
    getFmpBudgetUsed,
    getInFlightMarker,
    isSkipped,
    markInFlight,
} from './lock';
import {
    TAB_SEAMS,
    TAB_POLLS,
    resolveHarvest,
    type SeamOutcome,
} from './harvest';

export interface PrewarmBatchCounts {
    submitted: number;
    harvested: number;
    revalidated: number;
    remaining: number;
    fmpBudgetUsed: number;
}

/**
 * FIX Z(감사) — 매 tick이 submit 후 즉시 poll까지 진행하므로(콜드 캐시를 실제로
 * 데운다) 심볼당 소요 시간이 늘었다. 원래 10 → 6으로 낮춰 청크(SYMBOL_CONCURRENCY=3
 * 기준 2청크)당 최악 대기가 과도해지지 않게 한다 — 실제 상한은 BATCH_DEADLINE_MS가
 * 건다(이 상수는 "정상 tick의 목표 처리량"일 뿐, 배치 전체를 막는 하드 캡이 아니다).
 */
const SYMBOLS_PER_TICK = 6;
// core fundamental이 Promise.all로 ~13개 FMP 호출을 한번에 쏨 → 3×13≈40 순간 버스트 캡 (spec §8).
const SYMBOL_CONCURRENCY = 3;
// FIX A(감사) — bounded in-flight/backoff 후보 스캔 폭. selectFairBatch 참고.
const CANDIDATE_WINDOW_MULTIPLIER = 3;
// FIX G(감사) — 배치 전체 wall-clock 상한. LOCK_TTL_SECONDS(900s)보다 충분히
// 작고 5분 tick 주기보다는 커서, 정상 배치가 잘리지 않으면서도 락 만료 전에
// 반드시 끝나 "락 만료 → 다음 tick이 새 락 획득 → 배치 2개 동시 실행" 오버랩을
// 막는다(FMP 429 폭풍 중 심볼당 최악 ~75s(10s 타임아웃 + 10/15/20s 재시도)로
// 10심볼 배치가 900s를 넘길 수 있었던 문제).
const BATCH_DEADLINE_MS = 600_000; // 10min
// FIX Z(감사) — poll 간격/유닛(심볼×탭)당 상한. 60s 안에 못 끝나면 이번 tick은
// 포기하고 in-flight(jobId) 마커를 남겨 다음 tick이 이어서 poll한다(배치를
// 무기한 붙잡지 않는다).
const POLL_INTERVAL_MS = 5000;
const POLL_UNIT_CAP_MS = 60000;
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
// 이미 fresh인 탭·backoff(skip) 중인 탭은 submit 자체가 안 불리므로 예산에서
// 제외된다 — poll-resume(기존 job 이어받기)도 새 FMP 호출이 아니므로 제외.
// 그렇지 않으면 실제 FMP 호출이 0건인데도 예산이 계상되어 getFmpBudgetUsed가
// 실사용량을 과대평가한다.
const FMP_CALLS_PER_TAB_EQUITY = 3;
const FMP_CALLS_PER_TAB_CRYPTO = 1;

const CRYPTO_SYMBOL_SET = new Set<string>(POPULAR_CRYPTOS);

/** runPrewarmBatch/pollUntilSettled가 시간을 읽고 기다리는 방식을 추상화한다
 * (기본값은 실제 wall-clock). 테스트가 결정적으로 주입할 수 있도록 분리한다. */
export interface PrewarmClock {
    now: () => number;
    sleep: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const DEFAULT_CLOCK: PrewarmClock = { now: Date.now, sleep: defaultSleep };

// findGeneratedAtMap(api.ts)이 UPPERCASE 심볼로 키를 저장/조회하므로
// 여기서도 대문자화해야 한다 — 소문자 심볼이 유입되면(현재는 화이트리스트가
// 우연히 전부 대문자라 드러나지 않음) freshness lookup이 항상 miss한다.
function snapshotKey(symbol: string, tab: SeoSnapshotTab): string {
    return `${symbol.toUpperCase()}:${tab}`;
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
    const boundary = lastCompletedEtCloseWithBuffer(new Date());
    const universe = buildPrewarmUniverse();
    const repo = new DrizzleSeoSnapshotRepository(getDatabaseClient().db);
    const generatedAtMap = await repo.findGeneratedAtMap(
        universe.map(u => u.symbol)
    );

    const staleSymbols = universe.filter(u =>
        u.tabs.some(
            tab =>
                !isSnapshotFresh(
                    generatedAtMap.get(snapshotKey(u.symbol, tab)),
                    boundary
                )
        )
    );
    // FIX A(감사) — "이번 tick 기준 전 탭이 fresh로 완료된 심볼 수"를 회전
    // 오프셋으로 쓴다. selectFairBatch의 doc-comment 참고.
    const freshCount = universe.length - staleSymbols.length;

    const batch = await selectFairBatch(
        staleSymbols,
        generatedAtMap,
        boundary,
        freshCount
    );
    const counts: PrewarmBatchCounts = {
        submitted: 0,
        harvested: 0,
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
    for (let i = 0; i < batch.length; i += SYMBOL_CONCURRENCY) {
        if (clock.now() > batchDeadline) {
            const remainingCount = batch.length - i;
            counts.remaining += remainingCount;
            console.warn(
                `[seo-prewarm] batch deadline reached — ${i} symbols processed, ${remainingCount} remaining`
            );
            break;
        }
        const chunk = batch.slice(i, i + SYMBOL_CONCURRENCY);
        await Promise.all(
            chunk.map(u =>
                processSymbol(
                    u,
                    boundary,
                    generatedAtMap,
                    repo,
                    counts,
                    clock,
                    batchDeadline
                ).catch(error => {
                    console.error(`[seo-prewarm] ${u.symbol} failed:`, error);
                })
            )
        );
    }

    counts.fmpBudgetUsed = await getFmpBudgetUsed();
    return counts;
}

/**
 * FIX A(감사) — 공정 선별 정책. 두 문제를 함께 푼다:
 *
 * ① 회전 오프셋(head-of-line 편향 방지): 원래 구현은 `staleSymbols.slice(0, N)`으로
 * 항상 index 0부터 뽑았다. `lastCompletedEtCloseWithBuffer`가 매 거래일 넘어갈
 * 때마다 boundary를 갱신해 전 심볼이 하룻밤 새 다시 stale이 되므로, 매일 밤
 * 선택이 index 0부터 재시작돼 유니버스 tail(POPULAR_CRYPTOS 29종, `buildPrewarmUniverse`가
 * 배열 끝에 붙임)이 평일엔 영원히 도달하지 못했다. offset을 "이번 tick 기준
 * 전 탭이 fresh로 완료된 심볼 수"(freshCount)로 잡으면, 밤 동안 처리가
 * 진행될수록 offset이 단조 증가해 시작점이 앞으로 흘러가고, 다음날 boundary가
 * 넘어가 전부 stale로 리셋되면 freshCount도 자연히 0으로 함께 리셋된다 —
 * Math.random이나 별도 Redis 커서 없이 이미 계산해둔 값만으로 결정적 회전을 얻는다.
 *
 * ② bounded in-flight/backoff 스캔: `getInFlightMarker`/`isSkipped`는 (symbol, tab)당
 * 비동기 Redis 조회라 유니버스 전체(290×≤7)를 매 tick 걸면 ~1900회 왕복이 든다.
 * 대신 후보 폭을 `SYMBOLS_PER_TICK * CANDIDATE_WINDOW_MULTIPLIER`개로 제한하고,
 * 그 창 안에서만 심볼당 최대 2회(마커 조회 1 + 마커가 아예 없을 때만 skip 조회 1)×stale
 * 탭 수를 조회한다 — worst case `SYMBOLS_PER_TICK * CANDIDATE_WINDOW_MULTIPLIER
 * (=18) × 7탭 × 2 = 252회/tick`(≪1900). 탭 하나에서라도 resumable jobId를
 * 찾으면 그 시점에서 심볼을 즉시 'resumable' 분류하고 나머지 탭은 조회하지
 * 않는다(조기 종료로 실제 평균은 이보다 훨씬 낮다). FIX 1(감사, PR #698
 * 리뷰) — 마커가 legacy(jobId 없이 존재)면 skip 조회 자체를 생략하므로
 * (present 자체가 "이번 tick엔 손대지 마라"는 뜻) 실측 평균은 이보다 더 낮다.
 *
 * FIX 2(감사, PR #698 리뷰) — 이 창 안의 후보 분류(`classifySymbol`)는 서로
 * 독립적이고 순서에 의존하지 않으므로 `Promise.all`로 병렬 실행한다(이전엔
 * `for`-루프 안에서 순차 `await` — worst case 252회 왕복이 전부 직렬이었다).
 * 배치 결과의 순서는 "원래 후보(회전) 순서 안에서 resumable을 먼저, 그다음
 * fresh"로 재구성해 회전 정책의 결정성을 유지한다 — Promise.all은 완료 순서가
 * 아니라 입력 순서로 결과 배열을 반환하므로 이 재구성이 안전하다.
 *
 * FIX Z(감사) — in-flight는 더 이상 "배제" 대상이 아니다: 폴링을 도입한 뒤로는
 * in-flight(jobId 보유) 심볼이 "진행 중"이라 폴하면 실제로 진척이 있다. 그래서
 * resumable(in-flight jobId 보유) 심볼을 fresh(신규 stale) 심볼보다 먼저 채운다
 * — "in-flight 유닛을 먼저 poll하고, 남는 슬롯을 새 stale 심볼로 채운다."
 *
 * FIX C(감사) — 모든 stale 탭이 backoff(skip) 상태이거나 legacy in-flight
 * 마커로 막혀 있는 심볼은 'blocked'로 분류해 배제한다(terminal skip 또는
 * resume 불가 in-flight가 head 슬롯을 영구 점유하는 걸 막는다).
 */
async function selectFairBatch(
    staleSymbols: PrewarmSymbol[],
    generatedAtMap: Map<string, Date>,
    boundary: Date,
    freshCount: number
): Promise<PrewarmSymbol[]> {
    if (staleSymbols.length === 0) return [];

    const offset = freshCount % staleSymbols.length;
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
            classifySymbol(candidate, generatedAtMap, boundary)
        )
    );

    const resumable: PrewarmSymbol[] = [];
    const fresh: PrewarmSymbol[] = [];
    windowCandidates.forEach((candidate, i) => {
        const candidacy = classifications[i];
        if (candidacy === 'resumable') resumable.push(candidate);
        else if (candidacy === 'fresh') fresh.push(candidate);
        // 'blocked' → 배제(모든 stale 탭이 backoff 또는 legacy in-flight 중).
    });
    return [...resumable, ...fresh].slice(0, SYMBOLS_PER_TICK);
}

type SymbolCandidacy = 'resumable' | 'fresh' | 'blocked';

/**
 * FIX 1(감사, PR #698 리뷰) — `selectFairBatch`의 후보 분류와 `processSymbol`의
 * 실제 처리가 반드시 같은 규칙을 써야 한다: 마커가 legacy(jobId 없음)인 탭은
 * "actionable"이 아니다(재제출 대상 아님) — `processSymbol`이 그 탭을 skip하는
 * 것과 동일하게, 여기서도 그런 탭만 있는 심볼은 'blocked'로 분류해 배치 슬롯을
 * 소비하지 않게 한다.
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
        if (marker.jobId !== null) return 'resumable';
        if (marker.present) continue; // legacy 마커 — 이번 tick엔 actionable 아님(TTL 대기).
        if (!(await isSkipped(u.symbol, tab))) anyActionable = true;
    }
    return anyActionable ? 'fresh' : 'blocked';
}

/**
 * FIX Z(감사) — jobId 하나를 `POLL_INTERVAL_MS` 간격으로 최대 `POLL_UNIT_CAP_MS`까지
 * poll한다(배치 전체 데드라인 `batchDeadline`도 함께 존중 — FIX G). 최초 1회는
 * 즉시 poll한다(워커가 이미 끝났을 수 있어 첫 5s를 낭비하지 않는다). 캡에
 * 도달해도 여전히 `processing`이면 그 상태 그대로 반환한다 — 호출부가 이미
 * 세팅해둔 in-flight(jobId) 마커는 건드리지 않고 다음 tick이 이어서 poll하게 둔다.
 */
async function pollUntilSettled(
    poll: () => Promise<SeamOutcome>,
    batchDeadline: number,
    clock: PrewarmClock
): Promise<SeamOutcome> {
    let elapsedMs = 0;
    let outcome = await poll();
    while (
        outcome.status === 'processing' &&
        elapsedMs < POLL_UNIT_CAP_MS &&
        clock.now() < batchDeadline
    ) {
        await clock.sleep(POLL_INTERVAL_MS);
        elapsedMs += POLL_INTERVAL_MS;
        outcome = await poll();
    }
    return outcome;
}

async function processSymbol(
    u: PrewarmSymbol,
    boundary: Date,
    generatedAtMap: Map<string, Date>,
    repo: DrizzleSeoSnapshotRepository,
    counts: PrewarmBatchCounts,
    clock: PrewarmClock,
    batchDeadline: number
): Promise<void> {
    const { assetInfo } = await getAssetInfoResilient(u.symbol);
    const companyName = assetInfo?.name ?? u.symbol;
    const fmpSymbol = assetInfo?.fmpSymbol;

    let freshTabCount = 0;
    // 실제로 TAB_SEAMS[tab](submit)을 호출한(=새 FMP 호출이 발생했을 수 있는) 탭 수.
    // 이미 fresh거나 backoff(skip) 중인 탭, 그리고 poll-resume(신규 submit 아님)은 제외한다.
    let seamsRunForSymbol = 0;

    for (const tab of TAB_ORDER) {
        if (!u.tabs.includes(tab)) continue;

        const alreadyFresh = isSnapshotFresh(
            generatedAtMap.get(snapshotKey(u.symbol, tab)),
            boundary
        );
        if (alreadyFresh) {
            freshTabCount++;
            continue;
        }

        try {
            const marker = await getInFlightMarker(u.symbol, tab);
            let outcome: SeamOutcome | null;

            if (marker.jobId !== null) {
                // FIX Z — 이전 tick이 submit만 하고 못 끝낸 job을 재제출하는
                // 대신 이어서 poll한다(in-flight = "진행 중" → 실제로 진척시킨다.
                // FIX A가 in-flight를 선별에서 배제하던 방식의 역방향 보완).
                outcome = await pollUntilSettled(
                    () => TAB_POLLS[tab](marker.jobId!),
                    batchDeadline,
                    clock
                );
            } else if (marker.present) {
                // FIX 1(감사, PR #698 리뷰) — legacy 마커(jobId 없이 마킹된
                // 경우 — 예: `pending_dependencies`)는 resume-poll은 못 하지만
                // 여전히 in-flight다. `getInFlightJobId`만 쓰던 이전 코드는
                // 이 경우를 "in-flight 아님"으로 오판해 매 tick 재제출했다
                // (FMP 예산 재계상 포함) — `markInFlight`가 문서화한 "재개
                // 불가, 자연 TTL 만료 후 재시도" 의도와 어긋났다. 여기서는
                // 재제출하지 않고 이번 tick은 건너뛴다 — TTL(30min)이
                // 만료되면 다음 tick이 마커 없음으로 보고 새로 submit한다.
                continue;
            } else {
                if (await isSkipped(u.symbol, tab)) continue; // FIX C: terminal backoff 중.

                seamsRunForSymbol++;
                const submitResult = await TAB_SEAMS[tab]({
                    symbol: u.symbol,
                    companyName,
                    fmpSymbol,
                });

                if (
                    submitResult !== null &&
                    (submitResult.status === 'submitted' ||
                        submitResult.status === 'pending_dependencies')
                ) {
                    counts.submitted++;
                    const jobId = submitResult.jobId;
                    await markInFlight(u.symbol, tab, jobId);
                    if (jobId === undefined) {
                        // pending_dependencies — 단일 jobId가 없어(축별
                        // pendingJobs) resume-poll 대상이 아니다. 다음
                        // tick(들)이 자연 재시도한다(기존 동작 유지).
                        continue;
                    }
                    outcome = await pollUntilSettled(
                        () => TAB_POLLS[tab](jobId),
                        batchDeadline,
                        clock
                    );
                } else {
                    outcome = submitResult;
                }
            }

            const harvested = await resolveHarvest(
                u.symbol,
                tab,
                outcome,
                repo,
                counts
            );
            if (harvested) freshTabCount++;
        } catch (error) {
            if (getFmpErrorStatus(error) === 402) {
                // 402는 심볼 단위 이슈(플랜/쿼터) — 배치 중단 사유가 아니다.
                console.error(`[seo-prewarm] fmp-402 ${u.symbol}:${tab}`);
            } else {
                console.error(
                    `[seo-prewarm] unit-error ${u.symbol}:${tab}`,
                    error
                );
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
}
