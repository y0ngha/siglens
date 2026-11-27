import type {
    ConfirmedSignalDay,
    confirmedSignalTimeline,
    MarketDataProvider,
    MarketSessionSpec,
} from '@y0ngha/siglens-core';
import { SIGNAL_SCAN_DAILY_LOOKBACK_DAYS } from '@y0ngha/siglens-core';
import type { SignalScanProgressRepository } from '@/entities/signal-history/api';
import {
    planSymbolScan,
    type ScanDay,
} from '@/entities/signal-history/lib/planSymbolScan';
import {
    type ScanMode,
    scanDayCount,
    scanModeFor,
} from '@/entities/signal-history/lib/scanMode';
import { continuationFloor } from '@/entities/signal-history/lib/signalEventRows';
import {
    SIGNAL_HISTORY_BOOTSTRAP_SESSIONS,
    SIGNAL_SCAN_RELABEL_CUTOVER,
    SIGNAL_SCAN_TIMELINE_CHUNK_DAYS,
} from '@/entities/signal-history/lib/signalScanConstants';
import type {
    ScanCursor,
    SignalHistoryMarket,
} from '@/entities/signal-history/types';
import { isoDateDaysAgo } from '@/shared/api/market/barsWindow';
import { MS_PER_DAY, MS_PER_SECOND } from '@/shared/config/time';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/** core `confirmedSignalTimeline`의 모양 — 테스트가 갈아 끼운다. */
export type ConfirmedSignalTimeline = typeof confirmedSignalTimeline;

export interface ScanSymbolContext {
    readonly repo: Pick<
        SignalScanProgressRepository,
        'openEpisodesSince' | 'applySymbolScan' | 'recordScanFailure'
    >;
    readonly provider: MarketDataProvider;
    readonly spec: MarketSessionSpec;
    readonly timeline: ConfirmedSignalTimeline;
    /** 판정 구간 사이에 이벤트 루프에 양보한다. */
    readonly yieldToEventLoop: () => Promise<void>;
    readonly market: SignalHistoryMarket;
    /** 이번에 기록할 세션 날짜. */
    readonly session: string;
    readonly now: Date;
}

export interface ScanSymbolTarget {
    readonly symbol: string;
    readonly koreanName: string | null;
    readonly cursor: ScanCursor | undefined;
}

export type SymbolScanOutcome =
    | {
          readonly outcome: 'recorded';
          readonly mode: ScanMode;
          /** 마지막(이번 세션) 날의 판정이 불가(`signals: null`)였다 — 이어지던 에피소드를 그대로 이어 갔다. */
          readonly latestUnknown: boolean;
      }
    | {
          readonly outcome: 'failed' | 'stale';
          /**
           * 시도 기록(`recordScanFailure`)이 DB에 실제로 써졌는가. 못 썼으면 DB의 시도 횟수는 그대로라서
           * 세션 완료 판정에 이 시도를 넣으면 안 된다(다음 실행이 같은 종목을 다시 시도한다).
           */
          readonly persisted: boolean;
      };

/** 일봉 `from`에 더하는 여유(일) — 휴장·시차로 창이 모자라지 않게. */
const BARS_FROM_MARGIN_DAYS = 10;
/** 거래일 → 달력일 환산(주 5거래일 / 7일). */
const CALENDAR_DAYS_PER_SESSION = 7 / 5;

/**
 * 모드별로 필요한 최대 판정 일수 — 봉을 받기 **전**의 추정이라 `from`을 정하는 데만 쓴다. 따라잡기는
 * 마지막 기록 이후 달력일 수가 거래일 수의 상한이다.
 */
function estimatedDays(
    mode: ScanMode,
    cursor: ScanCursor | undefined,
    session: string
): number {
    if (mode === 'normal') return 1;
    const lastSession = cursor?.lastSession ?? null;
    if (mode === 'bootstrap' || lastSession === null) {
        return SIGNAL_HISTORY_BOOTSTRAP_SESSIONS;
    }
    const gapDays = Math.ceil(
        (Date.parse(session) - Date.parse(lastSession)) / MS_PER_DAY
    );
    return Math.min(SIGNAL_HISTORY_BOOTSTRAP_SESSIONS, Math.max(1, gapDays));
}

/**
 * 판정 창(`SIGNAL_SCAN_DAILY_LOOKBACK_DAYS`) + 판정 일수 + 여유만큼 거슬러 받는다. 가장 오래된 판정일도
 * 스캐너와 같은 400일 창을 온전히 갖게 하려는 것이다.
 */
function barsFrom(now: Date, days: number): string {
    return isoDateDaysAgo(
        now,
        SIGNAL_SCAN_DAILY_LOOKBACK_DAYS +
            Math.ceil(days * CALENDAR_DAYS_PER_SESSION) +
            BARS_FROM_MARGIN_DAYS
    );
}

/** 일봉 `Bar.time`은 그 세션 날짜의 UTC 자정이다(FMP·yahoo 어댑터 공통 규약). */
function barSessionDate(time: number): string {
    return toUtcIsoDate(new Date(time * MS_PER_SECOND));
}

function toScanDay(day: ConfirmedSignalDay): ScanDay {
    return {
        sessionDate: barSessionDate(day.time),
        close: day.close,
        changePercent: day.changePercent,
        signals:
            day.signals === null
                ? null
                : day.signals.map(({ type, direction }) => ({
                      type,
                      direction,
                  })),
    };
}

/**
 * `bars[startIndex..]`의 판정을 `SIGNAL_SCAN_TIMELINE_CHUNK_DAYS`일씩 끊어 구한다. 구간마다 그 구간 끝까지의
 * 봉만 넘겨(`slice(0, end)`) 미래 봉을 보지 않고, 구간 사이에 양보해 한 종목이 이벤트 루프를 길게 잡지 않게 한다.
 */
async function timelineInChunks(
    ctx: ScanSymbolContext,
    bars: Parameters<ConfirmedSignalTimeline>[0],
    startIndex: number
): Promise<readonly ConfirmedSignalDay[]> {
    const chunkEnd = Math.min(
        startIndex + SIGNAL_SCAN_TIMELINE_CHUNK_DAYS,
        bars.length
    );
    const chunk = ctx.timeline(bars.slice(0, chunkEnd), {
        days: chunkEnd - startIndex,
    });
    if (chunkEnd >= bars.length) return chunk;
    await ctx.yieldToEventLoop();
    return [...chunk, ...(await timelineInChunks(ctx, bars, chunkEnd))];
}

/** 시도를 DB에 센다. 써졌으면 `true`, 삼킨 오류면 `false`. */
async function recordFailure(
    ctx: ScanSymbolContext,
    symbol: string,
    outcome: 'failed' | 'stale'
): Promise<boolean> {
    try {
        await ctx.repo.recordScanFailure(
            ctx.market,
            symbol,
            ctx.session,
            outcome
        );
        return true;
    } catch (error) {
        // 진행 표식이 안 써져도 이 실행은 계속한다 — 다음 실행이 같은 종목을 다시 시도한다.
        console.error(
            `[signal-history] attempt record failed: ${ctx.market} ${symbol}`,
            redactDbErrorForLog(error)
        );
        return false;
    }
}

async function scanOrThrow(
    ctx: ScanSymbolContext,
    target: ScanSymbolTarget
): Promise<SymbolScanOutcome> {
    const { symbol, cursor } = target;
    const mode = scanModeFor(cursor, ctx.spec, ctx.session);
    const bars = await ctx.provider.getBars({
        symbol,
        timeframe: '1Day',
        from: barsFrom(ctx.now, estimatedDays(mode, cursor, ctx.session)),
    });
    const lastBar = bars.at(-1);
    // 마지막 봉이 이번 세션이 아니면(시세 조회 실패로 오늘 봉이 빠졌거나, 거래 정지) 어제 신호를 오늘 것으로
    // 남기지 않는다.
    if (lastBar === undefined || barSessionDate(lastBar.time) !== ctx.session) {
        return {
            outcome: 'stale',
            persisted: await recordFailure(ctx, symbol, 'stale'),
        };
    }
    const count = scanDayCount(
        mode,
        bars.map(bar => barSessionDate(bar.time)),
        cursor?.lastSession ?? null
    );
    const days = (await timelineInChunks(ctx, bars, bars.length - count)).map(
        toScanDay
    );
    const firstDay = days[0];
    if (firstDay === undefined) {
        throw new Error(`no days to scan: ${symbol}`);
    }
    const rebuild = mode === 'bootstrap';
    const open = await ctx.repo.openEpisodesSince(
        ctx.market,
        symbol,
        continuationFloor(ctx.spec, firstDay.sessionDate),
        // 같은 상수를 `SymbolScanWrite.relabelCutover`에도 넘긴다 — 아래 계획.
        rebuild ? { relabelCutover: SIGNAL_SCAN_RELABEL_CUTOVER } : undefined
    );
    await ctx.repo.applySymbolScan(
        planSymbolScan({
            market: ctx.market,
            symbol,
            koreanName: target.koreanName,
            days,
            open,
            rebuildFrom: rebuild ? firstDay.sessionDate : null,
            relabelCutover: rebuild ? SIGNAL_SCAN_RELABEL_CUTOVER : null,
            computedAt: ctx.now.toISOString(),
        })
    );
    return {
        outcome: 'recorded',
        mode,
        latestUnknown: days.at(-1)?.signals === null,
    };
}

/**
 * 종목 하나를 기록한다 — 던지지 않는다. 봉 조회·DB 오류는 `failed`, 마지막 봉이 이번 세션이 아니면 `stale`로
 * 시도를 세고(`recordScanFailure`) 진행 표식은 그대로 둔다. 성공하면 쓰기 묶음 하나가 한 트랜잭션으로
 * 행과 진행 표식을 함께 바꾼다(`applySymbolScan`).
 */
export async function scanSymbol(
    ctx: ScanSymbolContext,
    target: ScanSymbolTarget
): Promise<SymbolScanOutcome> {
    try {
        return await scanOrThrow(ctx, target);
    } catch (error) {
        console.error(
            `[signal-history] symbol scan failed: ${ctx.market} ${target.symbol}`,
            redactDbErrorForLog(error)
        );
        return {
            outcome: 'failed',
            persisted: await recordFailure(ctx, target.symbol, 'failed'),
        };
    }
}
