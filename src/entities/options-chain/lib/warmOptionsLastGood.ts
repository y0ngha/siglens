import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    readLastGoodCapturedAtBatch,
    refreshLastGoodSnapshot,
    type LastGoodRefreshResult,
} from './optionsDataCache';
import { getOptionsWarmWindow } from './optionsWarmWindow';
import {
    type OptionsWarmPick,
    OPTIONS_WARM_SYMBOLS_PER_TICK,
    buildOptionsWarmUniverse,
    selectOptionsWarmSymbols,
} from './selectOptionsWarmSymbols';

/**
 * 옵션 워밍 전용 회전 커서. seo-prewarm의 `rotation-cursor`와 **다른 키**다 — 저쪽은
 * 탭 배치 오프셋이라 같은 값을 공유하면 서로의 걸음을 건너뛰게 된다. TTL을 두지 않는다
 * (값이 의미를 잃을 일이 없고, 유실돼도 0에서 다시 시작하면 자체 치유된다).
 */
export const OPTIONS_WARM_CURSOR_KEY = 'options-warm:last-good-cursor';

/**
 * 동시에 처리하는 종목 수(레인 수). `YahooOptionsAdapter.fetchSnapshot`은 종목당 첫 호출 1건
 * + 슬롯 매핑으로 모자란 만기 추가 호출을 병렬로 낸다. 슬롯은 1W/2W/1M/2M/3M/6M 6개라
 * 종목당 최대 7건이고 그중 순간 동시 최대 6건이다. 따라서
 * - **순간 동시 요청**: 레인 2 × 6 = 최대 12건 — 20건 안팎의 가이드 안이다.
 * - **tick당 총 요청**: 6종목 × 7건 = 최대 42건(시간에 걸쳐 분산, 가이드와 무관).
 * 순간 동시 수가 가이드 안이라 종목 간 지연이나 백오프는 두지 않는다.
 *
 * 레포의 공용 청크 헬퍼(`fetchInChunks`)는 존재하지 않아 재사용하지 않는다(이 레포에
 * `FETCH_CONCURRENCY`·`fetchInChunks`는 없다). 필요한 건 "종목별 타임아웃 + 시작 마감"을
 * 가진 아주 작은 레인 풀이라 `runLane`으로 직접 둔다.
 */
export const OPTIONS_WARM_CONCURRENCY = 2;

/**
 * 이 step이 새 종목을 **시작**할 수 있는 마지노선(ms). prewarm 락 안에서 이어지는
 * prune·락 해제를 의미 있게 늦추지 않기 위한 값이다. 락 잔여 예산이 더 작으면 그쪽이
 * 이긴다(`budgetEndMs`).
 */
export const OPTIONS_WARM_DEADLINE_MS = 45 * MS_PER_SECOND;

/**
 * 종목 한 건(`refreshLastGoodSnapshot`)의 최대 대기. 어댑터 호출에는 자체 타임아웃이 없어
 * 멈춘 Yahoo 요청이 워커와 락 해제를 영원히 붙잡을 수 있다. 타임아웃이 나도 요청은
 * 취소되지 않고(orphan) 그 종목은 `none`으로 센다 — 목적은 락 보호이지 취소가 아니다.
 *
 * 타임아웃 난 종목은 **소비된 것으로 보고 커서가 지나간다**(다음 tick에 바로 재시도하지
 * 않는다). 계속 멈추는 종목 하나가 회전 전체를 붙잡으면 안 되기 때문이다. 그 종목은
 * last-good이 여전히 없으므로 다음 바퀴(유니버스를 한 바퀴 돈 뒤)에 다시 후보가 된다.
 */
export const OPTIONS_WARM_REFRESH_TIMEOUT_MS = 15 * MS_PER_SECOND;

export interface OptionsWarmOptions {
    /**
     * 이 step이 끝나 있어야 하는 절대 시각(epoch ms) — 호출자가 락 TTL에서 안전 여유를
     * 뺀 값으로 준다. 새 종목 시작 마감은 이 값에서 종목 타임아웃을 뺀 시각이라 마지막
     * 종목까지 포함해 이 시각 안에 끝난다. 남은 예산이 종목 타임아웃보다 작으면 step을
     * 건너뛴다. 생략하면 `OPTIONS_WARM_DEADLINE_MS`만 적용한다.
     */
    budgetEndMs?: number;
}

/**
 * 오늘 마감 이후 후보 전체가 확보됐음을 표시하는 키 접두사. 전부 확보된 날 tick마다 후보
 * 최대 100종목의 last-good(스냅샷 전체)을 Redis에서 읽는 낭비를 막는다. 키에 마감 시각(ms)을
 * 넣어 다음 거래일엔 자연히 다른 키가 된다.
 */
const COMPLETE_KEY_PREFIX = 'options-warm:complete:';

export interface OptionsWarmCounts {
    written: number;
    stale: number;
    none: number;
    skipped: number;
    /** 시간 예산 때문에 다음 tick으로 미룬 종목 수. */
    deferred: number;
}

export type OptionsWarmOutcome =
    | { status: 'out_of_window' }
    | { status: 'no_redis' }
    /** 남은 락 예산이 종목 한 건을 돌리기에도 모자라 건너뛰었다. */
    | { status: 'no_budget' }
    /** 오늘 마감 이후 후보 전체가 이미 확보돼 있다. */
    | { status: 'complete' }
    /** 락 예산 안에 끝내지 못해 중단했다(Redis 호출이 멈춘 경우의 안전망). */
    | { status: 'timed_out' }
    | ({ status: 'ran' } & OptionsWarmCounts);

async function readCursor(
    redis: NonNullable<ReturnType<typeof getRedisClient>>
): Promise<number> {
    const stored = await redis.get<number | string>(OPTIONS_WARM_CURSOR_KEY);
    const parsed = Number(stored ?? 0);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * `work`가 `ms` 안에 끝나지 않으면 `onTimeout`을 돌려준다. `work`는 취소되지 않는다
 * (orphan) — 락·워커 보호용이다. 타이머는 항상 정리한다.
 */
async function withTimeout<T>(
    work: Promise<T>,
    ms: number,
    onTimeout: T
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>(resolve => {
        timer = setTimeout(() => resolve(onTimeout), Math.max(ms, 0));
    });
    try {
        return await Promise.race([work, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

async function isUniverseComplete(
    redis: NonNullable<ReturnType<typeof getRedisClient>>,
    key: string
): Promise<boolean> {
    try {
        return (await redis.get(key)) !== null;
    } catch (error) {
        console.error(
            '[optionsWarm] complete flag read failed for',
            key,
            error
        );
        return false;
    }
}

async function markUniverseComplete(
    redis: NonNullable<ReturnType<typeof getRedisClient>>,
    key: string,
    ttlSeconds: number
): Promise<void> {
    try {
        await redis.set(key, 1, { ex: ttlSeconds });
    } catch (error) {
        console.error(
            '[optionsWarm] complete flag write failed for',
            key,
            error
        );
    }
}

interface WarmStepContext {
    redis: NonNullable<ReturnType<typeof getRedisClient>>;
    now: Date;
    /** 새 종목을 시작할 수 있는 마지막 시각(epoch ms). */
    startDeadlineMs: number;
    closeMs: number;
    completeKey: string;
    completeTtlSeconds: number;
}

/** 한 종목의 처리 결과. `result`가 null이면 시작 마감을 넘겨 미뤘다는 뜻이다. */
interface PickOutcome {
    pick: OptionsWarmPick;
    result: LastGoodRefreshResult | null;
}

/**
 * 한 레인이 맡은 종목을 순서대로 처리한다. 종목마다 시작 마감을 확인하고(넘기면 그 종목
 * 부터 전부 미룬다), 시작한 종목은 `OPTIONS_WARM_REFRESH_TIMEOUT_MS`로 끊는다.
 */
function runLane(
    lane: readonly OptionsWarmPick[],
    now: Date,
    startDeadlineMs: number
): Promise<readonly PickOutcome[]> {
    return lane.reduce<Promise<readonly PickOutcome[]>>(
        async (previous, pick) => {
            const done = await previous;
            if (Date.now() >= startDeadlineMs) {
                return [...done, { pick, result: null }];
            }
            const result = await withTimeout<LastGoodRefreshResult>(
                refreshLastGoodSnapshot(pick.symbol, now),
                OPTIONS_WARM_REFRESH_TIMEOUT_MS,
                'none'
            );
            return [...done, { pick, result }];
        },
        Promise.resolve([])
    );
}

async function runWarmStep({
    redis,
    now,
    startDeadlineMs,
    closeMs,
    completeKey,
    completeTtlSeconds,
}: WarmStepContext): Promise<OptionsWarmOutcome> {
    if (await isUniverseComplete(redis, completeKey)) {
        return { status: 'complete' };
    }

    const universe = buildOptionsWarmUniverse();
    const cursor = await readCursor(redis);
    // 후보 전체의 capturedAt을 MGET 한 번으로 읽는다. 값이 없으면 미확보로 본다.
    const capturedAtBySymbol = await readLastGoodCapturedAtBatch(universe);

    const selection = selectOptionsWarmSymbols({
        universe,
        cursor,
        batchSize: OPTIONS_WARM_SYMBOLS_PER_TICK,
        isCaptured: symbol => {
            const capturedMs = Date.parse(capturedAtBySymbol.get(symbol) ?? '');
            return Number.isFinite(capturedMs) && capturedMs > closeMs;
        },
    });

    // 선택 순서대로 레인에 번갈아 나눈다.
    const lanes = Array.from(
        { length: OPTIONS_WARM_CONCURRENCY },
        (_, laneIndex) =>
            selection.picks.filter(
                (_pick, index) => index % OPTIONS_WARM_CONCURRENCY === laneIndex
            )
    );
    const outcomes = (
        await Promise.all(
            lanes.map(lane => runLane(lane, now, startDeadlineMs))
        )
    ).flat();

    const counts = outcomes.reduce<OptionsWarmCounts>(
        (acc, { result }) =>
            result === null
                ? { ...acc, deferred: acc.deferred + 1 }
                : { ...acc, [result]: acc[result] + 1 },
        {
            written: 0,
            stale: 0,
            none: 0,
            skipped: selection.skipped,
            deferred: 0,
        }
    );

    // 미룬 종목 중 가장 앞 걸음 직전까지만 전진한다 — 미룬 종목이 다음 tick의 첫 후보가
    // 된다. 레인이 서로 다른 시각에 마감을 만나면 미룬 종목 뒤의 종목이 이미 처리됐을 수
    // 있는데, 그건 다음 tick에 한 번 더 처리될 뿐(멱등 쓰기)이라 빈틈보다 낫다.
    const firstDeferredStep = Math.min(
        ...outcomes.filter(o => o.result === null).map(o => o.pick.step)
    );
    const consumed =
        counts.deferred === 0 ? selection.examined : firstDeferredStep - 1;
    const universeLength = universe.length;
    if (universeLength > 0) {
        try {
            await redis.set(
                OPTIONS_WARM_CURSOR_KEY,
                (cursor + consumed) % universeLength
            );
        } catch (error) {
            console.error(
                '[optionsWarm] cursor write failed for',
                OPTIONS_WARM_CURSOR_KEY,
                error
            );
        }
    }
    // 한 바퀴를 전부 건너뛰었다 = 후보 전체가 오늘 마감 이후 값을 갖고 있다.
    if (universeLength > 0 && selection.skipped === universeLength) {
        await markUniverseComplete(redis, completeKey, completeTtlSeconds);
    }
    return { status: 'ran', ...counts };
}

/**
 * 미국 정규장 마감 직후(Yahoo가 OI를 아직 들고 있는 구간)에 인기 옵션 종목의 last-good
 * 스냅샷을 채운다. 한국 낮에 옵션 탭을 여는 방문자가 stale 배너 대신 직전 정규장 값을
 * 보게 하려는 것이다. LLM은 호출하지 않는다 — Yahoo 조회와 Redis 쓰기뿐이다.
 *
 * 구간 밖이면 아무것도 하지 않는다(`getOptionsWarmWindow`). 구간 안에서는 tick당
 * `OPTIONS_WARM_SYMBOLS_PER_TICK`개를 `OPTIONS_WARM_CONCURRENCY`로 병렬 처리하고 커서를
 * 전진시킨다. 이미 오늘 마감 이후 last-good이 있는 종목은 Yahoo를 치지 않고 넘어가고,
 * 후보 전체가 확보된 날은 완료 표식으로 이후 tick을 Redis 1회 조회로 끝낸다.
 *
 * 시간 경계: 이 step은 prewarm 락을 쥔 채 `runPrewarmBatch` 뒤에 돈다. 배치가 이미
 * 락 TTL에서 안전 여유를 뺀 예산(`BATCH_WALL_CLOCK_BUDGET_MS`)까지 쓸 수 있으므로,
 * 호출자가 같은 예산의 끝(`budgetEndMs`)을 넘기면 (1) 남은 예산이 종목 한 건
 * 타임아웃보다 작을 땐 건너뛰고 (2) 새 종목 시작 마감을 `budgetEndMs - 종목 타임아웃`으로
 * 당기며 (3) 종목마다 타임아웃을 걸고 (4) 전체를 `budgetEndMs`에서 한 번 더 끊는다.
 * 그래서 멈춘 Yahoo/Redis 호출이 prune과 락 해제를 막을 수 없다.
 */
export async function warmOptionsLastGood(
    now: Date = new Date(),
    { budgetEndMs }: OptionsWarmOptions = {}
): Promise<OptionsWarmOutcome> {
    const window = getOptionsWarmWindow(now);
    if (window === null) return { status: 'out_of_window' };

    const redis = getRedisClient();
    if (redis === null) return { status: 'no_redis' };

    const startedAtMs = Date.now();
    const startDeadlineMs = Math.min(
        startedAtMs + OPTIONS_WARM_DEADLINE_MS,
        (budgetEndMs ?? Number.POSITIVE_INFINITY) -
            OPTIONS_WARM_REFRESH_TIMEOUT_MS
    );
    if (startDeadlineMs <= startedAtMs) return { status: 'no_budget' };

    const closeMs = window.closeUtc.getTime();
    const step = runWarmStep({
        redis,
        now,
        startDeadlineMs,
        closeMs,
        completeKey: `${COMPLETE_KEY_PREFIX}${closeMs}`,
        completeTtlSeconds: Math.max(
            Math.ceil(
                (window.endUtc.getTime() - now.getTime()) / MS_PER_SECOND
            ),
            1
        ),
    });
    if (budgetEndMs === undefined) return step;
    return withTimeout<OptionsWarmOutcome>(step, budgetEndMs - startedAtMs, {
        status: 'timed_out',
    });
}
