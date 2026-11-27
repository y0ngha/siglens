import 'server-only';
import {
    alertablePlanLevels,
    changeReferenceOf,
    technicalChangesBetween,
    type Bar,
    type ChangeReference,
    type ConfirmedSignalType,
    type MarketSessionSpec,
    type NoSetupReason,
    type PlanPosition,
    type SignalDirection,
    type TechnicalChange,
    type Tier,
    type Trend,
} from '@y0ngha/siglens-core';
import { closedAnchorIndexOf } from '@/entities/bars/lib/sessionBars';
import { tradingDate } from '@/entities/chat-conversation/lib/buildSymbolChanges';
import { CHAT_CHANGE_SIGNAL_TYPES } from '@/entities/chat-conversation/lib/chatChangeSignalTypes';
import { loadClosedDailyBars } from '@/entities/chat-conversation/server/closedDailyBars';
import type { ConversationAnalysis } from '@/entities/chat-conversation/server/conversationAnalyses';
import {
    hasLevels,
    scaleGuardedReference,
} from '@/entities/mail-alert/lib/referenceScale';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { logToolDegrade } from '@/shared/lib/logToolDegrade';
import { withTimeout } from '@/shared/lib/withTimeout';

/**
 * 도구 결과 하나에 싣는 **가격대 돌파** 항목 상한. 가격대는 종목마다 8~12개라 한 번에 많이 넘을 수 있어 자른다.
 * 추세(최대 1)·계획 위치(최대 1)는 개수가 작아 자르지 않는다. 신호는 허브 8종이지만 한 종류가 기간 안에 여러 번
 * 시작할 수 있어(항목 수 ≠ 종류 수) 종류마다 가장 나중 시작 하나만 싣는다 — 최대 8개, 나머지는 `omittedSignals`.
 */
export const SINCE_EARLIER_MAX_LEVEL_CROSSINGS = 6;

/** 이전 분석과의 비교를 계산하는 시간 상한(ms). 넘기면 블록만 빠지고 도구 결과는 그대로 나간다. */
export const SINCE_EARLIER_TIMEOUT_MS = 3_000;

/** 모델에게 보이는 규칙 문장. 도구 설명은 core 소유라 바꾸지 않고 결과가 규칙을 실어 나른다. */
export const SINCE_EARLIER_NOTE =
    'Computed: what changed between the analysis shown earlier in this conversation and now. ' +
    'State these facts and numbers as given; do not infer others. ' +
    'It compares daily closes from fromSessionDate to toSessionDate, not the live price. ' +
    'trend_changed and plan_position_changed are read at those two closes only; level_crossed and signal_started carry their own dates. ' +
    `Signals cover only ${CHAT_CHANGE_SIGNAL_TYPES.join(', ')}. ` +
    'level_crossed is the first close past the level; compare closeNow for where price is now. ' +
    'Each signal type is listed once, at its newest start; omittedSignals counts earlier starts that are not listed. ' +
    'omittedLevelCrossings counts further level crossings that are not listed. ' +
    'An empty changes list means "no change in these items" only when notMeasured is absent; ' +
    'support/resistance and plan position are compared only when comparedLevels is true.';

export type SinceEarlierChange =
    | { kind: 'trend_changed'; from: Trend; to: Trend }
    | {
          kind: 'signal_started';
          type: ConfirmedSignalType;
          direction: SignalDirection;
          date: string;
      }
    | {
          kind: 'level_crossed';
          side: 'support' | 'resistance';
          price: number;
          direction: 'down' | 'up';
          close: number;
          date: string;
      }
    | {
          kind: 'plan_position_changed';
          from: PlanPosition;
          to: PlanPosition;
          reason?: NoSetupReason;
          close: number;
          entryZone?: { low: number; high: number };
          invalidation?: number;
      };

/** 읽지 못해 "달라진 점 없음"이라고 말할 수 없는 부분. */
export type SinceEarlierGap = 'trend' | 'new_signals' | 'level_crossings';

/** 도구 결과의 `sinceEarlier` 블록 — 전부 코드가 계산한 값이고, 모델은 문장으로만 옮긴다. */
export interface SinceEarlier {
    /** 대화에 먼저 보인 분석의 생성 시각(ISO). */
    earlierGeneratedAt: string;
    /** 비교의 시작: 그 분석 시각에 이미 마감돼 있던 마지막 거래일(YYYY-MM-DD). */
    fromSessionDate: string;
    /** 비교의 끝: 받은 마지막 완결 일봉의 거래일(YYYY-MM-DD). */
    toSessionDate: string;
    closeThen: number;
    closeNow: number;
    changes: SinceEarlierChange[];
    /** 상한({@link SINCE_EARLIER_MAX_LEVEL_CROSSINGS})에 걸려 싣지 못한 가격대 돌파 수. 없으면 생략. */
    omittedLevelCrossings?: number;
    /** 같은 종류의 더 이른 시작이라 싣지 않은 신호 수(종류마다 가장 나중 시작만 싣는다). 없으면 생략. */
    omittedSignals?: number;
    /** 읽지 못한 부분. 비어 있으면 생략. */
    notMeasured?: SinceEarlierGap[];
    /** 가격대·계획 비교에 쓸 기준이 있었는지(등급 깊이가 가리거나 가격 기준이 달라 뺀 경우 `false`). */
    comparedLevels: boolean;
    note: string;
}

function toChange(
    change: TechnicalChange,
    reference: ChangeReference
): SinceEarlierChange {
    switch (change.kind) {
        case 'trend_changed':
            // 추세는 두 끝 종가에서만 읽은 값이라 자기 시각이 없다 — 중간에 뒤집혔다 돌아와도 보이지 않는다.
            return { kind: 'trend_changed', from: change.from, to: change.to };
        case 'signal_started':
            return {
                kind: 'signal_started',
                type: change.type,
                direction: change.direction,
                date: tradingDate(change.time),
            };
        case 'level_crossed':
            return {
                kind: 'level_crossed',
                side: change.side,
                price: change.price,
                direction: change.direction,
                close: change.close,
                date: tradingDate(change.time),
            };
        case 'plan_position_changed': {
            const levels =
                reference.plan === null
                    ? null
                    : alertablePlanLevels(reference.plan);
            return {
                kind: 'plan_position_changed',
                from: change.from,
                to: change.to,
                ...(change.reason !== undefined
                    ? { reason: change.reason }
                    : {}),
                close: change.close,
                ...(levels?.entryZone ? { entryZone: levels.entryZone } : {}),
                ...(levels?.invalidation != null
                    ? { invalidation: levels.invalidation }
                    : {}),
            };
        }
    }
}

type SignalStarted = Extract<TechnicalChange, { kind: 'signal_started' }>;

export interface BuildSinceEarlierInput {
    /** 대화에 먼저 보인 분석의 생성 시각(ISO). */
    earlierGeneratedAt: string;
    /** 등급 깊이가 이미 적용된 비교 기준. */
    reference: ChangeReference;
    /** 그 종목 시장의 세션. */
    session: MarketSessionSpec;
    /** 완결된 일봉, 오래된 순 — 형성 중인 오늘 봉은 호출 쪽이 뗀다. */
    bars: readonly Bar[];
}

/**
 * 이전 분석 이후 달라진 점을 모델에게 줄 블록으로 옮긴다. 판정은 전부 core(`technicalChangesBetween`)가 한다.
 * 비교할 수 없을 때만(기준이 봉보다 앞섬·너무 오래됨·같은 세션·읽을 수 없음) `undefined`다 — 이때 블록이 없는
 * 결과는 이 기능이 없던 때와 같다. 비교는 됐는데 바뀐 게 없으면 빈 `changes`의 블록을 돌려준다(그 "변화 없음"이
 * 사실이라는 근거는 `notMeasured`가 없다는 것이다).
 *
 * 읽지 못한 부분(`trendMeasured`·`unevaluatedSignalDays`·`skippedCloses`)은 `notMeasured`로 넘겨 빈 `changes`가
 * "달라진 점 없음"으로 읽히지 않게 한다. 상한은 가격대 돌파
 * ({@link SINCE_EARLIER_MAX_LEVEL_CROSSINGS})와 신호(종류마다 최신 하나)에 건다.
 */
export function buildSinceEarlier({
    earlierGeneratedAt,
    reference,
    session,
    bars,
}: BuildSinceEarlierInput): SinceEarlier | undefined {
    const fromIndex = closedAnchorIndexOf(bars, session, earlierGeneratedAt);
    if (fromIndex === null) return undefined;
    const guarded = scaleGuardedReference(reference, bars[fromIndex]?.close);
    const result = technicalChangesBetween(bars, {
        fromIndex,
        reference: guarded,
        signalTypes: CHAT_CHANGE_SIGNAL_TYPES,
    });
    if (!result.ok) return undefined;
    const notMeasured: SinceEarlierGap[] = [
        ...(result.trendMeasured ? [] : (['trend'] as const)),
        ...(result.unevaluatedSignalDays > 0 ? (['new_signals'] as const) : []),
        ...(result.skippedCloses > 0 ? (['level_crossings'] as const) : []),
    ];
    const signalStarts = result.changes.filter(
        (change): change is SignalStarted => change.kind === 'signal_started'
    );
    // 종류마다 가장 나중에 시작한 신호 하나만 싣는다 — 한 종류가 기간 안에 여러 번 시작해도 최대 8개다. 시각 순으로
    // 세운 뒤 `new Map`의 "같은 키는 마지막 항목"으로 고른다(같은 시각이면 core 순서상 뒤의 것).
    const newestSignal = new Map<ConfirmedSignalType, SignalStarted>(
        signalStarts
            .toSorted((a, b) => a.time - b.time)
            .map(change => [change.type, change])
    );
    const crossings = result.changes.filter(
        change => change.kind === 'level_crossed'
    );
    const keptCrossings = new Set<TechnicalChange>(
        crossings.slice(0, SINCE_EARLIER_MAX_LEVEL_CROSSINGS)
    );
    const changes = result.changes.flatMap((change): SinceEarlierChange[] => {
        if (change.kind === 'signal_started')
            return newestSignal.get(change.type) === change
                ? [toChange(change, guarded)]
                : [];
        if (change.kind === 'level_crossed')
            return keptCrossings.has(change) ? [toChange(change, guarded)] : [];
        return [toChange(change, guarded)];
    });
    const omitted = crossings.length - keptCrossings.size;
    const omittedSignals = signalStarts.length - newestSignal.size;
    return {
        earlierGeneratedAt,
        fromSessionDate: tradingDate(result.fromTime),
        toSessionDate: tradingDate(result.toTime),
        closeThen: result.closeFrom,
        closeNow: result.closeTo,
        changes,
        ...(omitted > 0 ? { omittedLevelCrossings: omitted } : {}),
        ...(omittedSignals > 0 ? { omittedSignals } : {}),
        ...(notMeasured.length > 0 ? { notMeasured } : {}),
        comparedLevels: hasLevels(guarded),
        note: SINCE_EARLIER_NOTE,
    };
}

export interface LoadSinceEarlierInput {
    /** 이 호출이 도구 런타임에서 받은, 이 대화의 이전 분석들. */
    earlierAnalyses: readonly ConversationAnalysis[] | undefined;
    symbol: string;
    timeframe: string;
    tier: Tier;
    /** 이 결과의 분석 생성 시각(ISO). */
    resultGeneratedAt: string | null | undefined;
    fmpSymbol: string | undefined;
    /** 호출한 도구가 이미 정한 종목의 시장 — 봉과 세션을 고른다. */
    marketProfile: MarketProfileId;
}

async function compute(
    earlier: ConversationAnalysis,
    tier: Tier,
    symbol: string,
    fmpSymbol: string | undefined,
    marketProfile: MarketProfileId
): Promise<SinceEarlier | undefined> {
    // 등급 깊이는 core가 정한다 — 보이지 않는 가격대·계획은 비어서 온다. 저장된 결과는 그때 호출자 등급으로
    // 이미 걸러져 있어, 그 사이 등급이 내려가도 지금 등급보다 깊게 새지 않는다.
    const reference = changeReferenceOf(
        earlier.analysis,
        { tier },
        { analyzedAt: earlier.generatedAt }
    );
    if (reference === null) return undefined;
    const { bars, session } = await loadClosedDailyBars(
        symbol,
        marketProfile,
        fmpSymbol
    );
    return buildSinceEarlier({
        earlierGeneratedAt: earlier.generatedAt,
        reference,
        session,
        bars,
    });
}

/**
 * 같은 대화의 이전 턴에 본 같은 종목의 일봉 기술적 분석이 있고 그것이 이 결과의 분석보다 오래됐으면,
 * 그 이후 달라진 점을 계산한다. 8턴 창이 오래된 도구 결과를 `omitted`로 보내므로 모델은 이전 분석의
 * 숫자를 더 볼 수 없다 — 이 블록이 그 자리를 채운다.
 *
 * 절대 던지지 않는다: 실패·시간 초과는 블록만 빼고 도구 결과를 그대로 낸다.
 */
export async function loadSinceEarlier({
    earlierAnalyses,
    symbol,
    timeframe,
    tier,
    resultGeneratedAt,
    fmpSymbol,
    marketProfile,
}: LoadSinceEarlierInput): Promise<SinceEarlier | undefined> {
    if (timeframe !== '1Day' || earlierAnalyses === undefined) return undefined;
    const earlier = earlierAnalyses.find(a => a.symbol === symbol);
    if (earlier === undefined || typeof resultGeneratedAt !== 'string')
        return undefined;
    const earlierMs = Date.parse(earlier.generatedAt);
    const resultMs = Date.parse(resultGeneratedAt);
    // 같은 분석을 다시 받았거나 더 오래된 것이면 "달라진 점"이 없다.
    if (!(earlierMs < resultMs)) return undefined;
    try {
        return await withTimeout(
            compute(earlier, tier, symbol, fmpSymbol, marketProfile),
            SINCE_EARLIER_TIMEOUT_MS,
            undefined
        );
    } catch (error) {
        logToolDegrade('analysis', 'sinceEarlier comparison', error);
        return undefined;
    }
}
