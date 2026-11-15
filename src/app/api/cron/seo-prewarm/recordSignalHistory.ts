import {
    getSectorSignals,
    type SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { DrizzleSignalHistoryRepository } from '@/entities/signal-history/api';
import {
    continuationFloor,
    planSignalEpisodes,
    recordableSessionDate,
} from '@/entities/signal-history/lib/signalEventRows';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import { sectorSignalsProviderFor } from '@/entities/sector-signal/api/sectorSignalsProvider';
import { sessionSpecForDashboardScope } from '@/shared/api/market/sessionSpecFor';
import { getRedisClient } from '@/shared/cache/redisClient';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import { dashboardScopeOf } from '@/shared/config/dashboardScope';
import type { SiglensDatabase } from '@/shared/db/types';
import { addUtcIsoDays, toUtcIsoDate } from '@/shared/lib/isoDate';
import { withTimeout } from '@/shared/lib/withTimeout';

/**
 * 마감 뒤 이만큼 지나야 기록한다(분). 미국은 마지막 봉이 확정될 여유 15분. 한국은 시세가 20분
 * 늦게 오므로(`marketProfile` 실측 KRX 20분) 그만큼 더 기다린다 — 그 전에 계산하면 동시호가
 * 마감가가 빠진 봉으로 신호를 판정한다.
 */
export const SIGNAL_SETTLE_MINUTES: Readonly<
    Record<SignalHistoryMarket, number>
> = { us: 15, kr: 35 };

/**
 * 신호 이력 보존 기간(일, 마지막 포착 세션 기준). 신호별 페이지는 최근 몇 주만 보여 주지만, 신호가
 * 드문 날이 이어질 때 목록을 채우고 나중에 신호별 빈도를 볼 수 있게 넉넉히 둔다. 행이 작고
 * 하루 수백 행 안이라 1년치도 수십만 행에 그친다.
 */
export const SIGNAL_HISTORY_RETENTION_DAYS = 400;

/** "이 시장·세션은 기록했다" 표식. 다음 세션 기록 전에 사라지면 되고, 주말·연휴를 넉넉히 덮는다. */
const RECORDED_MARKER_TTL_SECONDS = 4 * 24 * 60 * 60;

/**
 * "이 시장·세션을 방금 시도했다" 표식(초). 스캔이 비었거나(프로바이더 장애일 수 있다) 실패하면
 * 기록 표식을 남기지 않아 다시 시도하지만, 크론이 5분마다 도는 창(미국 약 4시간) 내내 전 종목을
 * 다시 계산하지 않게 시도 간격을 30분으로 묶는다 — 창 안에서 많아야 여덟 번쯤이다.
 */
const ATTEMPT_MARKER_TTL_SECONDS = 30 * 60;

function recordedMarkerKey(
    market: SignalHistoryMarket,
    sessionDate: string
): string {
    return `signal-history:recorded:v1:${market}:${sessionDate}`;
}

function attemptMarkerKey(
    market: SignalHistoryMarket,
    sessionDate: string
): string {
    return `signal-history:attempt:v1:${market}:${sessionDate}`;
}

/** 시장 하나의 결과. `skipped`는 지금이 기록 시점이 아니거나 이 세션을 이미 남겼다는 뜻이다. */
export type MarketRecordOutcome =
    | { readonly status: 'skipped' }
    | {
          readonly status: 'recorded';
          readonly sessionDate: string;
          readonly inserted: number;
          readonly extended: number;
      }
    | { readonly status: 'failed' };

export type RecordSignalHistoryResult =
    | {
          readonly status: 'done';
          readonly us: MarketRecordOutcome;
          readonly kr: MarketRecordOutcome;
          /** 보존 기간이 지나 지운 행 수. 이번에 아무 시장도 기록하지 않았거나 정리가 실패하면 `null`. */
          readonly pruned: number | null;
      }
    /** 예산 안에 끝나지 않았다(멈춘 Redis·DB·프로바이더). 이미 시작한 작업은 뒤에서 마저 돈다. */
    | { readonly status: 'timed_out' };

/** 스캐너를 **캐시 없이** 계산한다. 테스트가 갈아 끼운다. */
export type ScanMarket = (
    market: SignalHistoryMarket,
    now: Date
) => Promise<SectorSignalsResult>;

/** 기록 표식 저장소. Redis가 없으면 `null`(그때는 DB의 멱등성만으로 버틴다). */
export interface RecordedMarkerStore {
    has(key: string): Promise<boolean>;
    mark(key: string, ttlSeconds: number): Promise<void>;
}

export interface RecordSignalHistoryOptions {
    readonly now?: Date;
    /** 이 시각(epoch ms)까지 끝나지 않으면 기다리지 않고 `timed_out`. 이미 지났으면 시작하지 않는다. */
    readonly budgetEndMs?: number;
    readonly scan?: ScanMarket;
    readonly markers?: RecordedMarkerStore | null;
}

/**
 * 기본 스캐너 — `/market`이 읽는 캐시(`getSectorSignalsStatic`)를 거치지 않고 직접 계산한다.
 * 캐시된 결과는 마감 직후(정착 전)에 채워져 다음 개장까지 남을 수 있어, 그 값을 읽으면 그날 밤
 * 실행이 전부 "정착 전 결과"로 건너뛴다. 봉은 세션을 아는 봉 캐시 프로바이더에서 오므로 대부분
 * 캐시 적중이고, 세션당 한 번(표식)만 돈다.
 */
const scanUncached: ScanMarket = (market, now) =>
    getSectorSignals(
        sectorSignalsProviderFor(market, DEFAULT_DASHBOARD_TIMEFRAME),
        [...dashboardScopeOf(market).sectorStocks],
        DEFAULT_DASHBOARD_TIMEFRAME,
        now,
        { cache: null }
    );

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

interface MarketContext {
    readonly repo: DrizzleSignalHistoryRepository;
    readonly now: Date;
    readonly scan: ScanMarket;
    readonly markers: RecordedMarkerStore | null;
}

async function recordMarket(
    market: SignalHistoryMarket,
    { repo, now, scan, markers }: MarketContext
): Promise<MarketRecordOutcome> {
    try {
        const spec = sessionSpecForDashboardScope(market);
        const sessionDate = recordableSessionDate(
            spec,
            now,
            SIGNAL_SETTLE_MINUTES[market]
        );
        if (sessionDate === null) return { status: 'skipped' };
        const markerKey = recordedMarkerKey(market, sessionDate);
        const attemptKey = attemptMarkerKey(market, sessionDate);
        if (markers !== null) {
            const [recorded, attempted] = await Promise.all([
                markers.has(markerKey),
                markers.has(attemptKey),
            ]);
            if (recorded || attempted) return { status: 'skipped' };
            // 스캔 전에 찍는다 — 스캔이 멈추거나 던져도 다음 시도는 30분 뒤다.
            await markers.mark(attemptKey, ATTEMPT_MARKER_TTL_SECONDS);
        }
        const result = await scan(market, now);
        // 빈 결과는 "신호 없음"이 아니라 장애로 본다(약 100종목 중 확정 신호가 하나도 없는 날은
        // 사실상 없다). 기록 표식을 남기지 않아 시도 간격(30분) 뒤 다시 계산한다.
        if (result.stocks.length === 0) return { status: 'skipped' };
        const sinceSession = continuationFloor(spec, sessionDate);
        const openKeys = await repo.openEpisodeKeys(
            market,
            result.stocks.map(stock => stock.symbol),
            sinceSession
        );
        const plan = planSignalEpisodes({
            result,
            market,
            sessionDate,
            openKeys,
        });
        const [inserted, extended] = await Promise.all([
            repo.insertEpisodes(plan.inserts),
            repo.extendEpisodes(
                market,
                plan.extends,
                sessionDate,
                sinceSession
            ),
        ]);
        await markers?.mark(markerKey, RECORDED_MARKER_TTL_SECONDS);
        return { status: 'recorded', sessionDate, inserted, extended };
    } catch (error) {
        console.error(`[seo-prewarm] signal history ${market} failed:`, error);
        return { status: 'failed' };
    }
}

async function recordAndPrune(
    db: SiglensDatabase,
    context: Omit<MarketContext, 'repo'>
): Promise<RecordSignalHistoryResult> {
    const repo = new DrizzleSignalHistoryRepository(db);
    const marketContext = { ...context, repo };
    const [us, kr] = await Promise.all([
        recordMarket('us', marketContext),
        recordMarket('kr', marketContext),
    ]);
    // 정리는 실제로 기록한 실행에서만 한다 — 시장마다 세션당 한 번이라 하루 두어 번이면 충분하고,
    // 5분마다 도는 크론의 나머지 실행에서 DELETE를 되풀이하지 않는다.
    const recordedAny = us.status === 'recorded' || kr.status === 'recorded';
    if (!recordedAny) return { status: 'done', us, kr, pruned: null };
    try {
        const cutoff = addUtcIsoDays(
            toUtcIsoDate(context.now),
            -SIGNAL_HISTORY_RETENTION_DAYS
        );
        return {
            status: 'done',
            us,
            kr,
            pruned: await repo.pruneOlderThan(cutoff),
        };
    } catch (error) {
        console.error('[seo-prewarm] signal history prune failed:', error);
        return { status: 'done', us, kr, pruned: null };
    }
}

/**
 * 장 마감 뒤 시장별로 세션당 한 번 신호 이력(`signal_events`)을 남긴다.
 *
 * `seo-prewarm` 크론(미국 마감 뒤·한국 마감 뒤 창에서 5분 간격)이 배치 **앞**에서 부른다. 매번 불려도
 * 안전하다:
 * - 기록 시점이 아니면(장중·정착 전·현지 자정 뒤) 아무것도 하지 않는다(`recordableSessionDate`).
 * - 그 세션을 이미 남겼으면 Redis 표식으로 건너뛴다. 표식이 없어도(Redis 없음·만료) DB가 멱등이다 —
 *   새 에피소드는 PK로, 이어짐 갱신은 같은 날 재적용이 no-op이다.
 *
 * 한 시장의 실패는 다른 시장을 막지 않고 스스로 던지지 않는다. 예산이 끝나면 기다리지 않는다 —
 * 프리웜 락을 쥔 단계라 뒤 단계(배치·정리·락 해제)를 붙잡지 않게.
 */
export async function recordSignalHistory(
    db: SiglensDatabase,
    {
        now = new Date(),
        budgetEndMs,
        scan = scanUncached,
        markers = redisMarkers(),
    }: RecordSignalHistoryOptions = {}
): Promise<RecordSignalHistoryResult> {
    const context = { now, scan, markers };
    if (budgetEndMs === undefined) return recordAndPrune(db, context);
    const remainingMs = budgetEndMs - Date.now();
    // 예산이 이미 바닥이면 시작하지 않는다 — 시작만 하고 버려지는 작업을 만들지 않는다. 다음 크론
    // 실행(5분 뒤)이 같은 세션을 남긴다.
    if (remainingMs <= 0) return { status: 'timed_out' };
    return withTimeout<RecordSignalHistoryResult>(
        recordAndPrune(db, context),
        remainingMs,
        { status: 'timed_out' }
    );
}
