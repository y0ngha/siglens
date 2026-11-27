import type { ExtremeFearGreedZone, SignalType } from '@y0ngha/siglens-core';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import type {
    MailAlertFearGreedItem,
    MailAlertFearGreedMarket,
    MailAlertSignalItem,
    MailAlertTopic,
} from '../model';
import {
    MAIL_ALERT_MAX_HUB_ROWS,
    MAIL_ALERT_MAX_SIGNAL_ITEMS,
} from './mailAlertConstants';
import { suppressionKey } from './topics';

const MARKETS: readonly SignalHistoryMarket[] = ['us', 'kr'];

/** 기록기(`signal_events`)가 그 세션에 새로 연 에피소드 한 줄. */
export interface MailAlertEpisodeRow {
    readonly symbol: string;
    readonly signalType: SignalType;
    readonly changePercent: number | null;
    /** 한국어 종목명. 없으면 `null`. */
    readonly name: string | null;
}

/**
 * 담은 종목 하나를 일봉으로 직접 판정한 결과. `signalTypes`는 이미 알림 유형만 남긴 것이다. 스캐너 대상
 * 종목도 신호 기록(`signal_events`)이 아니라 이 판정을 쓴다 — 담은 종목의 신호는 그 종목의 봉이 정한다.
 */
export interface MailAlertComputedSymbol {
    readonly sessionDate: string;
    readonly changePercent: number | null;
    readonly signalTypes: readonly SignalType[];
}

/** 공포·탐욕 극단 구간 진입 판정 결과(코어가 판정한 값을 옮긴 것). */
export interface MailAlertFearGreedEntry {
    readonly zone: ExtremeFearGreedZone;
    readonly date: string;
    readonly score: number;
}

export interface PlanMailAlertInput {
    /** 구독자의 저장된 항목(순서가 곧 메일 안의 순서). */
    readonly topics: readonly MailAlertTopic[];
    /** 보유종목·관심종목 함께 받기가 켜진 회원의 종목(주식·ETF만, 순서대로). */
    readonly portfolioSymbols: readonly string[];
    /** 종목 → 알림 시장. 주식·ETF가 아니면 `null`이거나 키가 없다. */
    readonly marketOf: ReadonlyMap<string, SignalHistoryMarket | null>;
    /** 시장별 새 에피소드. 기록이 준비되지 않은 시장은 빈 배열이다. */
    readonly episodes: Readonly<
        Record<SignalHistoryMarket, readonly MailAlertEpisodeRow[]>
    >;
    /** 시장별 기대 세션(`episodes`가 가리키는 날). */
    readonly episodeSessions: Readonly<Record<SignalHistoryMarket, string>>;
    /** 담은 종목별 일봉 판정. 판정하지 못한 종목(낡은 봉, 조회 실패)은 키가 없다. */
    readonly computed: ReadonlyMap<string, MailAlertComputedSymbol>;
    /** 시장별 극단 구간 진입. 준비되지 않았거나 진입이 없으면 키가 없다. */
    readonly fearGreed: ReadonlyMap<
        MailAlertFearGreedMarket,
        MailAlertFearGreedEntry
    >;
    /** 최근 `MAIL_ALERT_SUPPRESS_DAYS`일 안에 이미 보낸 항목 키(`suppressionKey`). */
    readonly suppressed: ReadonlySet<string>;
}

/** 한 신호 유형의 "신호별 새 종목" 섹션. `moreCount`는 줄 수 상한에 걸려 싣지 못한 종목 수다. */
export interface MailAlertHubSection {
    readonly signalType: SignalType;
    readonly items: readonly MailAlertSignalItem[];
    readonly moreCount: number;
}

export interface MailAlertPlan {
    readonly sections: {
        readonly fearGreed: readonly MailAlertFearGreedItem[];
        readonly mine: readonly MailAlertSignalItem[];
        readonly hubs: readonly MailAlertHubSection[];
    };
    /** 실제로 실린 항목의 반복 방지 키만 담는다. 싣지 못한 항목은 다음에 다시 후보가 된다. */
    readonly itemKeys: readonly string[];
    /**
     * 후보였지만 줄 수 상한(담은 종목 섹션, 신호별 섹션)에 걸려 싣지 못한 항목의 키. 제목의 건수에는 세지
     * 않지만 선점·발송 기록에는 `itemKeys`와 함께 남긴다 — 같은 세션이 며칠 이어지는 날(주말·휴장)에 넘친 줄이
     * "새 항목"으로 다시 올라오지 않게 한다.
     */
    readonly overflowKeys: readonly string[];
    /** 최근에 이미 보냈다는 이유로 뺀 서로 다른 항목(키) 수. 상한에 걸려 못 실은 항목은 세지 않는다. */
    readonly suppressedCount: number;
}

function unique<T>(values: readonly T[]): T[] {
    return [...new Set(values)];
}

function mineItemsOf(
    symbol: string,
    input: PlanMailAlertInput
): MailAlertSignalItem[] {
    const market = input.marketOf.get(symbol) ?? null;
    if (market === null) return [];
    const computed = input.computed.get(symbol);
    if (computed === undefined) return [];
    return computed.signalTypes.map(signalType => ({
        kind: 'signal',
        section: 'mine',
        market,
        symbol,
        // 표시 이름은 메일을 만들 때 사이트 종목 페이지와 같은 이름 원천에서 고른다(`symbolNames`).
        name: null,
        signalType,
        sessionDate: computed.sessionDate,
        changePercent: computed.changePercent,
    }));
}

function absChange(item: MailAlertSignalItem): number {
    return Math.abs(item.changePercent ?? 0);
}

interface HubPick {
    readonly section: MailAlertHubSection;
    readonly suppressedKeys: readonly string[];
    readonly overflowKeys: readonly string[];
}

function hubSectionOf(
    signalType: SignalType,
    input: PlanMailAlertInput,
    mineSymbols: ReadonlySet<string>
): HubPick {
    const candidates = MARKETS.flatMap(market =>
        input.episodes[market]
            .filter(row => row.signalType === signalType)
            .map((row): MailAlertSignalItem => ({
                kind: 'signal',
                section: 'hub',
                market,
                symbol: row.symbol,
                name: row.name,
                signalType,
                sessionDate: input.episodeSessions[market],
                changePercent: row.changePercent,
            }))
    ).filter(item => !mineSymbols.has(item.symbol));
    const eligible = candidates
        .filter(item => !input.suppressed.has(suppressionKey(item)))
        .toSorted(
            (a, b) =>
                absChange(b) - absChange(a) || a.symbol.localeCompare(b.symbol)
        );
    const items = eligible.slice(0, MAIL_ALERT_MAX_HUB_ROWS);
    return {
        section: {
            signalType,
            items,
            moreCount: eligible.length - items.length,
        },
        suppressedKeys: candidates
            .map(suppressionKey)
            .filter(key => input.suppressed.has(key)),
        overflowKeys: eligible.slice(items.length).map(suppressionKey),
    };
}

interface FearGreedPick {
    readonly items: readonly MailAlertFearGreedItem[];
    readonly suppressedKeys: readonly string[];
}

function fearGreedItemsOf(input: PlanMailAlertInput): FearGreedPick {
    const markets = unique(
        input.topics.flatMap(topic =>
            topic.kind === 'fear_greed' ? [topic.market] : []
        )
    );
    const candidates = markets.flatMap((market): MailAlertFearGreedItem[] => {
        const entry = input.fearGreed.get(market);
        return entry === undefined
            ? []
            : [
                  {
                      kind: 'fear_greed',
                      market,
                      zone: entry.zone,
                      date: entry.date,
                      score: entry.score,
                  },
              ];
    });
    const items = candidates.filter(
        item => !input.suppressed.has(suppressionKey(item))
    );
    return {
        items,
        suppressedKeys: candidates
            .map(suppressionKey)
            .filter(key => input.suppressed.has(key)),
    };
}

/**
 * 한 구독자가 이번 알림 날짜에 받을 항목을 정한다. 순수 함수다 — 담은 종목은 일봉 직접 판정(`computed`),
 * 신호별 섹션은 신호 기록(`episodes`)으로 호출자가 나눠 넣고, 여기서는 고르고 줄이고 거르기만 한다.
 *
 * - 담은 종목: 주제의 종목과 보유·관심종목(회원 선택)의 합집합. 스캐너 대상 여부와 상관없이 그 종목의 일봉
 *   판정(`computed`)만 읽는다 — 신호 기록과 맞춰 보지 않는다. 종목·신호 유형 하나가 한 항목이다.
 * - 신호별 새 종목: 신호 주제마다 두 시장의 새 에피소드. 담은 종목 섹션에 실린 종목은 다시 싣지 않고, 변동률
 *   절댓값 순으로 `MAIL_ALERT_MAX_HUB_ROWS`개까지 싣는다.
 * - 공포·탐욕: 구독한 시장 중 극단 구간에 진입한 시장.
 * - 이미 최근에 보낸 항목은 모든 섹션에서 뺀다. 빈 결과면 호출자가 아무것도 보내지도 기록하지도 않는다.
 */
export function planMailAlertItems(input: PlanMailAlertInput): MailAlertPlan {
    const watched = unique([
        ...input.topics.flatMap(topic =>
            topic.kind === 'symbol' ? [topic.symbol] : []
        ),
        ...input.portfolioSymbols,
    ]);
    const mineCandidates = watched.flatMap(symbol =>
        mineItemsOf(symbol, input)
    );
    const mineEligible = mineCandidates.filter(
        item => !input.suppressed.has(suppressionKey(item))
    );
    const mine = mineEligible.slice(0, MAIL_ALERT_MAX_SIGNAL_ITEMS);
    const mineSymbols = new Set(mine.map(item => item.symbol));
    const hubPicks = unique(
        input.topics.flatMap(topic =>
            topic.kind === 'signal' ? [topic.signalType] : []
        )
    ).map(signalType => hubSectionOf(signalType, input, mineSymbols));
    const hubs = hubPicks
        .map(pick => pick.section)
        .filter(section => section.items.length > 0);
    const fearGreed = fearGreedItemsOf(input);
    return {
        sections: { fearGreed: fearGreed.items, mine, hubs },
        overflowKeys: [
            ...mineEligible.slice(mine.length).map(suppressionKey),
            ...hubPicks.flatMap(pick => pick.overflowKeys),
        ],
        itemKeys: [
            ...fearGreed.items,
            ...mine,
            ...hubs.flatMap(section => section.items),
        ].map(suppressionKey),
        // 같은 키가 담은 종목과 신호별 섹션에 함께 후보였어도 한 번만 센다.
        suppressedCount: new Set(
            [
                ...mineCandidates.map(suppressionKey),
                ...hubPicks.flatMap(pick => pick.suppressedKeys),
                ...fearGreed.suppressedKeys,
            ].filter(key => input.suppressed.has(key))
        ).size,
    };
}
