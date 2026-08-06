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
    clearInFlight,
    getFmpBudgetUsed,
    getInFlightMarker,
    isSkipped,
    markInFlight,
} from './lock';
import { TAB_SEAMS, resolveHarvest } from './harvest';

export interface PrewarmBatchCounts {
    harvested: number;
    revalidated: number;
    remaining: number;
    fmpBudgetUsed: number;
}

/**
 * FIX Z(감사) — run* 함수가 LLM 블로킹 호출이라 심볼당 소요 시간이 길다.
 * 원래 10 → 6으로 낮춰 청크(SYMBOL_CONCURRENCY=3 기준 2청크)당 최악 대기가
 * 과도해지지 않게 한다 — 실제 상한은 BATCH_DEADLINE_MS가 건다(이 상수는
 * "정상 tick의 목표 처리량"일 뿐, 배치 전체를 막는 하드 캡이 아니다).
 */
const SYMBOLS_PER_TICK = 6;
// core fundamental이 Promise.all로 ~13개 FMP 호출을 한번에 쏨 → 3×13≈40 순간 버스트 캡 (spec §8).
const SYMBOL_CONCURRENCY = 3;
// FIX A(감사) — bounded in-flight/backoff 후보 스캔 폭. selectFairBatch 참고.
const CANDIDATE_WINDOW_MULTIPLIER = 3;
// 회전 오프셋의 시간 눈금 — EventBridge 스케줄 간격(5분, 13-seo-prewarm.sh)과 맞춘다.
//
// ⚠️ **불변식**: `BATCH_DEADLINE_MS + 스케줄주기 ≤ CANDIDATE_WINDOW_MULTIPLIER × TICK_ROTATION_MS`
//
// 회전 폭을 결정하는 건 스케줄 주기가 아니라 **배치가 실제로 시작되는 간격**이다.
// Redis 루트 락(LOCK_TTL 900s)이 중첩 실행을 막으므로, 앞 배치가 데드라인까지
// 쓰면 다음 시작은 `BATCH_DEADLINE_MS` 뒤의 첫 스케줄 tick이다. 그 간격만큼
// offset이 뛰고, 뜀폭이 창 폭(`SYMBOLS_PER_TICK × CANDIDATE_WINDOW_MULTIPLIER` = 18)을
// 넘으면 창과 창 사이에 **영영 후보가 되지 않는 구멍**이 생긴다 — livelock과 같은
// 부류의 기아가 재발한다.
//
// 현재 값: 600s(데드라인) + 300s(스케줄) = 900s = 15분 → 전진 18 = 창 18.
// **여유 없이 경계에 정확히 걸쳐 있다.** 따라서 `BATCH_DEADLINE_MS`를 늘리는 것만으로도
// (EventBridge를 건드리지 않아도) 불변식이 깨진다 — 아래 BATCH_DEADLINE_MS 주석 참조.
// 스케줄이나 데드라인을 바꾸려면 `CANDIDATE_WINDOW_MULTIPLIER`를 함께 올릴 것.
const TICK_ROTATION_MS = 5 * 60 * 1000;
// FIX G(감사) — 배치 전체 wall-clock 상한. LOCK_TTL_SECONDS(900s)보다 충분히
// 작고 5분 tick 주기보다는 커서, 정상 배치가 잘리지 않으면서도 락 만료 전에
// 반드시 끝나 "락 만료 → 다음 tick이 새 락 획득 → 배치 2개 동시 실행" 오버랩을
// 막는다(FMP 429 폭풍 중 심볼당 최악 ~75s(10s 타임아웃 + 10/15/20s 재시도)로
// 10심볼 배치가 900s를 넘길 수 있었던 문제).
// ⚠️ 이 값을 늘리면 회전 불변식이 깨진다 — `TICK_ROTATION_MS` 주석의
// `BATCH_DEADLINE_MS + 스케줄주기 ≤ 15분`을 반드시 함께 확인할 것. 현재 정확히
// 경계값(600s + 300s = 900s)이라 여유가 없다.
const BATCH_DEADLINE_MS = 600_000; // 10min
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
    const isPastDeadline = () => clock.now() > batchDeadline;
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
    const batch = await selectFairBatch(
        staleSymbols,
        generatedAtMap,
        boundary,
        clock.now()
    );
    const counts: PrewarmBatchCounts = {
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
        if (isPastDeadline()) {
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
                    isPastDeadline
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
 * 배열 끝에 붙임)이 평일엔 영원히 도달하지 못했다.
 *
 * ⚠️ **offset은 진행도가 아니라 시각에서 파생해야 한다** (2026-07-26 인시던트).
 * 최초 구현은 offset을 "전 탭이 fresh로 완료된 심볼 수"(freshCount)로 잡았다.
 * 진행이 있을 때는 잘 흘러가지만, 창 안 후보가 **전부 blocked**가 되는 순간
 * 아무것도 완료되지 않아 freshCount가 얼어붙고, 그러면 offset도 얼어붙어
 * 다음 tick이 **같은 창을 재검사**한다 — 스스로 빠져나올 수 없는 livelock이다.
 * 첫 야간 운영에서 실제로 발생했다: `submitted:0 / remaining:153`이 반복되며
 * 221/295 심볼에서 정지(skip 마커 69 + in-flight 7이 창 18칸을 덮음).
 *
 * 그래서 offset을 tick 시각에서 뽑는다 — `floor(now / TICK_ROTATION_MS) *
 * SYMBOLS_PER_TICK`. 진행 여부와 무관하게 매 tick 창이 `SYMBOLS_PER_TICK`칸씩
 * 전진하므로 blocked 구간을 반드시 통과하고, 유니버스 tail 도달 문제(위 원래
 * 목적)도 그대로 해결된다. Math.random이나 Redis 커서 없이 결정적이며,
 * 같은 tick 안의 재시도(EventBridge 재전송)는 같은 offset을 얻어 멱등이다.
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
    boundary: Date,
    nowMs: number
): Promise<PrewarmSymbol[]> {
    if (staleSymbols.length === 0) return [];

    // 회전 오프셋은 **시각**에서 파생한다(아래 doc-comment ① 참조).
    const offset =
        (Math.floor(nowMs / TICK_ROTATION_MS) * SYMBOLS_PER_TICK) %
        staleSymbols.length;
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
    isPastDeadline: () => boolean
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
        if (isPastDeadline()) break;

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
            // FIX 1(감사, PR #698 리뷰) — in-flight 마커가 있으면 이번 tick은
            // 건너뛴다. TTL(30min) 만료 후 다음 tick이 새로 submit한다.
            if (marker.present) continue;
            if (await isSkipped(u.symbol, tab)) continue; // FIX C: terminal backoff 중.

            seamsRunForSymbol++;
            await markInFlight(u.symbol, tab);
            try {
                const outcome = await TAB_SEAMS[tab]({
                    symbol: u.symbol,
                    companyName,
                    fmpSymbol,
                });

                const harvested = await resolveHarvest(
                    u.symbol,
                    tab,
                    outcome,
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
