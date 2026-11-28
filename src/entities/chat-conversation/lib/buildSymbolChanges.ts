import {
    alertablePlanLevels,
    technicalChangesBetween,
    type Bar,
    type ChangeReference,
    type MarketSessionSpec,
    TREND_EMA_PERIOD,
    type TechnicalChange,
    type Trend,
} from '@y0ngha/siglens-core';
import { closedAnchorIndexOf } from '@/entities/bars/lib/sessionBars';
import {
    hasLevels,
    scaleGuardedReference,
} from '@/entities/mail-alert/lib/referenceScale';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { MS_PER_SECOND } from '@/shared/config/time';
import type {
    ChatChangeItem,
    ChatChangeTrend,
    ChatSymbolChangesResult,
} from '../types';
import {
    CHAT_CHANGE_SIGNAL_TYPES,
    isChatChangeSignalType,
} from './chatChangeSignalTypes';

/** 일봉은 세션 날짜의 UTC 자정에 찍힌다 — 봉 자신의 UTC 날짜가 거래일이다. */
export function tradingDate(timeSec: number): string {
    return new Date(timeSec * MS_PER_SECOND).toISOString().slice(0, 10);
}

function toChatTrend(trend: Trend): ChatChangeTrend {
    return trend;
}

function toItems(
    changes: readonly TechnicalChange[],
    reference: ChangeReference,
    latestTime: number
): ChatChangeItem[] {
    const plan =
        reference.plan === null ? null : alertablePlanLevels(reference.plan);
    return changes.flatMap((change): ChatChangeItem[] => {
        // 추세 변화는 마지막 종가에서 읽은 값이라 자기 시각이 없다.
        const date = tradingDate(
            change.kind === 'trend_changed' ? latestTime : change.time
        );
        switch (change.kind) {
            case 'trend_changed':
                return [
                    {
                        kind: 'trend',
                        from: toChatTrend(change.from),
                        to: toChatTrend(change.to),
                        date,
                    },
                ];
            case 'signal_started':
                return isChatChangeSignalType(change.type)
                    ? [{ kind: 'signal', type: change.type, date }]
                    : [];
            case 'level_crossed':
                return [
                    {
                        kind: 'level',
                        side: change.side,
                        direction: change.direction,
                        price: change.price,
                        close: change.close,
                        date,
                    },
                ];
            case 'plan_level_crossed':
                // 위로 건넌 경우(분석 시점에 이미 기준 이하였다)는 "돌아왔다"가 아니라서 줄로 만들지 않는다.
                // 무효화 기준 아래로 마감했다가 지금은 돌아온 경우만 줄로 만든다. 지금도 아래면 계획 위치 변화
                // (`plan_stopped`)가 이미 말하고, 진입 구간 경계의 돌파는 위치 줄(구간 안·위·아래)이 갈음한다.
                return change.level === 'stop' &&
                    change.direction === 'down' &&
                    !change.pastNow
                    ? [
                          {
                              kind: 'plan_stop_recovered',
                              stop: change.price,
                              date,
                              close: change.close,
                          },
                      ]
                    : [];
            case 'plan_position_changed': {
                if (change.to === 'no_setup') {
                    return change.reason === 'stopped' &&
                        plan?.invalidation != null
                        ? [
                              {
                                  kind: 'plan_stopped',
                                  stop: plan.invalidation,
                                  date,
                              },
                          ]
                        : [{ kind: 'plan_no_setup', date }];
                }
                // 구간 숫자를 못 읽으면 숫자 없는 문장으로 둘러대지 않고 "성립하지 않음"으로 내린다.
                return plan?.entryZone == null
                    ? [{ kind: 'plan_no_setup', date }]
                    : [
                          {
                              kind: 'plan',
                              position: change.to,
                              zoneLow: plan.entryZone.low,
                              zoneHigh: plan.entryZone.high,
                              date,
                          },
                      ];
            }
        }
    });
}

export interface BuildSymbolChangesInput {
    symbol: string;
    marketProfile: MarketProfileId;
    /** 비교 기준 분석의 생성 시각(ISO). */
    analyzedAt: string;
    reference: ChangeReference;
    /** 그 종목 시장의 세션 — 분석 시각에 어느 일봉까지 마감돼 있었는지 가린다. */
    session: MarketSessionSpec;
    /** 완결된 일봉, 오래된 순 — 형성 중인 오늘 봉은 호출 쪽이 뗀다. */
    bars: readonly Bar[];
}

/**
 * 한 종목의 "분석 이후 달라진 점" — core가 두 일봉 종가 사이를 읽은 결과를 카드 한 장의 값으로 옮긴다.
 * 판정은 전부 core(`technicalChangesBetween`)가 한다. 여기서는 날짜와 가격을 채우고, 읽지 못한 부분
 * (`trendMeasured`·`unevaluatedSignalDays`·`skippedCloses`)을 그대로 넘겨 "달라진 게 없다"로 뭉개지 않게 한다.
 *
 * 분석 시각이 받은 봉보다 앞서거나(`closedAnchorIndexOf` → null) 기준이 너무 멀면 `too_old`, 기준이 마지막 봉이면
 * `same_session`, 그 밖에 읽을 수 없으면 `null`(카드에서 뺀다).
 */
export function buildSymbolChanges(
    input: BuildSymbolChangesInput
): ChatSymbolChangesResult | null {
    const { symbol, marketProfile, analyzedAt, bars, session } = input;
    const fromIndex = closedAnchorIndexOf(bars, session, analyzedAt);
    const anchorBar = fromIndex === null ? undefined : bars[fromIndex];
    const base = {
        symbol,
        marketProfile,
        analyzedAt,
        analyzedDate:
            anchorBar === undefined
                ? analyzedAt.slice(0, 10)
                : tradingDate(anchorBar.time),
    };
    if (fromIndex === null)
        return bars.length === 0 ? null : { ...base, status: 'too_old' };
    const reference = scaleGuardedReference(input.reference, anchorBar?.close);
    const result = technicalChangesBetween(bars, {
        fromIndex,
        reference,
        signalTypes: CHAT_CHANGE_SIGNAL_TYPES,
    });
    if (!result.ok) {
        if (result.reason === 'too_old') return { ...base, status: 'too_old' };
        if (result.reason === 'same_session')
            return { ...base, status: 'same_session' };
        return null;
    }
    return {
        ...base,
        status: 'changes',
        latestDate: tradingDate(result.toTime),
        closeThen: result.closeFrom,
        closeNow: result.closeTo,
        items: toItems(result.changes, reference, result.toTime),
        hasLevels: hasLevels(reference),
        trendMeasured: result.trendMeasured,
        trendEmaPeriod: TREND_EMA_PERIOD,
        unreadDays: Math.max(
            result.unevaluatedSignalDays,
            result.skippedCloses
        ),
    };
}
