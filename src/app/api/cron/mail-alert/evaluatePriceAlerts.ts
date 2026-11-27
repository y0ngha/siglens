import { findPriceLevelTrigger, type Bar } from '@y0ngha/siglens-core';
import { lastDailyBarDate } from '@/entities/bars/lib/sessionBars';
import { barsUpToDate } from '@/entities/email-report/lib/barsUpToDate';
import { PRICE_ALERT_SCALE_GUARD } from '@/entities/mail-alert/lib/priceAlertConstants';
import type {
    MailAlertPriceAlertItem,
    MailAlertVoidedPriceAlertItem,
} from '@/entities/mail-alert/model';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import type { PriceAlertRecord } from '@/shared/db/types';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { mapChunked } from '@/shared/lib/mapChunked';
import {
    COMPUTE_CONCURRENCY,
    type ExpectedSessions,
} from './collectAlertSources';

const MS_PER_SECOND = 1000;

/** 일봉의 세션 날짜 — 신호 판정(`lastDailyBarDate`)과 같이 봉 시각의 UTC 날짜다. */
function sessionOfTime(time: number): string {
    return toUtcIsoDate(new Date(time * MS_PER_SECOND));
}

/**
 * 이번 실행이 이 알림의 판정 구간을 끝까지 읽었는지. 구간의 끝은 `min(기대 세션, 만료일)`이고, 받은 일봉의
 * 그 날짜까지의 마지막 봉이 그 날짜여야 한다 — 봉 캐시가 덜 찬 아침에는 기대 세션의 봉이 아직 없다.
 */
function hasWindowEnd(
    alert: PriceAlertRecord,
    bars: readonly Bar[],
    expectedSession: string
): boolean {
    const limit =
        alert.expiresOn < expectedSession ? alert.expiresOn : expectedSession;
    const last = lastDailyBarDate(barsUpToDate(bars, limit).bars);
    return last !== null && last >= limit;
}

function isUsableClose(bar: Bar): boolean {
    return Number.isFinite(bar.close) && bar.close > 0;
}

type AlertOutcome =
    | { readonly kind: 'none' }
    /** 처음 판정하는 종가가 알림을 만들 때 가격과 척도가 다르다(분할·재상장). */
    | { readonly kind: 'void' }
    | { readonly kind: 'fire'; readonly item: MailAlertPriceAlertItem };

function toItem(
    alert: PriceAlertRecord,
    trigger: { readonly time: number; readonly close: number },
    zonePosition: MailAlertPriceAlertItem['zonePosition']
): MailAlertPriceAlertItem {
    return {
        kind: 'price_alert',
        alertId: alert.id,
        symbol: alert.symbol,
        market: alert.market,
        condition: alert.condition,
        basis: alert.basis,
        analysisAt: alert.analysisAt,
        referenceClose: alert.referenceClose,
        createdAt: alert.createdAt,
        firedSession: sessionOfTime(trigger.time),
        firedClose: trigger.close,
        zonePosition,
    };
}

/**
 * 분할·재상장으로 가격 척도가 달라졌는지. 알림이 만들어진 기준 세션(`startsAfterSession`)의 종가를 지금 읽은
 * 일봉에서 찾아 만들 때의 가격(`referenceClose`)과 견준다: 봉은 분할이 소급 반영되지만 저장된 가격대는 그렇지
 * 않아, 분할이 있었다면 같은 날의 종가가 비율만큼 옮겨져 있다. 분할 뒤의 실제 급등락은 이미 지난 그 종가를
 * 바꾸지 않으므로 걸리지 않는다(처음 판정하는 종가를 견주면 큰 갭과 분할을 가를 수 없다). 기준 세션의 봉이
 * 없으면 판단할 근거가 없어 지우지 않는다.
 */
function hasScaleChanged(
    alert: PriceAlertRecord,
    bars: readonly Bar[]
): boolean {
    const reference = bars.find(
        bar =>
            sessionOfTime(bar.time) === alert.startsAfterSession &&
            isUsableClose(bar)
    );
    if (reference === undefined) return false;
    const ratio = reference.close / alert.referenceClose;
    return (
        ratio < PRICE_ALERT_SCALE_GUARD.min ||
        ratio > PRICE_ALERT_SCALE_GUARD.max
    );
}

/**
 * 알림 하나를 일봉으로 판정한다. 상태를 들고 있지 않다 — 판정 구간은 알림이 만든 세션(`startsAfterSession`)
 * 다음 세션부터 `min(기대 세션, 만료일)`까지이고, 그 안에서 조건을 처음 충족한 종가를 찾는다. 알림 날짜가
 * 미뤄지거나(첫 슬롯 연기) 선점이 막혀 한 번 놓쳤어도 다음 실행이 같은 종가를 같은 세션 날짜로 다시 찾으므로,
 * 놓침은 발송을 늦출 뿐 잃거나 두 번 내지 않는다(두 번은 선점과 함께 `fired`로 바뀌는 상태가 막는다).
 */
function evaluateAlert(
    alert: PriceAlertRecord,
    bars: readonly Bar[],
    expectedSession: string
): AlertOutcome {
    const limit =
        alert.expiresOn < expectedSession ? alert.expiresOn : expectedSession;
    const window = barsUpToDate(bars, limit).bars.filter(
        bar => sessionOfTime(bar.time) > alert.startsAfterSession
    );
    if (hasScaleChanged(alert, bars)) return { kind: 'void' };
    const { condition } = alert;
    if (condition.kind === 'enter_zone') {
        const trigger = findPriceLevelTrigger(window, condition);
        return trigger === null
            ? { kind: 'none' }
            : {
                  kind: 'fire',
                  item: toItem(alert, trigger, trigger.position),
              };
    }
    const trigger = findPriceLevelTrigger(window, condition);
    return trigger === null
        ? { kind: 'none' }
        : { kind: 'fire', item: toItem(alert, trigger, null) };
}

export interface PriceAlertEvaluationDeps {
    readonly loadDailyBars: (symbol: string) => Promise<readonly Bar[]>;
}

export interface PriceAlertEvaluation {
    /** 구독자 id → 이번 알림 날짜에 충족한 알림(만든 순). */
    readonly fires: ReadonlyMap<string, readonly MailAlertPriceAlertItem[]>;
    /** 판정 대상이었던 진행 중 알림 수. */
    readonly active: number;
    /**
     * 구독자 id → 척도 가드로 끝내야 하는 알림. 여기서 지우지 않는다 — 메일이 그 사실을 알리고, 지우기는 보낸 뒤
     * `deliveries.finish`가 메일이 나가지 않았다고 확정되지 않은 경우에만 한다(선점에 지거나 메일이 확정적으로
     * 나가지 않으면 알림이 남아 다음 실행이 다시 알린다).
     */
    readonly voids: ReadonlyMap<
        string,
        readonly MailAlertVoidedPriceAlertItem[]
    >;
    /** 일봉을 못 읽은 종목 수(그 종목의 알림은 이번에 판정하지 않고 다음 실행이 다시 본다). */
    readonly barErrors: number;
    /**
     * 구독자 id → 판정 구간을 끝까지 읽지 못한 알림의 종목(일봉 조회 실패, 기대 세션의 봉이 아직 없음). 발송기의
     * 준비 게이트가 담은 종목과 같이 다룬다 — 첫 슬롯에서는 그 구독자를 미룬다. 그 날의 종가로 울릴 알림이 빠진
     * 메일을 먼저 보내면 알림은 다음 날 메일로 하루 늦게 간다.
     */
    readonly notReady: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * 진행 중인 모든 가격대 알림을 판정한다. 종목마다 일봉을 한 번만 읽고(동시 `COMPUTE_CONCURRENCY`개, CC-1),
 * 한 종목의 실패가 나머지를 막지 않는다. 알림을 `fired`로 바꾸거나 지우는 것은 여기서 하지 않는다 — `fired`는 메일
 * 선점과 같은 트랜잭션이어야 해서 발송기가 `deliveries.claim`에 넘기고, 끝낸 알림(`v:`)은 보낸 뒤
 * `deliveries.finish`가 메일이 나가지 않았다고 확정되지 않은 경우에만 지운다.
 */
export async function evaluatePriceAlerts(
    deps: PriceAlertEvaluationDeps,
    alertsBySubscriber: ReadonlyMap<string, readonly PriceAlertRecord[]>,
    expected: ExpectedSessions
): Promise<PriceAlertEvaluation> {
    const alerts = [...alertsBySubscriber.values()].flat();
    const symbols = [...new Set(alerts.map(alert => alert.symbol))];
    const loaded = await mapChunked(
        symbols,
        COMPUTE_CONCURRENCY,
        async (symbol): Promise<[string, readonly Bar[] | null]> => {
            try {
                return [symbol, await deps.loadDailyBars(symbol)];
            } catch (error) {
                console.error(
                    `[mail-alert] price alert bars failed for ${symbol}`,
                    redactDbErrorForLog(error)
                );
                return [symbol, null];
            }
        }
    );
    const barsOf = new Map(loaded);
    const fires = new Map<string, MailAlertPriceAlertItem[]>();
    const voids = new Map<string, MailAlertVoidedPriceAlertItem[]>();
    const notReady = new Map<string, Set<string>>();
    alerts.forEach(alert => {
        const bars = barsOf.get(alert.symbol) ?? null;
        if (
            bars === null ||
            !hasWindowEnd(alert, bars, expected.signals[alert.market])
        ) {
            notReady.set(
                alert.subscriberId,
                (notReady.get(alert.subscriberId) ?? new Set<string>()).add(
                    alert.symbol
                )
            );
        }
        if (bars === null) return;
        const outcome = evaluateAlert(
            alert,
            bars,
            expected.signals[alert.market]
        );
        if (outcome.kind === 'void') {
            voids.set(alert.subscriberId, [
                ...(voids.get(alert.subscriberId) ?? []),
                {
                    kind: 'price_alert_voided',
                    alertId: alert.id,
                    symbol: alert.symbol,
                },
            ]);
        }
        if (outcome.kind === 'fire') {
            fires.set(alert.subscriberId, [
                ...(fires.get(alert.subscriberId) ?? []),
                outcome.item,
            ]);
        }
    });
    return {
        fires,
        voids,
        active: alerts.length,
        barErrors: loaded.filter(([, bars]) => bars === null).length,
        notReady,
    };
}
