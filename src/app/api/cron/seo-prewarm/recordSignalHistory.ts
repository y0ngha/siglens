import { revalidateTag } from 'next/cache';
import { confirmedSignalTimeline } from '@y0ngha/siglens-core';
import {
    DrizzleSignalHistoryRepository,
    SIGNAL_HISTORY_CACHE_TAG,
} from '@/entities/signal-history/api';
import {
    applyScanAttempts,
    summarizeSession,
    type ScanAttempt,
    type SessionSummary,
} from '@/entities/signal-history/lib/scanProgress';
import { isSymbolSettled } from '@/entities/signal-history/lib/scanMode';
import { SIGNAL_SCAN_MAX_ATTEMPTS } from '@/entities/signal-history/lib/signalScanConstants';
import {
    recordableSessionDate,
    SIGNAL_SETTLE_MINUTES,
} from '@/entities/signal-history/lib/signalEventRows';
import type {
    ScanCursor,
    ScanProgressPruneResult,
    SignalHistoryMarket,
} from '@/entities/signal-history/types';
import { getKoreanNames } from '@/entities/ticker/server/koreanNameStore';
import {
    getSignalScanMarketDataProvider,
    type SignalScanMarketData,
} from '@/shared/api/market/getSignalScanMarketDataProvider';
import { sessionSpecForDashboardScope } from '@/shared/api/market/sessionSpecFor';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    SIGNAL_SCAN_UNIVERSE_AS_OF,
    signalScanTargets,
    type SignalScanTarget,
} from '@/shared/config/signalScanUniverse/signalScanUniverse';
import { MS_PER_DAY } from '@/shared/config/time';
import type { SiglensDatabase } from '@/shared/db/types';
import { addUtcIsoDays, toUtcIsoDate } from '@/shared/lib/isoDate';
import { withTimeout } from '@/shared/lib/withTimeout';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { scanSymbol, type ConfirmedSignalTimeline } from './scanSymbol';

/**
 * 신호 이력 보존 기간(일, 마지막 포착 세션 기준). 신호별 페이지는 최근 몇 주만 보여 주지만, 신호가
 * 드문 날이 이어질 때 목록을 채우고 나중에 신호별 빈도를 볼 수 있게 넉넉히 둔다.
 * 규모 근거: 종목당 세션마다 새 에피소드 약 0.9건(2026-11 재생 실측, 확정 신호 전부) — 대상 약 860종목이면
 * 미국·한국 한 쌍의 세션에 약 780행, 400일이면 약 21만 행(약 65MB)이다. 2026-11-15 운영 `/market` 실측
 * (약 100종목 230건)과 같은 비율이다. 재측정: `select count(*) from signal_events`.
 */
const SIGNAL_HISTORY_RETENTION_DAYS = 400;

/** 종목을 동시에 몇 개씩 기록하는가(CC-1). 시작 속도는 provider의 간격이 따로 묶는다. */
const SIGNAL_SCAN_SYMBOL_CONCURRENCY = 4;

/**
 * 예산이 끝나기 이만큼(ms) 전부터는 새 종목을 시작하지 않는다. 이미 시작한 종목이 마저 끝날 시간이고,
 * 못 시작한 종목은 다음 실행이 이어 받는다(CC-13·CC-15: 진행은 실제로 시도한 종목만큼만).
 */
const SIGNAL_SCAN_DEADLINE_MARGIN_MS = 10_000;

/** 이 횟수 이상 시도한 뒤 실패·낡은 데이터가 이 비율 이상이면 프로바이더 장애로 보고 실행을 멈춘다. */
const OUTAGE_MIN_ATTEMPTS = 20;
const OUTAGE_FAILURE_RATIO = 0.5;

/** 장애로 멈춘 시장·세션을 다시 시도하기까지의 간격(초). 크론이 5분마다 돌아도 이 동안은 건너뛴다. */
const OUTAGE_BACKOFF_TTL_SECONDS = 10 * 60;

/** `process.cpuUsage()`는 마이크로초 단위다. */
const MICROSECONDS_PER_MS = 1000;

/** 대상 목록 기준일이 이 일수보다 오래되면 로그로 알린다(분기별 재생성 주기를 훌쩍 넘긴 경우). */
const UNIVERSE_STALE_DAYS = 200;

function backoffMarkerKey(
    market: SignalHistoryMarket,
    sessionDate: string
): string {
    return `signal-history:backoff:v2:${market}:${sessionDate}`;
}

/** 한 실행의 집계 — `[signal-history] scan run` 로그 한 줄의 내용이다. */
export interface ScanRunSummary {
    readonly market: SignalHistoryMarket;
    readonly session: string;
    /** 이 실행을 시작할 때 아직 정리되지 않은 종목 수. */
    readonly pending: number;
    /** 이 실행이 실제로 시도한 종목 수(`pending` 이하). */
    readonly attempted: number;
    readonly recorded: number;
    readonly bootstrapped: number;
    readonly caughtUp: number;
    readonly failed: number;
    readonly stale: number;
    /** 기록은 했지만 마지막 날의 판정이 불가(`signals: null`)였던 종목 수 — 이어지던 에피소드를 그대로 이어 갔다. */
    readonly nullLatest: number;
    /** 시도를 다 써서 기록 없이 정리된 종목 수(세션 전체 기준). */
    readonly settledFailed: number;
    /** 이 세션의 모든 대상이 정리됐는가. */
    readonly completed: boolean;
    /** 이 실행이 업스트림(FMP·yahoo)으로 내보낸 호출 수 — 캐시 적중은 세지 않는다. */
    readonly upstreamCalls: number;
    readonly elapsedMs: number;
    /** 이 실행 동안 프로세스가 쓴 CPU(ms). 두 시장이 같이 돌면 서로의 몫이 섞인다. */
    readonly cpuMs: number;
}

/** 보존 정리 결과. 각 값은 그 정리가 던지면 `null`. */
export interface SignalHistoryPruneResult {
    readonly events: number | null;
    readonly progress: ScanProgressPruneResult | null;
}

/** 시장 하나의 결과. `skipped`는 지금이 기록 시점이 아니거나 처리할 것이 없다는 뜻이다. */
type MarketRecordOutcome =
    | { readonly status: 'skipped' }
    | {
          readonly status: 'ran';
          readonly summary: ScanRunSummary;
          /** 이 실행이 세션을 완료시켰을 때만 정리를 한다. 아니면 `null`. */
          readonly pruned: SignalHistoryPruneResult | null;
      }
    | { readonly status: 'failed' };

export type RecordSignalHistoryResult =
    | {
          readonly status: 'done';
          readonly us: MarketRecordOutcome;
          readonly kr: MarketRecordOutcome;
      }
    /** 예산 안에 끝나지 않았다(멈춘 Redis·DB·프로바이더). 이미 시작한 작업은 뒤에서 마저 돈다. */
    | { readonly status: 'timed_out' };

/** 장애 백오프 표식 저장소. Redis가 없으면 `null`(그때는 백오프만 잃는다 — 진행은 DB에 있다). */
export interface RecordedMarkerStore {
    has(key: string): Promise<boolean>;
    mark(key: string, ttlSeconds: number): Promise<void>;
}

/** 한글명 조회 — 종목 심볼 → 한글명. 없는 종목은 키가 없다. */
export type LoadKoreanNames = (
    symbols: string[]
) => Promise<Record<string, string>>;

interface RecordSignalHistoryOptions {
    readonly now?: Date;
    /** 이 시각(epoch ms)까지 끝나지 않으면 기다리지 않고 `timed_out`. 이미 지났으면 시작하지 않는다. */
    readonly budgetEndMs?: number;
    readonly markers?: RecordedMarkerStore | null;
    /** 세션을 완료시키면 신호 페이지 캐시를 비운다. 기본은 `revalidateTag`. 테스트가 갈아 끼운다. */
    readonly invalidate?: () => void;
    /** 시장별 봉·시세 provider(속도 제한 포함). 테스트가 갈아 끼운다. */
    readonly providerFor?: (
        market: SignalHistoryMarket
    ) => SignalScanMarketData;
    readonly timeline?: ConfirmedSignalTimeline;
    readonly koreanNames?: LoadKoreanNames;
}

function redisMarkers(): RecordedMarkerStore | null {
    const redis = getRedisClient();
    if (redis === null) return null;
    return {
        has: async key => (await redis.get(key)) !== null,
        mark: async (key, ttlSeconds) => {
            await redis.set(key, 1, { ex: ttlSeconds });
        },
    };
}

function invalidateSignalPages(): void {
    revalidateTag(SIGNAL_HISTORY_CACHE_TAG, 'max');
}

const yieldToEventLoop = (): Promise<void> =>
    new Promise(resolve => setImmediate(resolve));

interface MarketContext {
    readonly repo: DrizzleSignalHistoryRepository;
    readonly now: Date;
    readonly budgetEndMs: number | undefined;
    readonly markers: RecordedMarkerStore | null;
    readonly invalidate: () => void;
    readonly providerFor: (market: SignalHistoryMarket) => SignalScanMarketData;
    readonly timeline: ConfirmedSignalTimeline;
    readonly koreanNames: LoadKoreanNames;
}

/** 대상 목록 기준일이 너무 오래됐으면 시장당 한 번 로그로 알린다. */
function warnIfUniverseStale(market: SignalHistoryMarket, now: Date): void {
    const ageDays =
        (now.getTime() - Date.parse(SIGNAL_SCAN_UNIVERSE_AS_OF[market])) /
        MS_PER_DAY;
    if (ageDays > UNIVERSE_STALE_DAYS) {
        console.warn(
            `[signal-history] universe stale: ${market} (as of ${SIGNAL_SCAN_UNIVERSE_AS_OF[market]})`
        );
    }
}

/**
 * 정리되지 않은 종목. 진행 표식이 있는 종목(비용이 작은 하루치·따라잡기)을 먼저 하고 처음 기록하는 종목
 * (120세션 재계산)을 뒤에 둔다 — 신호 페이지가 최신 상태를 먼저 갖게 하려는 것이다. 이 세션에 이미 실패·낡은
 * 데이터로 시도한 종목(`attemptSession === session`)은 맨 뒤다: 상장폐지·거래정지 종목이 앞에 몰려 새 시도의
 * 절반을 채우면 정상 종목이 있는데도 장애 차단기가 켜지기 때문이다.
 */
function pendingTargets(
    targets: readonly SignalScanTarget[],
    cursors: ReadonlyMap<string, ScanCursor>,
    session: string
): readonly SignalScanTarget[] {
    const open = targets.filter(
        target =>
            !isSymbolSettled(
                cursors.get(target.symbol),
                session,
                SIGNAL_SCAN_MAX_ATTEMPTS
            )
    );
    const hasHistory = (target: SignalScanTarget): boolean =>
        (cursors.get(target.symbol)?.lastSession ?? null) !== null;
    const retried = (target: SignalScanTarget): boolean =>
        cursors.get(target.symbol)?.attemptSession === session;
    const fresh = open.filter(target => !retried(target));
    return [
        ...fresh.filter(hasHistory),
        ...fresh.filter(t => !hasHistory(t)),
        ...open.filter(retried),
    ];
}

/**
 * 한글명이 없는 종목만 `korean_tickers`에서 한 번에 찾는다. 조회 실패는 이름 없음으로 둔다 — 이름은 목록을
 * 꾸밀 뿐이라 기록을 막지 않는다.
 */
async function namesFor(
    pending: readonly SignalScanTarget[],
    lookup: LoadKoreanNames
): Promise<ReadonlyMap<string, string | null>> {
    const missing = pending
        .filter(target => target.koreanName === null)
        .map(target => target.symbol);
    const found: Record<string, string> =
        missing.length === 0
            ? {}
            : await lookup(missing).catch(error => {
                  console.error(
                      '[signal-history] korean names failed:',
                      redactDbErrorForLog(error)
                  );
                  return {};
              });
    return new Map(
        pending.map(target => [
            target.symbol,
            target.koreanName ?? found[target.symbol] ?? null,
        ])
    );
}

interface RunProgress {
    readonly results: readonly ScanAttempt[];
    readonly nullLatest: number;
    readonly bootstrapped: number;
    readonly caughtUp: number;
    readonly stopReason: 'deadline' | 'outage' | null;
}

function isOutageSuspected(results: readonly ScanAttempt[]): boolean {
    const failures = results.filter(r => r.outcome !== 'recorded').length;
    return (
        results.length >= OUTAGE_MIN_ATTEMPTS &&
        failures >= results.length * OUTAGE_FAILURE_RATIO
    );
}

/**
 * `pending`를 `SIGNAL_SCAN_SYMBOL_CONCURRENCY`개씩 끊어 기록한다. 덩어리를 시작하기 전에 예산·장애를
 * 확인하므로 멈춰도 이미 시작한 종목은 끝까지 간다.
 */
async function runChunks(
    pending: readonly SignalScanTarget[],
    offset: number,
    scanOne: (target: SignalScanTarget) => ReturnType<typeof scanSymbol>,
    deadlineMs: number | undefined,
    progress: RunProgress
): Promise<RunProgress> {
    if (offset >= pending.length) return progress;
    if (deadlineMs !== undefined && Date.now() > deadlineMs) {
        return { ...progress, stopReason: 'deadline' };
    }
    if (isOutageSuspected(progress.results)) {
        return { ...progress, stopReason: 'outage' };
    }
    const chunk = pending.slice(
        offset,
        offset + SIGNAL_SCAN_SYMBOL_CONCURRENCY
    );
    const outcomes = await Promise.all(
        chunk.map(async target => ({
            symbol: target.symbol,
            result: await scanOne(target),
        }))
    );
    const attempts = outcomes.map(({ symbol, result }): ScanAttempt =>
        result.outcome === 'recorded'
            ? { symbol, outcome: 'recorded' }
            : {
                  symbol,
                  outcome: result.outcome,
                  persisted: result.persisted,
              }
    );
    const nullLatest = outcomes.filter(
        ({ result }) => result.outcome === 'recorded' && result.latestUnknown
    ).length;
    const recordedModes = outcomes.flatMap(({ result }) =>
        result.outcome === 'recorded' ? [result.mode] : []
    );
    return runChunks(pending, offset + chunk.length, scanOne, deadlineMs, {
        results: [...progress.results, ...attempts],
        nullLatest: progress.nullLatest + nullLatest,
        bootstrapped:
            progress.bootstrapped +
            recordedModes.filter(m => m === 'bootstrap').length,
        caughtUp:
            progress.caughtUp +
            recordedModes.filter(m => m === 'catch_up').length,
        stopReason: null,
    });
}

function summarizeRun(input: {
    readonly market: SignalHistoryMarket;
    readonly session: string;
    readonly pending: number;
    readonly progress: RunProgress;
    readonly sessionSummary: SessionSummary;
    readonly upstreamCalls: number;
    readonly startedAtMs: number;
    readonly cpuStart: NodeJS.CpuUsage;
}): ScanRunSummary {
    const { progress } = input;
    const cpu = process.cpuUsage(input.cpuStart);
    const count = (outcome: ScanAttempt['outcome']) =>
        progress.results.filter(r => r.outcome === outcome).length;
    return {
        market: input.market,
        session: input.session,
        pending: input.pending,
        attempted: progress.results.length,
        recorded: count('recorded'),
        bootstrapped: progress.bootstrapped,
        caughtUp: progress.caughtUp,
        failed: count('failed'),
        stale: count('stale'),
        nullLatest: progress.nullLatest,
        settledFailed: input.sessionSummary.settledFailed,
        completed: input.sessionSummary.allSettled,
        upstreamCalls: input.upstreamCalls,
        elapsedMs: Date.now() - input.startedAtMs,
        cpuMs: Math.round((cpu.user + cpu.system) / MICROSECONDS_PER_MS),
    };
}

/** 두 시장의 대상 목록 — 정리가 "대상에서 빠진 종목"의 진행 표식을 지우는 데 쓴다. */
function universeSymbols(): Readonly<
    Record<SignalHistoryMarket, readonly string[]>
> {
    return {
        us: signalScanTargets('us').map(t => t.symbol),
        kr: signalScanTargets('kr').map(t => t.symbol),
    };
}

async function pruneAfterCompletion(
    repo: DrizzleSignalHistoryRepository,
    now: Date
): Promise<SignalHistoryPruneResult> {
    const cutoff = addUtcIsoDays(
        toUtcIsoDate(now),
        -SIGNAL_HISTORY_RETENTION_DAYS
    );
    const attempt = <T>(label: string, work: () => Promise<T>) =>
        work().catch((error: unknown) => {
            console.error(
                `[signal-history] ${label} prune failed:`,
                redactDbErrorForLog(error)
            );
            return null;
        });
    return {
        events: await attempt('events', () => repo.pruneOlderThan(cutoff)),
        progress: await attempt('progress', () =>
            repo.pruneScanProgress(cutoff, universeSymbols())
        ),
    };
}

/** 완료한 세션: 신호 페이지 캐시를 비우고 보존 정리를 한다. 둘 다 던지지 않는다. */
async function afterCompletion(
    context: MarketContext
): Promise<SignalHistoryPruneResult> {
    try {
        context.invalidate();
    } catch (error) {
        console.error(
            '[signal-history] invalidate failed:',
            redactDbErrorForLog(error)
        );
    }
    return pruneAfterCompletion(context.repo, context.now);
}

async function recordMarket(
    market: SignalHistoryMarket,
    context: MarketContext
): Promise<MarketRecordOutcome> {
    try {
        return await recordMarketOrThrow(market, context);
    } catch (error) {
        console.error(
            `[signal-history] ${market} failed:`,
            redactDbErrorForLog(error)
        );
        return { status: 'failed' };
    }
}

async function recordMarketOrThrow(
    market: SignalHistoryMarket,
    context: MarketContext
): Promise<MarketRecordOutcome> {
    const { repo, now, markers } = context;
    const spec = sessionSpecForDashboardScope(market);
    const session = recordableSessionDate(
        spec,
        now,
        SIGNAL_SETTLE_MINUTES[market]
    );
    if (session === null) return { status: 'skipped' };
    const backoffKey = backoffMarkerKey(market, session);
    if (markers !== null && (await markers.has(backoffKey))) {
        return { status: 'skipped' };
    }
    warnIfUniverseStale(market, now);
    const targets = signalScanTargets(market);
    const symbols = targets.map(t => t.symbol);
    const cursors = await repo.loadScanCursors(market, symbols);
    const pending = pendingTargets(targets, cursors, session);
    // 정리할 종목이 없는데 이 세션이 이미 완료로 찍혀 있으면 할 일이 없다(5분마다 도는 나머지 실행).
    // 완료 표식 없이 전부 정리된 상태(표식을 쓰기 전에 앞 실행이 멈춘 경우)면 완료 처리만 한다.
    if (pending.length === 0) {
        const done = await repo.latestCompletedSession(market);
        if (done !== null && done >= session) return { status: 'skipped' };
    }
    const startedAtMs = Date.now();
    const cpuStart = process.cpuUsage();
    const { provider, upstreamCalls } = context.providerFor(market);
    const callsBefore = upstreamCalls();
    const names = await namesFor(pending, context.koreanNames);
    const scanContext = {
        repo,
        provider,
        spec,
        timeline: context.timeline,
        yieldToEventLoop,
        market,
        session,
        now,
    };
    const progress = await runChunks(
        pending,
        0,
        target =>
            scanSymbol(scanContext, {
                symbol: target.symbol,
                koreanName: names.get(target.symbol) ?? null,
                cursor: cursors.get(target.symbol),
            }),
        context.budgetEndMs === undefined
            ? undefined
            : context.budgetEndMs - SIGNAL_SCAN_DEADLINE_MARGIN_MS,
        {
            results: [],
            nullLatest: 0,
            bootstrapped: 0,
            caughtUp: 0,
            stopReason: null,
        }
    );
    if (progress.stopReason === 'outage') {
        console.error(`[signal-history] provider outage suspected: ${market}`);
        // 표식이 안 찍혀도 이 실행은 이미 멈췄다 — 다음 실행이 다시 시도할 뿐이다.
        await markers
            ?.mark(backoffKey, OUTAGE_BACKOFF_TTL_SECONDS)
            .catch((error: unknown) => {
                console.error(
                    '[signal-history] backoff mark failed:',
                    redactDbErrorForLog(error)
                );
            });
    }
    const finalCursors = applyScanAttempts(cursors, session, progress.results);
    const sessionSummary = summarizeSession(
        symbols,
        finalCursors,
        session,
        SIGNAL_SCAN_MAX_ATTEMPTS
    );
    await repo.upsertScanSession({
        market,
        sessionDate: session,
        universeSize: symbols.length,
        recorded: sessionSummary.recorded,
        failed: sessionSummary.failed,
        stale: sessionSummary.stale,
        completedAt: sessionSummary.allSettled
            ? new Date().toISOString()
            : null,
    });
    const summary = summarizeRun({
        market,
        session,
        pending: pending.length,
        progress,
        sessionSummary,
        upstreamCalls: upstreamCalls() - callsBefore,
        startedAtMs,
        cpuStart,
    });
    console.log(`[signal-history] scan run: ${JSON.stringify(summary)}`);
    return {
        status: 'ran',
        summary,
        pruned: sessionSummary.allSettled
            ? await afterCompletion(context)
            : null,
    };
}

async function recordBothMarkets(
    db: SiglensDatabase,
    context: Omit<MarketContext, 'repo'>
): Promise<RecordSignalHistoryResult> {
    const marketContext = {
        ...context,
        repo: new DrizzleSignalHistoryRepository(db),
    };
    const [us, kr] = await Promise.all([
        recordMarket('us', marketContext),
        recordMarket('kr', marketContext),
    ]);
    return { status: 'done', us, kr };
}

/**
 * 장 마감 뒤 시장별로 신호 이력(`signal_events`)을 남긴다 — S&P 500·코스피 200·코스닥 150과 대시보드
 * 스캐너 종목(`signalScanTargets`).
 *
 * `seo-prewarm` 크론(미국 마감 뒤·한국 마감 뒤 창에서 5분 간격)이 배치 **앞**에서 부른다. 한 세션을 한 실행에
 * 다 못 끝내므로 **종목별 진행 표식**(`signal_scan_cursors`)으로 이어 한다:
 * - 기록 시점이 아니면(장중·정착 전·현지 자정 뒤) 아무것도 하지 않는다(`recordableSessionDate`).
 * - 이번 세션에 아직 정리되지 않은 종목만 시도한다. 진행 표식이 하루 전까지 있으면 하루만, 더 뒤처졌으면
 *   놓친 세션을 따라잡고(최대 120세션), 표식이 없으면 최근 120세션을 계산해 채운다(새 종목·정의가 바뀐 신호).
 * - 마지막 봉이 이번 세션이 아니면 기록하지 않고 시도로만 센다(`stale`). 종목마다 세션당 3번까지 시도하고,
 *   그 뒤에는 정리된 것으로 본다. 모든 대상이 정리되면 세션이 완료되고(`signal_scan_sessions.completed_at`)
 *   신호 페이지 캐시를 비운다.
 * - 진행 상태는 전부 DB에 있다. Redis는 장애 백오프 표식만 둔다 — 없어도 다음 실행이 같은 일을 이어 한다.
 *
 * 한 시장의 실패는 다른 시장을 막지 않고 스스로 던지지 않는다. 예산이 끝나기 전에 새 종목 시작을 멈추고
 * (남은 종목은 다음 실행), 예산이 끝나면 기다리지 않는다 — 프리웜 락을 쥔 단계라 뒤 단계(배치·정리·락 해제)를
 * 붙잡지 않게.
 */
export async function recordSignalHistory(
    db: SiglensDatabase,
    {
        now = new Date(),
        budgetEndMs,
        markers = redisMarkers(),
        invalidate = invalidateSignalPages,
        providerFor = getSignalScanMarketDataProvider,
        timeline = confirmedSignalTimeline,
        koreanNames = getKoreanNames,
    }: RecordSignalHistoryOptions = {}
): Promise<RecordSignalHistoryResult> {
    const context = {
        now,
        budgetEndMs,
        markers,
        invalidate,
        providerFor,
        timeline,
        koreanNames,
    };
    if (budgetEndMs === undefined) return recordBothMarkets(db, context);
    const remainingMs = budgetEndMs - Date.now();
    // 예산이 이미 바닥이면 시작하지 않는다 — 시작만 하고 버려지는 작업을 만들지 않는다. 다음 크론
    // 실행(5분 뒤)이 이어 한다.
    if (remainingMs <= 0) return { status: 'timed_out' };
    return withTimeout<RecordSignalHistoryResult>(
        recordBothMarkets(db, context),
        remainingMs,
        { status: 'timed_out' }
    );
}
