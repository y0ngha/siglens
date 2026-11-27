import {
    changeReferenceOf,
    findExtremeZoneEntryOn,
    technicalChangesBetween,
    type Bar,
    type ChangeReference,
    type FearGreedReading,
    type SignalType,
    type Tier,
} from '@y0ngha/siglens-core';
import {
    closedAnchorIndexOf,
    lastDailyBarDate,
} from '@/entities/bars/lib/sessionBars';
import { barsUpToDate } from '@/entities/email-report/lib/barsUpToDate';
import { toMailAlertChanges } from '@/entities/mail-alert/lib/mailAlertChanges';
import {
    MAIL_ALERT_CHANGE_SIGNAL_TYPES,
    MAIL_ALERT_SIGNAL_TYPES,
} from '@/entities/mail-alert/lib/mailAlertConstants';
import type {
    MailAlertComputedSymbol,
    MailAlertEpisodeRow,
    MailAlertFearGreedEntry,
} from '@/entities/mail-alert/lib/planMailAlertItems';
import { priceAlertAsOf } from '@/entities/mail-alert/lib/priceAlertExpiry';
import {
    hasLevels,
    referenceScaleHolds,
} from '@/entities/mail-alert/lib/referenceScale';
import type {
    MailAlertChange,
    MailAlertFearGreedMarket,
} from '@/entities/mail-alert/model';
import type { SignalHistoryRepository } from '@/entities/signal-history/api';
import { SIGNAL_SETTLE_MINUTES } from '@/entities/signal-history/lib/signalEventRows';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import { sessionSpecForDashboardScope } from '@/shared/api/market/sessionSpecFor';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { mapChunked } from '@/shared/lib/mapChunked';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';

/** 담은 모든 종목의 일봉을 동시에 받는 수(CC-1). 일봉은 대개 종목 페이지가 채운 캐시 적중이다. */
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
        // 가격대 알림의 만료 판정도 같은 값을 쓴다(`priceAlertAsOf`) — 한 정의.
        signals: priceAlertAsOf(now),
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
    /**
     * 종목별 가장 최근의 **개인화되지 않은** 일봉 기술적 분석(`notBefore` 이후)을 읽는다. 없으면 가격대·진입 구간
     * 줄은 만들지 않고 추세·신호 줄만 나간다. 던지면 호출자가 그 줄들 없이 진행한다.
     */
    readonly loadChangeReferences?: (
        symbols: readonly string[],
        notBefore: Date
    ) => Promise<ReadonlyMap<string, StoredChangeReference>>;
}

/** 저장된 분석 한 건: 만든 시각과 `analysis_history.result` 그대로의 본문(모양은 코어가 읽는다). */
export interface StoredChangeReference {
    readonly generatedAt: Date;
    readonly result: unknown;
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

/** 한 종목이 읽은 달라진 점. 추세는 모두에게, 가격대·진입 구간은 그 깊이를 보는 등급에게만 있다. */
export interface SymbolReading {
    /** 분석 없이 두 종가만으로 읽은 줄(추세). */
    readonly trend: readonly MailAlertChange[];
    /** 등급별로 그 등급이 보는 분석의 가격 판정·가격대·진입 구간 줄. 줄이 없는 등급은 키가 없다. */
    readonly byTier: ReadonlyMap<Tier, readonly MailAlertChange[]>;
}

export interface ComputedSources {
    readonly computed: ReadonlyMap<string, MailAlertComputedSymbol>;
    /** 종목별 달라진 점. 신선한 봉이 없는 종목은 키가 없다. */
    readonly readings: ReadonlyMap<string, SymbolReading>;
    /** 일봉으로 판정을 시도한 종목 수(스캐너 대상 포함). */
    readonly computedSymbols: number;
    /** 마지막 일봉이 기대 세션이 아니어서 판정하지 않은 종목 수. */
    readonly noFreshBar: number;
    /** 일봉을 못 읽었거나 판정이 던진 종목 수. */
    readonly computeErrors: number;
    /** 판정하지 못한 종목(낡은 봉 또는 오류). 준비 게이트가 이 종목을 담은 구독자를 첫 슬롯에서 미룬다. */
    readonly notReadySymbols: ReadonlySet<string>;
    /** `computeErrors` 중 일봉을 못 읽은 종목 수(판정이 던진 것은 세지 않는다). */
    readonly barLoadErrors: number;
    /** 가격대·진입 구간 줄을 읽는 데 쓴 (종목, 등급) 분석 수. */
    readonly referencesUsed: number;
}

/** 분석을 읽을 등급과 종목별 저장된 분석. 비어 있으면 추세·신호만 읽는다. */
export interface ChangeReferenceInput {
    readonly rows: ReadonlyMap<string, StoredChangeReference>;
    /** 가격대를 볼 수 있는 등급들(받는 사람이 있는 등급만). */
    readonly tiers: readonly Tier[];
}

type ComputeOutcome =
    | {
          readonly kind: 'ok';
          readonly value: MailAlertComputedSymbol;
          readonly reading: SymbolReading;
          readonly referencesUsed: number;
      }
    | { readonly kind: 'stale' }
    | { readonly kind: 'load_error' }
    | { readonly kind: 'error' };

/** 분석 시점에 마감돼 있던 봉(`closedAnchorIndexOf`)의 종가에 견줘 분석의 가격 척도가 맞는지. */
function scaleHoldsAt(
    reference: ChangeReference,
    bars: readonly Bar[],
    market: SignalHistoryMarket
): boolean {
    const index = closedAnchorIndexOf(
        bars,
        sessionSpecForDashboardScope(market),
        reference.analyzedAt
    );
    return referenceScaleHolds(
        reference,
        index === null ? undefined : bars[index]?.close
    );
}

/**
 * 일봉 한 종목이 어제 종가에서 오늘 종가 사이에 달라진 점. 마지막 봉의 날짜가 기대 세션일 때만 판정한다 — 코어
 * 함수는 받은 봉의 마지막 봉을 그대로 판정하므로, 낡은 봉으로 부르면 지난 세션의 변화를 오늘 새로 생긴 것처럼
 * 낸다. 기대 세션보다 뒤의 봉(장중 봉 등)은 먼저 잘라 낸다.
 *
 * 신호는 허브 유형에서 MACD 교차를 뺀 여섯 개만 읽고(`MAIL_ALERT_CHANGE_SIGNAL_TYPES`), 담은 종목은 스캐너 대상이어도
 * 이 결과가 신호의 정본이다(별도 `detectNewConfirmedSignals` 호출이 없다 — 같은 규칙을 한 번만 계산한다).
 */
function computeOne(
    bars: readonly Bar[],
    market: SignalHistoryMarket,
    sessionDate: string,
    references: {
        readonly row: StoredChangeReference | undefined;
        readonly tiers: readonly Tier[];
    }
): ComputeOutcome {
    const { bars: upTo } = barsUpToDate(bars, sessionDate);
    if (lastDailyBarDate(upTo) !== sessionDate) return { kind: 'stale' };
    const last = upTo.at(-1);
    const previous = upTo.at(-2);
    const base = technicalChangesBetween(upTo, {
        fromIndex: upTo.length - 2,
        signalTypes: MAIL_ALERT_CHANGE_SIGNAL_TYPES,
    });
    const signalTypes: SignalType[] = base.ok
        ? base.changes.flatMap(change =>
              change.kind === 'signal_started' ? [change.type] : []
          )
        : [];
    const row = references.row;
    const byTier = new Map(
        row === undefined
            ? []
            : references.tiers.flatMap(
                  (tier): [Tier, readonly MailAlertChange[]][] => {
                      const reference = changeReferenceOf(
                          row.result,
                          { tier },
                          { analyzedAt: row.generatedAt.toISOString() }
                      );
                      if (
                          reference === null ||
                          !hasLevels(reference) ||
                          !scaleHoldsAt(reference, upTo, market)
                      ) {
                          return [];
                      }
                      const result = technicalChangesBetween(upTo, {
                          fromIndex: upTo.length - 2,
                          reference,
                      });
                      const lines = result.ok
                          ? toMailAlertChanges(
                                result.changes,
                                reference
                            ).filter(change => change.kind !== 'trend')
                          : [];
                      return [[tier, lines]];
                  }
              )
    );
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
        reading: {
            trend: base.ok ? toMailAlertChanges(base.changes, null) : [],
            byTier,
        },
        referencesUsed: byTier.size,
    };
}

/**
 * 담은 종목들의 달라진 점(추세, 새 신호, 그리고 분석이 있으면 가격대·진입 구간)을 일봉으로 읽는다(스캐너 대상
 * 종목도 같다 — 담은 종목의 신호는 신호 기록이 아니라 그 종목의 봉이 정한다). 종목마다 따로 잡아 한 종목의 실패가
 * 나머지를 막지 않고, 동시에 받는 일봉은 `COMPUTE_CONCURRENCY`개다.
 */
export async function loadComputedSources(
    deps: AlertSourceDeps,
    targets: ReadonlyArray<{
        readonly symbol: string;
        readonly market: SignalHistoryMarket;
        readonly sessionDate: string;
    }>,
    references: ChangeReferenceInput = { rows: new Map(), tiers: [] }
): Promise<ComputedSources> {
    const outcomes = await mapChunked(
        targets,
        COMPUTE_CONCURRENCY,
        async ({ symbol, market, sessionDate }) => {
            const bars = await Promise.resolve()
                .then(() => deps.loadDailyBars(symbol))
                .then(
                    loaded => ({ ok: true as const, loaded }),
                    (error: unknown) => {
                        console.error(
                            `[mail-alert] bars load failed for ${symbol}`,
                            redactDbErrorForLog(error)
                        );
                        return { ok: false as const };
                    }
                );
            if (!bars.ok) {
                return { symbol, outcome: { kind: 'load_error' } as const };
            }
            try {
                return {
                    symbol,
                    outcome: computeOne(bars.loaded, market, sessionDate, {
                        row: references.rows.get(symbol),
                        tiers: references.tiers,
                    }),
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
    const ok = outcomes.flatMap(({ symbol, outcome }) =>
        outcome.kind === 'ok' ? [{ symbol, outcome }] : []
    );
    return {
        computed: new Map(
            ok.map(({ symbol, outcome }): [string, MailAlertComputedSymbol] => [
                symbol,
                outcome.value,
            ])
        ),
        readings: new Map(
            ok.map(({ symbol, outcome }): [string, SymbolReading] => [
                symbol,
                outcome.reading,
            ])
        ),
        computedSymbols: targets.length,
        noFreshBar: outcomes.filter(({ outcome }) => outcome.kind === 'stale')
            .length,
        computeErrors: outcomes.filter(
            ({ outcome }) =>
                outcome.kind === 'error' || outcome.kind === 'load_error'
        ).length,
        notReadySymbols: new Set(
            outcomes
                .filter(({ outcome }) => outcome.kind !== 'ok')
                .map(({ symbol }) => symbol)
        ),
        barLoadErrors: outcomes.filter(
            ({ outcome }) => outcome.kind === 'load_error'
        ).length,
        referencesUsed: ok.reduce(
            (sum, { outcome }) => sum + outcome.referencesUsed,
            0
        ),
    };
}
