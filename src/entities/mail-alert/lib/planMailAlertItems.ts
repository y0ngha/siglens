import type { ExtremeFearGreedZone, SignalType } from '@y0ngha/siglens-core';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import type {
    MailAlertChange,
    MailAlertFearGreedItem,
    MailAlertFearGreedMarket,
    MailAlertMineItem,
    MailAlertPriceAlertItem,
    MailAlertSignalItem,
    MailAlertTopic,
    MailAlertVoidedPriceAlertItem,
} from '../model';
import {
    MAIL_ALERT_CHANGE_SIGNAL_TYPES,
    MAIL_ALERT_MAX_CHANGES_PER_SYMBOL,
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
    /**
     * 종목 → 이 구독자가 볼 수 있는 달라진 점(코어가 두 종가 사이를 읽은 결과, 가격 판정·가격대·추세 순). 구독자의 등급이
     * 보는 분석 깊이가 다르므로 발송기가 구독자마다 맞춰 넣는다. `computed`에 없는 종목의 줄은 싣지 않는다.
     */
    readonly changes: ReadonlyMap<string, readonly MailAlertChange[]>;
    /** 시장별 극단 구간 진입. 준비되지 않았거나 진입이 없으면 키가 없다. */
    readonly fearGreed: ReadonlyMap<
        MailAlertFearGreedMarket,
        MailAlertFearGreedEntry
    >;
    /** 최근 `MAIL_ALERT_SUPPRESS_DAYS`일 안에 이미 보낸 항목 키(`suppressionKey`). */
    readonly suppressed: ReadonlySet<string>;
    /**
     * 이 구독자의 조건을 충족한 가격대 알림(발송기가 일봉 종가로 판정한 결과). 알림은 한 번 알리면 끝나
     * (`status`가 반복을 막는다) 반복 방지 창을 거치지 않고, 줄 수 상한도 없다(구독자당 상한이 따로 있다).
     */
    readonly priceAlerts: readonly MailAlertPriceAlertItem[];
    /**
     * 가격 기준이 달라져 끝낸 알림 — 메일이 한 줄로 알리고, 보낸 뒤 `deliveries.finish`가 메일이 나가지 않았다고
     * 확정되지 않은 경우에만 그 알림을 지운다.
     */
    readonly voidedPriceAlerts: readonly MailAlertVoidedPriceAlertItem[];
}

/** 한 신호 유형의 "신호별 새 종목" 섹션. `moreCount`는 줄 수 상한에 걸려 싣지 못한 종목 수다. */
export interface MailAlertHubSection {
    readonly signalType: SignalType;
    readonly items: readonly MailAlertSignalItem[];
    readonly moreCount: number;
}

export interface MailAlertPlan {
    readonly sections: {
        /** 가장 먼저 싣는다 — 사용자가 직접 요청한 알림이다. */
        readonly priceAlerts: readonly MailAlertPriceAlertItem[];
        /** 끝낸 알림 안내. 가격대 알림 섹션 안에서 충족 줄 뒤에 싣는다. */
        readonly voidedPriceAlerts: readonly MailAlertVoidedPriceAlertItem[];
        readonly fearGreed: readonly MailAlertFearGreedItem[];
        readonly mine: readonly MailAlertMineItem[];
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

function isChangeSignalType(signalType: SignalType): boolean {
    return MAIL_ALERT_CHANGE_SIGNAL_TYPES.some(type => type === signalType);
}

/** 한 종목의 "담은 종목" 후보: 달라진 점(가격 판정, 가격대, 추세 순)을 먼저, 새 신호를 뒤에 둔다. */
function mineItemsOf(
    symbol: string,
    input: PlanMailAlertInput
): MailAlertMineItem[] {
    const market = input.marketOf.get(symbol) ?? null;
    if (market === null) return [];
    const computed = input.computed.get(symbol);
    // 판정하지 못한 종목(낡은 봉, 조회 실패)은 달라진 점도 싣지 않는다 — 그 세션의 종가를 확인하지 못했다.
    if (computed === undefined) return [];
    const changes = (input.changes.get(symbol) ?? []).map(
        (change): MailAlertMineItem => ({
            kind: 'change',
            section: 'mine',
            market,
            symbol,
            name: null,
            sessionDate: computed.sessionDate,
            change,
        })
    );
    return [
        ...changes,
        ...computed.signalTypes
            .filter(isChangeSignalType)
            .map((signalType): MailAlertMineItem => ({
                kind: 'signal',
                section: 'mine',
                market,
                symbol,
                // 표시 이름은 메일을 만들 때 사이트 종목 페이지와 같은 이름 원천에서 고른다(`symbolNames`).
                name: null,
                signalType,
                sessionDate: computed.sessionDate,
                changePercent: computed.changePercent,
            })),
    ];
}

/**
 * 이 구독자의 가격대 알림이 이번 실행에 이 종목으로 울렸는지에 따라, 같은 가격 사실을 말하는 줄(가격 판정, 진입
 * 구간, 무효화 기준)은 알림 줄이 이미 말한 것이다. 추세와 신호는 다른 사실이라 해당하지 않는다.
 */
function isCoveredByPriceAlert(
    item: MailAlertMineItem,
    input: PlanMailAlertInput
): boolean {
    return (
        item.kind === 'change' &&
        item.change.kind !== 'trend' &&
        input.priceAlerts.some(
            alert =>
                alert.market === item.market && alert.symbol === item.symbol
        )
    );
}

/**
 * 종목당 상한(`MAIL_ALERT_MAX_CHANGES_PER_SYMBOL`)을 넘는 줄을 가른다. 순서가 곧 우선순위라 앞의 줄이 남는다.
 * 넘친 줄은 싣지 않지만 키는 남겨 다음 날 새 항목으로 올라오지 않게 한다.
 */
function capPerSymbol(items: readonly MailAlertMineItem[]): {
    readonly kept: MailAlertMineItem[];
    readonly overflow: MailAlertMineItem[];
} {
    // 같은 종목의 앞선 줄 수가 그 줄의 순위다. 후보는 구독 항목 수 × 종목당 줄 수 정도라 작다.
    const ranked = items.map((item, index) => ({
        item,
        withinCap:
            items
                .slice(0, index)
                .filter(earlier => earlier.symbol === item.symbol).length <
            MAIL_ALERT_MAX_CHANGES_PER_SYMBOL,
    }));
    return {
        kept: ranked.filter(entry => entry.withinCap).map(entry => entry.item),
        overflow: ranked
            .filter(entry => !entry.withinCap)
            .map(entry => entry.item),
    };
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
    mineKeys: ReadonlySet<string>
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
    ).filter(item => !mineKeys.has(suppressionKey(item)));
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

/** 가격대 알림 한 줄의 키. 알림 id마다 유일해서 반복 방지 키 집합과 겹칠 일이 없다. */
export function priceAlertItemKey(item: MailAlertPriceAlertItem): string {
    return `p:${item.alertId}`;
}

/** 끝낸 알림 안내 한 줄의 키. */
export function voidedPriceAlertItemKey(
    item: MailAlertVoidedPriceAlertItem
): string {
    return `v:${item.alertId}`;
}

/**
 * 선점이 실제로 `fired`로 바꾼 알림만 남긴 계획. 판정과 선점 사이에 사용자가 지운(또는 겹친 실행이 먼저 알린)
 * 알림은 메일이 말하면 안 된다 — 그 줄과 키를 뺀다. 나머지 섹션은 그대로다.
 */
export function keepFiredPriceAlerts(
    plan: MailAlertPlan,
    firedAlertIds: readonly string[]
): MailAlertPlan {
    const fired = new Set(firedAlertIds);
    const dropped = new Set(
        plan.sections.priceAlerts
            .filter(alert => !fired.has(alert.alertId))
            .map(priceAlertItemKey)
    );
    if (dropped.size === 0) return plan;
    return {
        ...plan,
        sections: {
            ...plan.sections,
            priceAlerts: plan.sections.priceAlerts.filter(alert =>
                fired.has(alert.alertId)
            ),
        },
        itemKeys: plan.itemKeys.filter(key => !dropped.has(key)),
    };
}

/**
 * 한 구독자가 이번 알림 날짜에 받을 항목을 정한다. 순수 함수다 — 담은 종목은 일봉 직접 판정(`computed`,
 * `changes`), 신호별 섹션은 신호 기록(`episodes`)으로 호출자가 나눠 넣고, 여기서는 고르고 줄이고 거르기만 한다.
 *
 * - 담은 종목: 주제의 종목과 보유·관심종목(회원 선택)의 합집합. 스캐너 대상 여부와 상관없이 그 종목의 일봉
 *   판정만 읽는다(신호 기록과 맞춰 보지 않는다). 종목마다 달라진 점(`changes`)과 새 신호(`computed`)가 후보이고, 한 종목은 `MAIL_ALERT_MAX_CHANGES_PER_SYMBOL`줄까지,
 *   섹션은 `MAIL_ALERT_MAX_SIGNAL_ITEMS`줄까지 싣는다(줄 수 상한은 신호와 달라진 점을 함께 센다).
 *   MACD 교차는 이 섹션에서 뺀다(`MAIL_ALERT_CHANGE_SIGNAL_TYPES`). 이 구독자의 가격대 알림이 같은 종목으로 울린
 *   실행에서는 가격 판정·진입 구간·무효화 기준 줄을 싣지 않고 키만 `overflowKeys`에 남긴다.
 * - 신호별 새 종목: 신호 주제마다 두 시장의 새 에피소드. 담은 종목 섹션에 실린 신호 줄과 같은 키(시장, 종목, 유형)의
 *   후보는 다시 싣지 않고, 변동률 절댓값 순으로 `MAIL_ALERT_MAX_HUB_ROWS`개까지 싣는다.
 * - 공포·탐욕: 구독한 시장 중 극단 구간에 진입한 시장.
 * - 가격대 알림: 발송기가 판정한 알림을 걸러내지 않고 맨 앞 섹션에 싣는다(키는 `p:<알림 id>`).
 * - 이미 최근에 보낸 항목은 모든 섹션에서 뺀다. 빈 결과면 호출자가 아무것도 보내지도 기록하지도 않는다.
 */
export function planMailAlertItems(input: PlanMailAlertInput): MailAlertPlan {
    const watched = unique([
        ...input.topics.flatMap(topic =>
            topic.kind === 'symbol' ? [topic.symbol] : []
        ),
        ...input.portfolioSymbols,
    ]);
    const allMine = watched.flatMap(symbol => mineItemsOf(symbol, input));
    // 알림 줄이 이미 말한 가격 사실은 싣지 않되 키는 남긴다 — 알림은 한 번 알리면 끝나서 다음 실행에는 알림 줄이
    // 없는데, 키가 없으면 같은 가격 사실이 "달라진 점"으로 다시 올라온다.
    const mineCandidates = allMine.filter(
        item => !isCoveredByPriceAlert(item, input)
    );
    const coveredKeys = allMine
        .filter(item => isCoveredByPriceAlert(item, input))
        .map(suppressionKey);
    const mineEligible = mineCandidates.filter(
        item => !input.suppressed.has(suppressionKey(item))
    );
    const perSymbol = capPerSymbol(mineEligible);
    const mine = perSymbol.kept.slice(0, MAIL_ALERT_MAX_SIGNAL_ITEMS);
    // 허브 섹션은 같은 신호를 두 번 싣지 않으려고 "담은 종목"에 실린 신호 줄과 같은 키(시장, 종목, 유형)의 후보만
    // 뺀다. 같은 종목의 다른 유형 신호나 추세·가격대 줄은 허브 후보를 가리지 않는다.
    const mineKeys = new Set(
        mine.flatMap(item =>
            item.kind === 'signal' ? [suppressionKey(item)] : []
        )
    );
    const hubPicks = unique(
        input.topics.flatMap(topic =>
            topic.kind === 'signal' ? [topic.signalType] : []
        )
    ).map(signalType => hubSectionOf(signalType, input, mineKeys));
    const hubs = hubPicks
        .map(pick => pick.section)
        .filter(section => section.items.length > 0);
    const fearGreed = fearGreedItemsOf(input);
    return {
        sections: {
            priceAlerts: input.priceAlerts,
            voidedPriceAlerts: input.voidedPriceAlerts,
            fearGreed: fearGreed.items,
            mine,
            hubs,
        },
        overflowKeys: [
            ...coveredKeys,
            ...perSymbol.overflow.map(suppressionKey),
            ...perSymbol.kept.slice(mine.length).map(suppressionKey),
            ...hubPicks.flatMap(pick => pick.overflowKeys),
        ],
        itemKeys: [
            ...input.priceAlerts.map(priceAlertItemKey),
            ...input.voidedPriceAlerts.map(voidedPriceAlertItemKey),
            ...[
                ...fearGreed.items,
                ...mine,
                ...hubs.flatMap(section => section.items),
            ].map(suppressionKey),
        ],
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
