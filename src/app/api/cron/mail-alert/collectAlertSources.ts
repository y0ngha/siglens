import {
    detectNewConfirmedSignals,
    findExtremeZoneEntryOn,
    type Bar,
    type FearGreedReading,
    type SignalType,
} from '@y0ngha/siglens-core';
import { lastDailyBarDate } from '@/entities/bars/lib/sessionBars';
import { barsUpToDate } from '@/entities/email-report/lib/barsUpToDate';
import { MAIL_ALERT_SIGNAL_TYPES } from '@/entities/mail-alert/lib/mailAlertConstants';
import type {
    MailAlertComputedSymbol,
    MailAlertEpisodeRow,
    MailAlertFearGreedEntry,
} from '@/entities/mail-alert/lib/planMailAlertItems';
import type { MailAlertFearGreedMarket } from '@/entities/mail-alert/model';
import { SIGNAL_SETTLE_MINUTES } from '@/entities/signal-history/lib/signalEventRows';
import type { SignalHistoryRepository } from '@/entities/signal-history/api';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import { sessionSpecForDashboardScope } from '@/shared/api/market/sessionSpecFor';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import { mapChunked } from '@/shared/lib/mapChunked';

/** 스캐너 범위 밖 종목의 일봉을 동시에 받는 수(CC-1). 일봉은 대개 종목 페이지가 채운 캐시 적중이다. */
export const COMPUTE_CONCURRENCY = 5;

/** 시장별로 "이 알림 날짜가 다뤄야 할" 마지막 마감 세션 날짜. */
export interface ExpectedSessions {
    /** 신호 기록기(`signal_events`)가 남겨야 하는 세션. 기록기와 같은 정착 시간을 쓴다. */
    readonly signals: Readonly<Record<SignalHistoryMarket, string>>;
    /** 공포·탐욕 허브 판독이 끝에 가져야 하는 세션. */
    readonly fearGreed: Readonly<Record<MailAlertFearGreedMarket, string>>;
}

/**
 * 지금 시각 기준 기대 세션.
 *
 * 신호는 기록기가 정하는 방식 그대로(마감 + 정착 시간)로 구한다. 미국 공포·탐욕은 다르다: 판독이 EOD 발행
 * 버퍼(마감 + 4시간) 뒤의 세션을 키로 삼아, 기록기가 끝난 아침 7시에는 아직 직전 세션까지만 있다. 같은
 * 정착 시간으로 기대하면 그 판독은 영원히 "준비 안 됨"이므로 판독 자신의 정의(`lastClosedSessionDate`
 * 기본 버퍼)를 따른다 — 그 결과 미국 극단 구간 진입 알림은 신호보다 하루 늦게 나간다. 한국은 마감 + 정착
 * 시간, 크립토는 어제(UTC)다(24시간 시장은 `lastClosedSessionDate`가 버퍼를 보지 않는다).
 */
export function expectedSessions(now: Date): ExpectedSessions {
    const us = sessionSpecForDashboardScope('us');
    const kr = sessionSpecForDashboardScope('kr');
    return {
        signals: {
            us: lastClosedSessionDate(us, now, SIGNAL_SETTLE_MINUTES.us),
            kr: lastClosedSessionDate(kr, now, SIGNAL_SETTLE_MINUTES.kr),
        },
        fearGreed: {
            us: lastClosedSessionDate(us, now),
            kr: lastClosedSessionDate(kr, now, SIGNAL_SETTLE_MINUTES.kr),
            crypto: lastClosedSessionDate(
                sessionSpecForDashboardScope('crypto'),
                now
            ),
        },
    };
}

export interface AlertSourceDeps {
    readonly signalHistory: Pick<
        SignalHistoryRepository,
        'latestRecordedSession' | 'findEpisodesStartedOn'
    >;
    /** 시장 공포·탐욕 허브 판독의 일별 기록. 판독을 못 읽으면 던진다. */
    readonly loadFearGreedHistory: (
        market: MailAlertFearGreedMarket
    ) => Promise<readonly FearGreedReading[]>;
    readonly loadDailyBars: (symbol: string) => Promise<readonly Bar[]>;
}

/** 신호 기록의 준비 여부. 기록기가 기대 세션까지 남겼을 때만 그 시장의 `signal_events`를 믿는다. */
export async function checkSignalReadiness(
    deps: AlertSourceDeps,
    expected: ExpectedSessions
): Promise<Record<SignalHistoryMarket, boolean>> {
    const [us, kr] = await Promise.all([
        deps.signalHistory.latestRecordedSession('us'),
        deps.signalHistory.latestRecordedSession('kr'),
    ]);
    return {
        us: us !== null && us >= expected.signals.us,
        kr: kr !== null && kr >= expected.signals.kr,
    };
}

/** 준비된 시장의 새 에피소드. 알림 유형이 아닌 행은 걸러 낸다. */
export async function loadEpisodes(
    deps: AlertSourceDeps,
    market: SignalHistoryMarket,
    sessionDate: string
): Promise<MailAlertEpisodeRow[]> {
    const rows = await deps.signalHistory.findEpisodesStartedOn(
        market,
        sessionDate,
        MAIL_ALERT_SIGNAL_TYPES
    );
    return rows.flatMap(row => {
        const signalType = MAIL_ALERT_SIGNAL_TYPES.find(
            type => type === row.signalType
        );
        return signalType === undefined
            ? []
            : [
                  {
                      symbol: row.symbol,
                      signalType,
                      changePercent: row.changePercent,
                      name: row.koreanName,
                  },
              ];
    });
}

export interface FearGreedSources {
    readonly entries: ReadonlyMap<
        MailAlertFearGreedMarket,
        MailAlertFearGreedEntry
    >;
    /** 판독을 못 읽었거나 기대 세션까지 오지 않은 시장(`fg:<market>`). */
    readonly notReady: readonly string[];
}

/**
 * 구독자가 있는 시장의 공포·탐욕 판독을 읽어 기대 세션의 극단 구간 진입을 판정한다. 판정은 코어의
 * `findExtremeZoneEntryOn`(기본 옵션) 그대로다.
 */
export async function loadFearGreedSources(
    deps: AlertSourceDeps,
    markets: readonly MailAlertFearGreedMarket[],
    expected: ExpectedSessions
): Promise<FearGreedSources> {
    const results = await Promise.all(
        markets.map(async market => {
            try {
                const history = await deps.loadFearGreedHistory(market);
                const date = expected.fearGreed[market];
                const lastDate = history.at(-1)?.date ?? null;
                if (lastDate === null || lastDate < date) {
                    return { market, ready: false, entry: null };
                }
                const entry = findExtremeZoneEntryOn(history, date);
                return {
                    market,
                    ready: true,
                    entry:
                        entry === null
                            ? null
                            : {
                                  zone: entry.zone,
                                  date: entry.date,
                                  score: entry.score,
                              },
                };
            } catch (error) {
                console.error(
                    `[mail-alert] fear-greed read failed for ${market}`,
                    redactDbErrorForLog(error)
                );
                return { market, ready: false, entry: null };
            }
        })
    );
    return {
        entries: new Map(
            results.flatMap(
                (
                    result
                ): [MailAlertFearGreedMarket, MailAlertFearGreedEntry][] =>
                    result.entry === null ? [] : [[result.market, result.entry]]
            )
        ),
        notReady: results
            .filter(result => !result.ready)
            .map(result => `fg:${result.market}`),
    };
}

export interface ComputedSources {
    readonly computed: ReadonlyMap<string, MailAlertComputedSymbol>;
    /** 일봉으로 판정을 시도한 종목 수. */
    readonly computedSymbols: number;
    /** 마지막 일봉이 기대 세션이 아니어서 판정하지 않은 종목 수. */
    readonly noFreshBar: number;
    /** 일봉을 못 읽었거나 판정이 던진 종목 수. */
    readonly computeErrors: number;
    /** 판정하지 못한 종목(낡은 봉 또는 오류). 준비 게이트가 이 종목을 담은 구독자를 첫 슬롯에서 미룬다. */
    readonly notReadySymbols: ReadonlySet<string>;
}

type ComputeOutcome =
    | { readonly kind: 'ok'; readonly value: MailAlertComputedSymbol }
    | { readonly kind: 'stale' }
    | { readonly kind: 'error' };

/**
 * 일봉 한 종목의 새 확정 신호. 마지막 봉의 날짜가 기대 세션일 때만 판정한다 — 코어 함수는 받은 봉의 마지막
 * 봉을 그대로 판정하므로, 낡은 봉으로 부르면 지난 세션의 신호를 오늘 새로 켜진 것처럼 낸다. 기대 세션보다
 * 뒤의 봉(장중 봉 등)은 먼저 잘라 낸다.
 */
function computeOne(bars: readonly Bar[], sessionDate: string): ComputeOutcome {
    const { bars: upTo } = barsUpToDate(bars, sessionDate);
    if (lastDailyBarDate(upTo) !== sessionDate) return { kind: 'stale' };
    const last = upTo.at(-1);
    const previous = upTo.at(-2);
    const signalTypes: SignalType[] = detectNewConfirmedSignals(upTo)
        .map(signal => signal.type)
        .filter(type => MAIL_ALERT_SIGNAL_TYPES.includes(type));
    return {
        kind: 'ok',
        value: {
            sessionDate,
            changePercent:
                last !== undefined &&
                previous !== undefined &&
                previous.close > 0
                    ? ((last.close - previous.close) / previous.close) * 100
                    : null,
            signalTypes,
        },
    };
}

/**
 * 담은 종목들의 새 신호를 일봉으로 판정한다(스캐너 대상 종목도 같다). 종목마다 따로 잡아 한 종목의 실패가
 * 나머지를 막지 않고, 동시에 받는 일봉은 `COMPUTE_CONCURRENCY`개다.
 */
export async function loadComputedSources(
    deps: AlertSourceDeps,
    targets: ReadonlyArray<{
        readonly symbol: string;
        readonly sessionDate: string;
    }>
): Promise<ComputedSources> {
    const outcomes = await mapChunked(
        targets,
        COMPUTE_CONCURRENCY,
        async ({ symbol, sessionDate }) => {
            try {
                return {
                    symbol,
                    outcome: computeOne(
                        await deps.loadDailyBars(symbol),
                        sessionDate
                    ),
                };
            } catch (error) {
                console.error(
                    `[mail-alert] compute failed for ${symbol}`,
                    redactDbErrorForLog(error)
                );
                return { symbol, outcome: { kind: 'error' } as const };
            }
        }
    );
    return {
        computed: new Map(
            outcomes.flatMap(
                ({ symbol, outcome }): [string, MailAlertComputedSymbol][] =>
                    outcome.kind === 'ok' ? [[symbol, outcome.value]] : []
            )
        ),
        computedSymbols: targets.length,
        noFreshBar: outcomes.filter(({ outcome }) => outcome.kind === 'stale')
            .length,
        computeErrors: outcomes.filter(
            ({ outcome }) => outcome.kind === 'error'
        ).length,
        notReadySymbols: new Set(
            outcomes
                .filter(({ outcome }) => outcome.kind !== 'ok')
                .map(({ symbol }) => symbol)
        ),
    };
}
