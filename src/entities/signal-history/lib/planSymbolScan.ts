import type { SignalDirection, SignalType } from '@y0ngha/siglens-core';
import type {
    LastSeenUpdate,
    OpenEpisode,
    ScanEpisodeInsert,
    SignalHistoryMarket,
    SymbolScanWrite,
} from '../types';

/** 그날 확정된 신호 하나. */
export interface ScanDaySignal {
    readonly type: SignalType;
    readonly direction: SignalDirection;
}

/** 한 종목의 하루 판정 — core `confirmedSignalTimeline`의 한 줄을 세션 날짜로 옮긴 것. */
export interface ScanDay {
    /** 그 봉의 세션 날짜(`YYYY-MM-DD`). */
    readonly sessionDate: string;
    readonly close: number;
    /** 전날 종가 대비 등락률(%). 첫 봉이거나 전날 종가가 0이면 null. */
    readonly changePercent: number | null;
    /**
     * 그날 확정된 신호. `null`은 "판정할 수 없는 날"(창이 너무 짧거나 종가가 유한하지 않음)이라 **신호 없음이
     * 아니다** — 이어지던 에피소드를 끊지 않고 그대로 이어 간다.
     */
    readonly signals: readonly ScanDaySignal[] | null;
}

export interface PlanSymbolScanInput {
    readonly market: SignalHistoryMarket;
    readonly symbol: string;
    readonly koreanName: string | null;
    /** 연속한 세션의 판정, 오래된 순. 비어 있으면 안 된다. */
    readonly days: readonly ScanDay[];
    /** 첫 날 직전 세션까지 이어진 에피소드(`openEpisodesSince`). */
    readonly open: readonly OpenEpisode[];
    /** 처음 기록하는 종목의 재계산 시작 세션(= 첫 날). 있으면 그 세션 이후의 기존 행은 지워지고 다시 계산된다. */
    readonly rebuildFrom: string | null;
    /** `SymbolScanWrite.relabelCutover`로 그대로 넘긴다. */
    readonly relabelCutover: string | null;
    /** 새 행의 계산 시각(ISO). */
    readonly computedAt: string;
}

/** 진행 중이거나 끝난 에피소드 하나. */
interface Episode {
    readonly signalType: string;
    /** 처음 포착된 세션(기본키의 일부). */
    readonly sessionDate: string;
    readonly lastSeenSession: string;
    /** 이번 계획에서 처음 연 에피소드면 그 첫날 값, 이미 DB에 있던 것이면 `null`. */
    readonly started: {
        readonly type: SignalType;
        readonly direction: SignalDirection;
        readonly changePercent: number;
        readonly priceAtDetection: number | null;
    } | null;
    /** 계획 시작 때 DB에 있던 마지막 포착 세션. 새 에피소드면 null. */
    readonly initialLastSeen: string | null;
}

interface PlanState {
    readonly active: ReadonlyMap<string, Episode>;
    readonly closed: readonly Episode[];
}

function fromOpen(open: OpenEpisode): Episode {
    return {
        signalType: open.signalType,
        sessionDate: open.sessionDate,
        lastSeenSession: open.lastSeenSession,
        started: null,
        initialLastSeen: open.lastSeenSession,
    };
}

/** 같은 신호가 둘이면 더 최근에 시작한 에피소드 하나만 이어 간다. */
function indexOpen(open: readonly OpenEpisode[]): ReadonlyMap<string, Episode> {
    return new Map(
        open
            .toSorted((a, b) => (a.sessionDate < b.sessionDate ? -1 : 1))
            .map(row => [row.signalType, fromOpen(row)] as const)
    );
}

function startEpisode(day: ScanDay, signal: ScanDaySignal): Episode {
    return {
        signalType: signal.type,
        sessionDate: day.sessionDate,
        lastSeenSession: day.sessionDate,
        started: {
            type: signal.type,
            direction: signal.direction,
            changePercent: day.changePercent ?? 0,
            priceAtDetection:
                Number.isFinite(day.close) && day.close > 0 ? day.close : null,
        },
        initialLastSeen: null,
    };
}

function advance(state: PlanState, day: ScanDay): PlanState {
    if (day.signals === null) {
        return {
            active: new Map(
                [...state.active].map(
                    ([type, episode]) =>
                        [
                            type,
                            { ...episode, lastSeenSession: day.sessionDate },
                        ] as const
                )
            ),
            closed: state.closed,
        };
    }
    const present = new Map<string, ScanDaySignal>(
        day.signals.map(s => [s.type, s] as const)
    );
    const active = new Map(
        [...present].map(([type, signal]) => {
            const running = state.active.get(type);
            return [
                type,
                running === undefined
                    ? startEpisode(day, signal)
                    : { ...running, lastSeenSession: day.sessionDate },
            ] as const;
        })
    );
    const ended = [...state.active.values()].filter(
        episode => !present.has(episode.signalType)
    );
    return { active, closed: [...state.closed, ...ended] };
}

function toInsert(
    input: PlanSymbolScanInput,
    episode: Episode,
    started: NonNullable<Episode['started']>
): ScanEpisodeInsert {
    return {
        market: input.market,
        sessionDate: episode.sessionDate,
        lastSeenSession: episode.lastSeenSession,
        symbol: input.symbol,
        signalType: started.type,
        direction: started.direction,
        changePercent: started.changePercent,
        priceAtDetection: started.priceAtDetection,
        koreanName: input.koreanName,
        computedAt: input.computedAt,
    };
}

function byEpisodeOrder(
    a: { sessionDate: string; signalType: string },
    b: { sessionDate: string; signalType: string }
): number {
    if (a.sessionDate !== b.sessionDate) {
        return a.sessionDate < b.sessionDate ? -1 : 1;
    }
    return a.signalType < b.signalType ? -1 : 1;
}

/**
 * 한 종목의 `days`를 `open`에서 이어 한 번에 계획한다 — 순수 함수.
 *
 * 하루씩 따로 계획해 이어 붙인 것과 같은 결과여야 한다(재계산 = 라이브). 규칙은 하루마다 같다:
 * - 신호가 있고 이어지는 중이면 마지막 포착 세션만 그날로 늘린다.
 * - 신호가 있고 이어지는 중이 아니면 새 에피소드를 연다(처음 포착된 세션 = 그날).
 * - 이어지던 신호가 그날 없으면 에피소드가 끝난다. 끝난 에피소드도 최종 마지막 포착 세션으로 기록된다.
 * - 판정할 수 없는 날(`signals: null`)은 모두를 그대로 이어 가고 마지막 포착 세션을 그날로 늘린다.
 *   "없음"이 아니라 "모름"이라, 하루의 판정 불가가 에피소드를 끊어 같은 신호를 새로 여는 일을 막는다.
 *
 * `rebuildFrom`이 있으면 그 세션 이후에 시작한 기존 에피소드는 이 계획이 지우고 다시 만들므로 이어 가지
 * 않는다(그 이전에 시작해 이어지는 것만 이어 간다).
 */
export function planSymbolScan(input: PlanSymbolScanInput): SymbolScanWrite {
    const last = input.days.at(-1);
    if (last === undefined) {
        throw new Error('planSymbolScan needs at least one day');
    }
    const continuing = input.open.filter(
        episode =>
            input.rebuildFrom === null ||
            episode.sessionDate < input.rebuildFrom
    );
    const end = input.days.reduce(advance, {
        active: indexOpen(continuing),
        closed: [],
    });
    const episodes = [...end.closed, ...end.active.values()];
    const inserts = episodes
        .flatMap(episode =>
            episode.started === null
                ? []
                : [toInsert(input, episode, episode.started)]
        )
        .toSorted(byEpisodeOrder);
    const lastSeenUpdates: readonly LastSeenUpdate[] = episodes
        .filter(
            episode =>
                episode.started === null &&
                episode.initialLastSeen !== null &&
                episode.lastSeenSession > episode.initialLastSeen
        )
        .map(episode => ({
            signalType: episode.signalType,
            sessionDate: episode.sessionDate,
            lastSeenSession: episode.lastSeenSession,
        }))
        .toSorted(byEpisodeOrder);
    return {
        market: input.market,
        symbol: input.symbol,
        session: last.sessionDate,
        rebuildFrom: input.rebuildFrom,
        relabelCutover: input.relabelCutover,
        lastSeenUpdates,
        inserts,
    };
}
