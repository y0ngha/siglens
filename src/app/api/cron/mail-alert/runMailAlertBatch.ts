import 'server-only';
import type { Tier } from '@y0ngha/siglens-core';
import type { ReportSymbolNames } from '@/entities/email-report/reportModel';
import { isMissingTableError } from '@/entities/mail-alert/lib/dbErrorKind';
import {
    MAIL_ALERT_CHANGE_REFERENCE_MAX_AGE_DAYS,
    MAIL_ALERT_DELIVERY_RETENTION_DAYS,
    MAIL_ALERT_FEAR_GREED_MARKETS,
    MAIL_ALERT_SUPPRESS_DAYS,
} from '@/entities/mail-alert/lib/mailAlertConstants';
import {
    buildMailAlertManageUrl,
    buildMailAlertUnsubscribeApiUrl,
    buildMailAlertUnsubscribePageUrl,
} from '@/entities/mail-alert/lib/mailAlertLinks';
import {
    mailAlertDate,
    mailAlertIdempotencyKey,
    mailAlertSlot,
    type MailAlertSlot,
} from '@/entities/mail-alert/lib/mailAlertSlot';
import {
    keepFiredPriceAlerts,
    planMailAlertItems,
    type MailAlertEpisodeRow,
    type MailAlertPlan,
} from '@/entities/mail-alert/lib/planMailAlertItems';
import { rowToTopic } from '@/entities/mail-alert/lib/topics';
import type {
    MailAlertChange,
    MailAlertFearGreedMarket,
    MailAlertTopic,
} from '@/entities/mail-alert/model';
import { buildMailAlertEmail } from '@/entities/mail-alert/templates/mailAlertEmail';
import type {
    MailAlertEmailTranslator,
    MailAlertSignalLabelResolver,
} from '@/entities/mail-alert/templates/mailAlertEmailTypes';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import {
    redactDbErrorForLog,
    redactedErrorMessage,
} from '@/shared/db/redactDbErrorForLog';
import type {
    MailAlertDeliveryRepository,
    MailAlertDeliveryTarget,
    MailAlertSubscriberRepository,
    PriceAlertRepository,
} from '@/shared/db/types';
import type {
    KeyedEmailDispatcher,
    KeyedEmailOutcome,
} from '@/shared/email/types';
import type { Locale } from '@/shared/i18n/locales';
import { kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';
import { mapChunked } from '@/shared/lib/mapChunked';
import {
    checkSignalReadiness,
    expectedSessions,
    loadComputedSources,
    loadEpisodes,
    loadFearGreedSources,
    type AlertSourceDeps,
    type ChangeReferenceInput,
    type ExpectedSessions,
    type SymbolReading,
} from './collectAlertSources';
import {
    evaluatePriceAlerts,
    type PriceAlertEvaluation,
} from './evaluatePriceAlerts';

/**
 * 한 번의 실행이 새 구독자 처리를 시작할 수 있는 시간. 시간당 cron의 다음 실행(08시 최종 슬롯은 한 시간 뒤)과
 * 겹치기 전에 멈춘다. 마감 뒤 남은 구독자는 선점하지 않으므로 기록 없이 그날을 건너뛴다(로그로 남긴다).
 */
export const MAIL_ALERT_DEADLINE_MS = 20 * 60 * 1000;

/** 동시에 처리하는 구독자 수. 발송 속도는 공유 `ThrottledEmailDispatcher`가 따로 묶는다. */
export const MAIL_ALERT_WORKERS = 4;

/** 보유·관심종목 조회와 종목 → 시장 판정을 동시에 하는 수(CC-1). */
export const MAIL_ALERT_LOOKUP_CONCURRENCY = 5;

const ERROR_MAX_LENGTH = 500;

export interface MailAlertBatchDeps {
    /** 공개 스위치(`isMailAlertLaunched()`). 꺼져 있으면 아무것도 읽거나 보내지 않는다. */
    readonly launched: boolean;
    /** 서명 비밀. 없으면 수신거부 링크가 안 되는 메일이 나가므로 아무것도 보내지 않는다. */
    readonly secret: string | null;
    readonly siteUrl: string;
    readonly subscribers: Pick<
        MailAlertSubscriberRepository,
        'findAllForDelivery'
    >;
    readonly deliveries: MailAlertDeliveryRepository;
    /**
     * 가격대 알림: 진행 중인 알림 읽기, 만료·보존 기간이 지난 알림 정리, 끝낸 알림 때문에 받을 것이 없어진
     * 구독자 정리(끝낸 알림의 삭제 자체는 보낸 뒤 `deliveries.finish`가, 메일이 나가지 않았다고 확정되지 않은 경우에만
     * 한다).
     */
    readonly priceAlerts: Pick<
        PriceAlertRepository,
        | 'listActiveForDelivery'
        | 'pruneExpiredAndFired'
        | 'removeSubscriberIfNothingToReceive'
    >;
    readonly sources: AlertSourceDeps;
    /**
     * 메일에 싣는 종목의 표시 이름(영문 법인명과 한글명). 메일 리포트와 같은 원천(종목 페이지의 24시간 데이터
     * 캐시)이다. 없는 종목은 `null`, 조회가 던지면 그 종목만 이름 없이(코드로) 싣는다.
     */
    readonly getSymbolNames: (
        symbol: string
    ) => Promise<ReportSymbolNames | null>;
    /**
     * 연결된 회원의 등급. 가격대·진입 구간 줄은 그 등급이 보는 분석 깊이로만 읽는다(비회원은 `free`). 없으면 모든
     * 구독자를 `free`로 본다 — 가격대 줄 없이 추세·신호만 나간다. 던지면 그 구독자는 `free`다.
     */
    readonly resolveTier?: (userId: string) => Promise<Tier>;
    readonly findHoldings: (
        userId: string
    ) => Promise<ReadonlyArray<{ symbol: string }>>;
    readonly findWatchlist: (
        userId: string
    ) => Promise<ReadonlyArray<{ symbol: string }>>;
    /** 종목 → 알림 시장. 미국·한국 주식과 ETF가 아니면 `null`. */
    readonly resolveMarket: (
        symbol: string
    ) => Promise<SignalHistoryMarket | null>;
    readonly getTranslator: (
        locale: Locale
    ) => Promise<MailAlertEmailTranslator>;
    readonly getSignalLabel: (
        locale: Locale
    ) => Promise<MailAlertSignalLabelResolver>;
    readonly getDisclaimer: (locale: Locale) => Promise<string>;
    readonly dispatcher: KeyedEmailDispatcher;
    /** 테스트가 마감을 당길 수 있게 주입한다. */
    readonly clock?: () => number;
}

export interface MailAlertBatchCounts {
    readonly slot: MailAlertSlot;
    readonly alertDate: string;
    /** 최종 슬롯에서 준비되지 않은 채 보낸 소스. */
    notReady: readonly string[];
    subscribers: number;
    /** 새 항목이 없어 아무것도 선점하지 않은 구독자. */
    quiet: number;
    sent: number;
    failed: number;
    /** 이미 선점된(같은 날 앞 슬롯·겹친 실행) 구독자. */
    alreadyClaimed: number;
    /** 마감으로 손대지 못한 구독자. */
    deferredByDeadline: number;
    /** 최근에 이미 보냈다는 이유로 뺀 항목 수. */
    suppressedItems: number;
    /** 일봉으로 판정을 시도한 종목 수(스캐너 대상 포함 — 추세를 읽으려고 모두 읽는다). */
    computedSymbols: number;
    /** 마지막 일봉이 기대 세션이 아니어서 달라진 점도 신호도 읽지 못한 종목 수. */
    noFreshBar: number;
    /** 일봉 판정이나 종목 → 시장 판정이 실패한 종목 수. */
    computeErrors: number;
    /** 보유·관심종목을 읽지 못해 이번 실행에서 건너뛴 구독자(선점하지 않았으니 다음 슬롯이 다시 본다). */
    portfolioErrors: number;
    /**
     * 첫 슬롯에서 담은 종목 중 판정하지 못한 종목(낡은 봉, 일봉·시장 조회 오류)이 있어 선점하지 않고 최종 슬롯으로
     * 넘긴 구독자.
     */
    deferredSymbolsNotReady: number;
    pruned: number;
    /** 이번 실행이 판정한 진행 중 가격대 알림 수. */
    priceAlertsActive: number;
    /** 메일 선점과 함께 `fired`로 바꾼 가격대 알림 수. */
    priceAlertsFired: number;
    /** 분할·재상장으로 가격 척도가 달라져 메일로 알리고 지운 가격대 알림 수. */
    priceAlertsVoided: number;
    /** 일봉을 읽지 못해 이번에 판정하지 못한 종목 수(알림은 다음 실행이 다시 본다). */
    priceAlertBarErrors: number;
    /** 만료·보존 기간 경과로 정리한 가격대 알림 수와, 그로 받을 것이 없어져 함께 지운 구독자 수. */
    priceAlertsPruned: number;
    priceAlertSubscribersPruned: number;
    /** 달라진 점(추세, 가격대, 진입 구간)을 하나 이상 읽은 종목 수(반복 방지 전). */
    changeSymbols: number;
    /** 선점한 메일에 실린 달라진 점 줄 수. */
    changeLines: number;
    /** 일봉을 받다 실패한 종목 수(판정이 던진 것은 `computeErrors`에만 센다). */
    changeBarErrors: number;
    /** 이번 실행이 일봉 읽기를 시작한 종목 수(실행 안에서 종목당 한 번). 봉 캐시가 비면 외부 공급자 부하가 된다. */
    barLoads: number;
    /** 가격대·진입 구간 줄을 읽는 데 쓴 (종목, 등급) 분석 수. */
    changeReferences: number;
}

export type MailAlertBatchResult =
    | { readonly status: 'outside_window' }
    | {
          readonly status: 'disabled';
          readonly reason: 'flag_off' | 'missing_table';
      }
    | { readonly status: 'no_secret' }
    | { readonly status: 'deferred'; readonly notReady: readonly string[] }
    | { readonly status: 'done'; readonly counts: MailAlertBatchCounts };

interface PreparedSubscriber {
    readonly target: MailAlertDeliveryTarget;
    readonly topics: readonly MailAlertTopic[];
    readonly portfolioSymbols: readonly string[];
}

/**
 * 메일을 만들고 보낸 결과. `mailNotSent`는 메일이 나가지 않았다고 확정된 경우다: 보내기 전에 실패했거나(메일을
 * 만들다 던짐) 제공자가 확정적으로 거절했다. 보내다 던진 경우는 나갔는지 알 수 없어 `false`다.
 */
type SendResult =
    | { readonly kind: 'accepted'; readonly mailNotSent: false }
    | { readonly kind: 'rejected'; readonly mailNotSent: true }
    | {
          readonly kind: 'threw';
          readonly error: unknown;
          readonly mailNotSent: boolean;
      };

/**
 * 멱등 키 발송 결과를 `sent`로 기록할지. `already_accepted`는 같은 키(같은 구독자, 같은 날)의 첫 요청을 제공자가
 * 이미 받았다는 뜻이라 DB-11 그대로 성공이다(실패로 남기면 받은 항목이 다음 날 억제되지 않는다).
 *
 * **`in_flight`는 DB-11에서 일부러 벗어난다.** DB-11은 "처리 중"을 시도를 쓰지 않고 나중에 다시 하라고 하지만,
 * 알림 메일에는 그 "나중"이 없다: 선점 행이 이미 그 날을 잡았고, 08시 최종 슬롯도 선점된 구독자를 건너뛰며,
 * 다음 날은 새 알림 날짜다. 다시 시도할 길이 없으니 같은 키의 진행 중 요청이 이 날의 메일을 보낸다고 보고 `sent`로
 * 접는다 — `failed`로 남기면 그 요청이 실제로 나간 날 항목이 억제되지 않아 다음 날 같은 소식이 다시 간다.
 */
function countsAsSent(outcome: KeyedEmailOutcome): boolean {
    return outcome !== 'rejected';
}

function errorText(error: unknown): string {
    return redactedErrorMessage(error).slice(0, ERROR_MAX_LENGTH);
}

function topicsOf(target: MailAlertDeliveryTarget): MailAlertTopic[] {
    return target.topics.flatMap(row => rowToTopic(row) ?? []);
}

/** 회원이 보유종목·관심종목 함께 받기를 켰으면 두 목록의 종목을 읽는다. 실패하면 `null`. */
async function loadPortfolioSymbols(
    deps: MailAlertBatchDeps,
    target: MailAlertDeliveryTarget
): Promise<string[] | null> {
    if (!target.includePortfolio || target.userId === null) return [];
    try {
        const [holdings, watchlist] = await Promise.all([
            deps.findHoldings(target.userId),
            deps.findWatchlist(target.userId),
        ]);
        return [
            ...new Set([...holdings, ...watchlist].map(item => item.symbol)),
        ];
    } catch (error) {
        console.error(
            `[mail-alert] portfolio read failed for ${target.id}`,
            redactDbErrorForLog(error)
        );
        return null;
    }
}

/** 준비 게이트가 읽는 것: 항목만 풀어 둔 구독자. 보유·관심종목은 게이트를 통과한 뒤에 읽는다. */
interface TopicSubscriber {
    readonly target: MailAlertDeliveryTarget;
    readonly topics: readonly MailAlertTopic[];
}

async function prepareSubscribers(
    deps: MailAlertBatchDeps,
    subscribers: readonly TopicSubscriber[],
    counts: MailAlertBatchCounts
): Promise<PreparedSubscriber[]> {
    const prepared = await mapChunked(
        subscribers,
        MAIL_ALERT_LOOKUP_CONCURRENCY,
        async ({ target, topics }): Promise<PreparedSubscriber | null> => {
            const portfolioSymbols = await loadPortfolioSymbols(deps, target);
            if (portfolioSymbols === null) {
                counts.portfolioErrors += 1;
                return null;
            }
            return { target, topics, portfolioSymbols };
        }
    );
    return prepared.flatMap(subscriber => subscriber ?? []);
}

function watchedSymbolsOf(
    subscribers: readonly PreparedSubscriber[]
): string[] {
    return [
        ...new Set(
            subscribers.flatMap(({ topics, portfolioSymbols }) => [
                ...topics.flatMap(topic =>
                    topic.kind === 'symbol' ? [topic.symbol] : []
                ),
                ...portfolioSymbols,
            ])
        ),
    ];
}

/** 종목 → 알림 시장. 조회가 던진 종목은 `failed`에 넣고 `null`(싣지 않음)로 둔다. */
async function resolveMarkets(
    deps: MailAlertBatchDeps,
    symbols: readonly string[],
    counts: MailAlertBatchCounts,
    failed: Set<string>
): Promise<Map<string, SignalHistoryMarket | null>> {
    const entries = await mapChunked(
        symbols,
        MAIL_ALERT_LOOKUP_CONCURRENCY,
        async (symbol): Promise<[string, SignalHistoryMarket | null]> => {
            try {
                return [symbol, await deps.resolveMarket(symbol)];
            } catch (error) {
                counts.computeErrors += 1;
                failed.add(symbol);
                console.error(
                    `[mail-alert] market lookup failed for ${symbol}`,
                    redactDbErrorForLog(error)
                );
                return [symbol, null];
            }
        }
    );
    return new Map(entries);
}

/** 한 구독자가 담은 종목(주제의 종목, 보유·관심종목). */
function watchedOf(subscriber: PreparedSubscriber): string[] {
    return [
        ...subscriber.topics.flatMap(topic =>
            topic.kind === 'symbol' ? [topic.symbol] : []
        ),
        ...subscriber.portfolioSymbols,
    ];
}

/** 메일에 실릴 종목(가격대 알림, 담은 종목 섹션, 신호별 섹션). */
function plannedSymbols(plan: MailAlertPlan): string[] {
    return [
        ...new Set([
            ...plan.sections.priceAlerts.map(item => item.symbol),
            ...plan.sections.voidedPriceAlerts.map(item => item.symbol),
            ...plan.sections.mine.map(item => item.symbol),
            ...plan.sections.hubs.flatMap(section =>
                section.items.map(item => item.symbol)
            ),
        ]),
    ];
}

/**
 * 종목 표시 이름을 실행 안에서 종목마다 한 번만 읽는다. 조회 실패는 그 종목만 이름 없이(`null`) 두고 메일은
 * 나간다. 메일 리포트의 이름 조회와 같은 처리다.
 */
function createSymbolNamesCache(
    deps: MailAlertBatchDeps
): (
    symbols: readonly string[]
) => Promise<ReadonlyMap<string, ReportSymbolNames | null>> {
    const cache = new Map<string, Promise<ReportSymbolNames | null>>();
    const one = (symbol: string): Promise<ReportSymbolNames | null> => {
        const cached = cache.get(symbol);
        if (cached !== undefined) return cached;
        const pending = deps.getSymbolNames(symbol).catch(error => {
            console.warn(
                `[mail-alert] name lookup failed for ${symbol}`,
                redactDbErrorForLog(error)
            );
            return null;
        });
        cache.set(symbol, pending);
        return pending;
    };
    return async symbols =>
        new Map(
            await mapChunked(
                symbols,
                MAIL_ALERT_LOOKUP_CONCURRENCY,
                async (symbol): Promise<[string, ReportSymbolNames | null]> => [
                    symbol,
                    await one(symbol),
                ]
            )
        );
}

function fearGreedMarketsOf(
    subscribers: readonly TopicSubscriber[]
): MailAlertFearGreedMarket[] {
    const wanted = new Set(
        subscribers.flatMap(({ topics }) =>
            topics.flatMap(topic =>
                topic.kind === 'fear_greed' ? [topic.market] : []
            )
        )
    );
    return MAIL_ALERT_FEAR_GREED_MARKETS.filter(market => wanted.has(market));
}

/**
 * 종목당 일봉을 실행 안에서 한 번만 읽는다. 담은 모든 종목의 달라진 점 판정과 가격대 알림 판정이 같은 종목을
 * 함께 보는 일이 흔해서, 약속(Promise)을 캐시해 두 소비자가 한 번의 읽기를 나눈다. 실패도 함께 나눈다 — 각
 * 소비자가 자기 방식으로 센다. 실제로 읽기를 시작한 횟수(종목 수)는 `onLoad`로 센다 — 봉 캐시가 비어 외부
 * 공급자를 부르는 부하가 이 수에서 나온다.
 */
function createDailyBarsCache(
    load: AlertSourceDeps['loadDailyBars'],
    onLoad: () => void
): AlertSourceDeps['loadDailyBars'] {
    const cache = new Map<string, ReturnType<typeof load>>();
    return symbol => {
        const cached = cache.get(symbol);
        if (cached !== undefined) return cached;
        onLoad();
        const pending = load(symbol);
        cache.set(symbol, pending);
        return pending;
    };
}

/**
 * 진행 중인 가격대 알림을 일봉 종가로 판정해 구독자별 충족 목록을 돌려준다. 알림을 읽지 못하면(테이블이 없는
 * 경우는 호출자가 다룬다) 이번 실행은 알림 없이 진행한다 — 알림은 상태 없이 다시 판정되므로 잃는 것이 없다.
 */
async function loadPriceAlertFires(
    deps: MailAlertBatchDeps,
    loadDailyBars: AlertSourceDeps['loadDailyBars'],
    expected: ExpectedSessions,
    counts: MailAlertBatchCounts
): Promise<Pick<PriceAlertEvaluation, 'fires' | 'voids' | 'notReady'>> {
    try {
        const alerts = await deps.priceAlerts.listActiveForDelivery(
            expected.signals
        );
        const evaluation = await evaluatePriceAlerts(
            { loadDailyBars },
            alerts,
            expected
        );
        counts.priceAlertsActive = evaluation.active;
        counts.priceAlertBarErrors = evaluation.barErrors;
        return {
            fires: evaluation.fires,
            voids: evaluation.voids,
            notReady: evaluation.notReady,
        };
    } catch (error) {
        if (isMissingTableError(error)) throw error;
        console.error(
            '[mail-alert] price alert evaluation failed',
            redactDbErrorForLog(error)
        );
        return { fires: new Map(), voids: new Map(), notReady: new Map() };
    }
}

/**
 * 구독자별 등급. 연결된 회원만 읽고(비회원은 `free`) 등급을 읽지 못하면 `free`로 둔다 — 가격대 줄을 덜 받는 쪽이
 * 안전한 쪽이다. 회원 한 명을 한 번만 읽는다.
 */
async function resolveSubscriberTiers(
    deps: MailAlertBatchDeps,
    subscribers: readonly PreparedSubscriber[]
): Promise<Map<string, Tier>> {
    const resolveTier = deps.resolveTier;
    if (resolveTier === undefined) return new Map();
    const entries = await mapChunked(
        subscribers,
        MAIL_ALERT_LOOKUP_CONCURRENCY,
        async ({ target }): Promise<[string, Tier]> => {
            if (target.userId === null) return [target.id, 'free'];
            try {
                return [target.id, await resolveTier(target.userId)];
            } catch (error) {
                console.error(
                    `[mail-alert] tier lookup failed for ${target.id}`,
                    redactDbErrorForLog(error)
                );
                return [target.id, 'free'];
            }
        }
    );
    return new Map(entries);
}

/**
 * 가격대·진입 구간 줄의 근거가 되는 저장된 분석. 가격대를 볼 수 있는 등급(`free` 밖)의 구독자가 있을 때만 읽는다 —
 * 비회원만 있는 실행은 조회하지 않는다. 읽지 못하면 그 줄 없이 진행한다(추세·신호는 분석과 무관하다).
 */
async function loadChangeReferences(
    deps: MailAlertBatchDeps,
    symbols: readonly string[],
    tiers: readonly Tier[],
    alertDate: string
): Promise<ChangeReferenceInput> {
    const depthTiers = tiers.filter(tier => tier !== 'free');
    const load = deps.sources.loadChangeReferences;
    if (load === undefined || depthTiers.length === 0 || symbols.length === 0) {
        return { rows: new Map(), tiers: [] };
    }
    try {
        const notBefore = new Date(
            `${kstDateKeyDaysBefore(alertDate, MAIL_ALERT_CHANGE_REFERENCE_MAX_AGE_DAYS)}T00:00:00+09:00`
        );
        return { rows: await load(symbols, notBefore), tiers: depthTiers };
    } catch (error) {
        console.error(
            '[mail-alert] change reference read failed',
            redactDbErrorForLog(error)
        );
        return { rows: new Map(), tiers: [] };
    }
}

/** 등급별 "종목 → 달라진 점" 지도. 등급마다 한 번만 만든다(가격대 줄 + 추세 순). */
function createChangesByTier(
    readings: ReadonlyMap<string, SymbolReading>
): (tier: Tier) => ReadonlyMap<string, readonly MailAlertChange[]> {
    const cache = new Map<Tier, Map<string, readonly MailAlertChange[]>>();
    return tier => {
        const cached = cache.get(tier);
        if (cached !== undefined) return cached;
        const built = new Map(
            [...readings].map(
                ([symbol, reading]): [string, readonly MailAlertChange[]] => [
                    symbol,
                    [...(reading.byTier.get(tier) ?? []), ...reading.trend],
                ]
            )
        );
        cache.set(tier, built);
        return built;
    };
}

/** 번역자·라벨·고지는 구독자 로케일마다 한 번만 만든다. */
function createLocaleCache<T>(
    load: (locale: Locale) => Promise<T>
): (locale: Locale) => Promise<T> {
    const cache = new Map<Locale, Promise<T>>();
    return locale => {
        const cached = cache.get(locale);
        if (cached !== undefined) return cached;
        const pending = load(locale);
        cache.set(locale, pending);
        return pending;
    };
}

/**
 * 알림 메일 cron 한 번. 시간당 한 번 도는 이메일 리포트 cron이 함께 부르고, 한국 시간 7시(첫 슬롯)와
 * 8시(최종 슬롯)가 아니면 바로 끝난다.
 *
 * - **준비 게이트**: 소스마다 "기대 세션까지 왔다"는 지속 표지(`signal_events`의 마지막 기록 세션, 공포·탐욕
 *   판독의 마지막 날짜)를 읽는다. 첫 슬롯에서 하나라도 준비되지 않았으면 통째로 미룬다 — 기록기 장애를
 *   "조용한 날"로 착각해 보내지 않기 위해서다. 최종 슬롯은 준비된 소스만으로 보내고 빠진 소스를 로그로 남긴다.
 * - **하루 한 통**: 항목이 있는 구독자만 `(구독자, 알림 날짜)` 행을 보내기 전에 선점한다. 겹친 실행·두 슬롯이
 *   같은 구독자를 함께 처리해도 한쪽만 보내고, 제공자 멱등 키(`mailAlertIdempotencyKey`)가 선점 행이 사라진
 *   경우의 마지막 방어선이다. 항목이 없는 날은 선점도 기록도 하지 않는다.
 * - **재시도 없음**: 발송이 실패(`failed`)한 구독자는 같은 날 다시 보내지 않는다. 선점만 하고 프로세스가 죽어
 *   `pending`으로 남은 행도 같다 — 두 슬롯 모두 그 구독자를 `alreadyClaimed`로 건너뛰므로 그날 메일은 사라진다.
 *   중복 발송을 막는 대가로 받아들인 한 건의 손실이며, 다음 날은 새 행이라 영향이 없다. `pending` 행은
 *   `mail_alert_deliveries`에서 `status = 'pending'`으로 센다.
 * - **반복 방지**: 최근 `MAIL_ALERT_SUPPRESS_DAYS`일 안에 보낸(`sent`) 행과 선점만 하고 끝나지 않은(`pending`) 행의
 *   항목 키는 뺀다. `pending`도 세는 이유: 보낸 뒤 기록 전에 프로세스가 죽은 행일 수 있어, 세지 않으면 이미 받은
 *   소식이 다음 날 다시 간다(한 번 덜 받는 쪽보다 같은 소식을 두 번 받는 쪽이 더 나쁘다). 실패한(`failed`) 발송의
 *   항목은 받지 못한 것이라 세지 않는다.
 * - **담은 종목의 준비**: 첫 슬롯에서 담은 종목 중 하나라도 판정하지 못했으면(마지막 봉이 기대 세션이 아니거나
 *   일봉·시장 조회가 실패) 그 구독자는 선점하지 않고 최종 슬롯에 맡긴다 — 봉 캐시가 아직 덜 찬 아침에 그 종목이
 *   빠진 메일을 먼저 보내면 그날은 다시 보낼 수 없다. 최종 슬롯은 판정된 종목만으로 보내고 빠진 종목을 로그로 남긴다.
 * - **담은 종목은 봉으로 판정한다**: 구독자가 담은 종목(주제의 종목, 보유·관심종목)의 새 신호와 달라진 점은
 *   스캐너 대상 여부와 상관없이 그 종목의 일봉을 코어 `technicalChangesBetween`으로 읽는다. 신호 기록
 *   (`signal_events`)은 신호별 섹션만 읽는다. 마지막 봉이 기대 세션이 아니면 그 종목은 싣지 않는다(`noFreshBar`).
 * - **가격대 알림**: 준비 게이트를 통과한 뒤 진행 중인 알림을 일봉 종가로 판정한다(상태 없이 매번 다시 — 놓친
 *   날은 발송이 늦을 뿐이다). 판정 구간의 끝 봉을 읽지 못한 알림의 종목은 담은 종목과 같이 첫 슬롯에서 그 구독자를
 *   미룬다. 충족한 알림은 메일의 맨 앞 섹션에 실리고, 선점과 같은 트랜잭션에서 `fired`가 돼
 *   한 번만 알린다. 분할로 가격 척도가 달라진 알림(`PRICE_ALERT_SCALE_GUARD`)은 메일이 알리고, 보낸 뒤 `finish`가
 *   메일이 나가지 않았다고 확정되지 않은 경우에만 지운다.
 * - LLM을 부르지 않는다. 판정은 `signal_events`와 코어 함수(`detectNewConfirmedSignals`,
 *   `findExtremeZoneEntryOn`)가 한다.
 */
export async function runMailAlertBatch(
    deps: MailAlertBatchDeps,
    now: Date
): Promise<MailAlertBatchResult> {
    if (!deps.launched) return { status: 'disabled', reason: 'flag_off' };
    const slot = mailAlertSlot(now);
    if (slot === null) return { status: 'outside_window' };
    if (deps.secret === null) {
        console.error(
            '[mail-alert] EMAIL_REPORT_SIGNING_SECRET missing — skipping run'
        );
        return { status: 'no_secret' };
    }
    try {
        return await runInWindow(deps, deps.secret, slot, now);
    } catch (error) {
        if (!isMissingTableError(error)) throw error;
        console.log('[mail-alert] tables missing — skipping run');
        return { status: 'disabled', reason: 'missing_table' };
    }
}

async function runInWindow(
    deps: MailAlertBatchDeps,
    secret: string,
    slot: MailAlertSlot,
    now: Date
): Promise<MailAlertBatchResult> {
    const clock = deps.clock ?? Date.now;
    const startedAt = clock();
    const alertDate = mailAlertDate(now);
    const counts: MailAlertBatchCounts = {
        slot,
        alertDate,
        notReady: [],
        subscribers: 0,
        quiet: 0,
        sent: 0,
        failed: 0,
        alreadyClaimed: 0,
        deferredByDeadline: 0,
        suppressedItems: 0,
        computedSymbols: 0,
        noFreshBar: 0,
        computeErrors: 0,
        portfolioErrors: 0,
        deferredSymbolsNotReady: 0,
        pruned: 0,
        priceAlertsActive: 0,
        priceAlertsFired: 0,
        priceAlertsVoided: 0,
        priceAlertBarErrors: 0,
        priceAlertsPruned: 0,
        priceAlertSubscribersPruned: 0,
        changeSymbols: 0,
        changeLines: 0,
        changeBarErrors: 0,
        barLoads: 0,
        changeReferences: 0,
    };

    const expected = expectedSessions(now);
    const targets = await deps.subscribers.findAllForDelivery(expected.signals);
    counts.subscribers = targets.length;
    const topicSubscribers = targets.map(target => ({
        target,
        topics: topicsOf(target),
    }));

    const signalReady = await checkSignalReadiness(deps.sources, expected);
    const fearGreed = await loadFearGreedSources(
        deps.sources,
        fearGreedMarketsOf(topicSubscribers),
        expected
    );
    const notReady = [
        ...(signalReady.us ? [] : ['signals:us']),
        ...(signalReady.kr ? [] : ['signals:kr']),
        ...fearGreed.notReady,
    ];
    if (notReady.length > 0) {
        if (slot === 'first') {
            console.log(
                '[mail-alert] deferred to the final slot:',
                JSON.stringify(notReady)
            );
            return { status: 'deferred', notReady };
        }
        notReady.forEach(source =>
            console.warn(`[mail-alert] not ready at final slot: ${source}`)
        );
    }
    counts.notReady = notReady;

    // 게이트를 통과한 뒤에야 보유·관심종목을 읽는다 — 미뤄진 첫 슬롯은 그 I/O를 하지 않는다.
    const subscribers = await prepareSubscribers(
        deps,
        topicSubscribers,
        counts
    );

    const [usEpisodes, krEpisodes] = await Promise.all([
        signalReady.us
            ? loadEpisodes(deps.sources, 'us', expected.signals.us)
            : Promise.resolve([]),
        signalReady.kr
            ? loadEpisodes(deps.sources, 'kr', expected.signals.kr)
            : Promise.resolve([]),
    ]);
    const episodes: Record<
        SignalHistoryMarket,
        readonly MailAlertEpisodeRow[]
    > = {
        us: usEpisodes,
        kr: krEpisodes,
    };

    const loadDailyBars = createDailyBarsCache(
        deps.sources.loadDailyBars,
        () => {
            counts.barLoads += 1;
        }
    );
    const priceAlertEvaluation = await loadPriceAlertFires(
        deps,
        loadDailyBars,
        expected,
        counts
    );

    const lookupFailed = new Set<string>();
    const marketOf = await resolveMarkets(
        deps,
        watchedSymbolsOf(subscribers),
        counts,
        lookupFailed
    );
    // 담은 종목은 스캐너 대상이어도 모두 일봉으로 판정한다 — 신호 기록은 신호별 섹션만 읽는다.
    const computedTargets = [...marketOf].flatMap(([symbol, market]) =>
        market === null
            ? []
            : [{ symbol, market, sessionDate: expected.signals[market] }]
    );
    const tierOf = await resolveSubscriberTiers(deps, subscribers);
    const references = await loadChangeReferences(
        deps,
        computedTargets.map(target => target.symbol),
        [...new Set(tierOf.values())],
        alertDate
    );
    const computedSources = await loadComputedSources(
        { ...deps.sources, loadDailyBars },
        computedTargets,
        references
    );
    counts.computedSymbols = computedSources.computedSymbols;
    counts.noFreshBar = computedSources.noFreshBar;
    counts.computeErrors += computedSources.computeErrors;
    const symbolsNotReady = new Set([
        ...computedSources.notReadySymbols,
        ...lookupFailed,
    ]);
    // 가격대 알림의 종목은 구독자별로 미룬다(`processOne`). 로그에는 함께 남긴다.
    const allSymbolsNotReady = new Set([
        ...symbolsNotReady,
        ...[...priceAlertEvaluation.notReady.values()].flatMap(symbols => [
            ...symbols,
        ]),
    ]);
    if (slot === 'final' && allSymbolsNotReady.size > 0) {
        // 종목 코드만 남긴다(구독자 식별자, 주소 없음). 오류 내용은 종목별 로그가 가려서 이미 남겼다(SA-26).
        console.warn(
            '[mail-alert] symbols not ready at final slot:',
            JSON.stringify([...allSymbolsNotReady].toSorted())
        );
    }
    const namesFor = createSymbolNamesCache(deps);
    counts.changeBarErrors = computedSources.barLoadErrors;
    counts.changeReferences = computedSources.referencesUsed;
    counts.changeSymbols = [...computedSources.readings.values()].filter(
        reading =>
            reading.trend.length > 0 ||
            [...reading.byTier.values()].some(lines => lines.length > 0)
    ).length;
    const changesFor = createChangesByTier(computedSources.readings);

    const recent = await deps.deliveries.recentItemKeys(
        kstDateKeyDaysBefore(alertDate, MAIL_ALERT_SUPPRESS_DAYS)
    );
    const translatorFor = createLocaleCache(deps.getTranslator);
    const signalLabelFor = createLocaleCache(deps.getSignalLabel);
    const disclaimerFor = createLocaleCache(deps.getDisclaimer);

    function planFor(subscriber: PreparedSubscriber): MailAlertPlan {
        return planMailAlertItems({
            topics: subscriber.topics,
            portfolioSymbols: subscriber.portfolioSymbols,
            marketOf,
            episodes,
            episodeSessions: expected.signals,
            computed: computedSources.computed,
            changes: changesFor(tierOf.get(subscriber.target.id) ?? 'free'),
            fearGreed: fearGreed.entries,
            suppressed: recent.get(subscriber.target.id) ?? new Set<string>(),
            priceAlerts:
                priceAlertEvaluation.fires.get(subscriber.target.id) ?? [],
            voidedPriceAlerts:
                priceAlertEvaluation.voids.get(subscriber.target.id) ?? [],
        });
    }

    async function sendPhase(
        buildMessage: () => Promise<
            Parameters<KeyedEmailDispatcher['sendKeyedEmail']>[0]
        >
    ): Promise<SendResult> {
        const built = await buildMessage().then(
            message => ({ ok: true as const, message }),
            (error: unknown) => ({ ok: false as const, error })
        );
        if (!built.ok) {
            return { kind: 'threw', error: built.error, mailNotSent: true };
        }
        // 발송기가 동기로 던져도 거절된 약속과 같이 "보내다 던짐"으로 다룬다(finish가 반드시 돈다).
        return Promise.resolve()
            .then(() => deps.dispatcher.sendKeyedEmail(built.message))
            .then(
                (outcome): SendResult =>
                    countsAsSent(outcome)
                        ? { kind: 'accepted', mailNotSent: false }
                        : { kind: 'rejected', mailNotSent: true },
                (error: unknown): SendResult => ({
                    kind: 'threw',
                    error,
                    mailNotSent: false,
                })
            );
    }

    /**
     * 발송 결과를 기록하고 센다. 기록을 남겼으면 `true`. 받아 준 메일·거절의 기록이 던지면 실패로 세고 실패 기록을
     * 한 번 더 시도한다(그 기록도 못 남기면 로그만 남긴다).
     */
    async function settleDelivery(
        subscriberId: string,
        claimId: string,
        recordedKeys: readonly string[],
        sent: SendResult
    ): Promise<boolean> {
        const recordFailure = async (error: unknown): Promise<boolean> => {
            counts.failed += 1;
            console.error(
                `[mail-alert] delivery failed for ${subscriberId}`,
                redactDbErrorForLog(error)
            );
            return deps.deliveries
                .finish(
                    claimId,
                    'failed',
                    recordedKeys,
                    errorText(error),
                    sent.mailNotSent
                )
                .then(
                    () => true,
                    (finishError: unknown) => {
                        console.error(
                            '[mail-alert] could not record failure',
                            redactDbErrorForLog(finishError)
                        );
                        return false;
                    }
                );
        };
        if (sent.kind === 'threw') return recordFailure(sent.error);
        const accepted = sent.kind === 'accepted';
        try {
            await deps.deliveries.finish(
                claimId,
                accepted ? 'sent' : 'failed',
                recordedKeys,
                accepted ? null : 'dispatcher rejected',
                sent.mailNotSent
            );
        } catch (error) {
            return recordFailure(error);
        }
        if (accepted) counts.sent += 1;
        else counts.failed += 1;
        return true;
    }

    async function deliver(
        subscriber: PreparedSubscriber,
        planned: MailAlertPlan
    ): Promise<void> {
        const { target } = subscriber;
        // 싣지 못한 후보(줄 수 상한)의 키도 함께 남긴다 — 같은 세션이 이어지는 날 넘친 줄이 다시 올라오지 않는다.
        const keysOf = (plan: MailAlertPlan) => [
            ...plan.itemKeys,
            ...plan.overflowKeys,
        ];
        // 알림은 선점과 같은 트랜잭션에서 `fired`가 된다 — 선점이 이긴 메일 한 통에만 실린다. 메일이 나가지
        // 않았다고 확정되면(제공자의 확정적 거절, 보내기 전의 실패) `finish`가 그 알림을 되살리고 끝낸 알림도 남겨
        // 다음 실행이 다시 알린다. 보내다 던져 나갔는지 알 수 없는 경우만 fired인 채로 둔다(중복 대신 한 건의
        // 손실, 하루 한 통 규칙과 같은 대가).
        const claim = await deps.deliveries.claim(
            target.id,
            alertDate,
            keysOf(planned),
            planned.sections.priceAlerts.map(alert => ({
                id: alert.alertId,
                session: alert.firedSession,
                close: alert.firedClose,
            }))
        );
        if (claim === null) {
            counts.alreadyClaimed += 1;
            return;
        }
        const claimId = claim.id;
        // 판정과 선점 사이에 지워진(또는 이미 알린) 알림은 선점이 `fired`로 바꾸지 못했다 — 메일에 싣지 않는다.
        const plan = keepFiredPriceAlerts(planned, claim.firedAlertIds);
        const recordedKeys = keysOf(plan);
        if (plan.itemKeys.length === 0) {
            // 실을 것이 그 알림뿐이었다. 빈 메일은 보내지 않고, 선점 행은 보내지 않은 기록으로 닫는다.
            counts.quiet += 1;
            await deps.deliveries.finish(
                claimId,
                'failed',
                recordedKeys,
                'nothing left to send',
                true
            );
            return;
        }
        counts.priceAlertsFired += plan.sections.priceAlerts.length;
        counts.changeLines += plan.sections.mine.filter(
            item => item.kind === 'change'
        ).length;
        const buildMessage = async () => {
            const [t, signalLabel, disclaimer] = await Promise.all([
                translatorFor(target.locale),
                signalLabelFor(target.locale),
                disclaimerFor(target.locale),
            ]);
            return buildMailAlertEmail({
                to: target.email,
                locale: target.locale,
                alertDate,
                plan,
                siteUrl: deps.siteUrl,
                manageUrl: buildMailAlertManageUrl(
                    deps.siteUrl,
                    secret,
                    target.locale,
                    target.id
                ),
                unsubscribePageUrl: buildMailAlertUnsubscribePageUrl(
                    deps.siteUrl,
                    secret,
                    target.locale,
                    target.id
                ),
                unsubscribeApiUrl: buildMailAlertUnsubscribeApiUrl(
                    deps.siteUrl,
                    secret,
                    target.id,
                    target.locale
                ),
                disclaimer,
                idempotencyKey: mailAlertIdempotencyKey(target.id, alertDate),
                t,
                signalLabel,
                symbolNames: await namesFor(plannedSymbols(plan)),
            });
        };
        const sent = await sendPhase(buildMessage);
        const settled = await settleDelivery(
            target.id,
            claimId,
            recordedKeys,
            sent
        );
        // 끝낸 알림은 `finish`가 메일이 나간 뒤에만 지운다(나가지 않았으면 남아 다음 실행이 다시 알린다).
        if (
            settled &&
            !sent.mailNotSent &&
            plan.sections.voidedPriceAlerts.length > 0
        ) {
            counts.priceAlertsVoided += plan.sections.voidedPriceAlerts.length;
            plan.sections.voidedPriceAlerts.forEach(alert =>
                console.warn(
                    `[price-alert] voided by price-scale change: ${alert.alertId}`
                )
            );
            // 끝낸 알림이 마지막 받을 것이었으면 구독자도 지운다 — 삭제 뒤에만 한다(보낸 뒤라 발송 기록이 함께
            // 사라져도 된다).
            try {
                await deps.priceAlerts.removeSubscriberIfNothingToReceive(
                    target.id
                );
            } catch (error) {
                console.error(
                    `[mail-alert] could not clean up subscriber ${target.id}`,
                    redactDbErrorForLog(error)
                );
            }
        }
    }

    async function processOne(subscriber: PreparedSubscriber): Promise<void> {
        if (
            slot === 'first' &&
            (watchedOf(subscriber).some(symbol =>
                symbolsNotReady.has(symbol)
            ) ||
                priceAlertEvaluation.notReady.has(subscriber.target.id))
        ) {
            counts.deferredSymbolsNotReady += 1;
            return;
        }
        const plan = planFor(subscriber);
        counts.suppressedItems += plan.suppressedCount;
        if (plan.itemKeys.length === 0) {
            counts.quiet += 1;
            return;
        }
        await deliver(subscriber, plan);
    }

    const queue = { next: 0 };
    async function worker(): Promise<void> {
        while (queue.next < subscribers.length) {
            if (clock() - startedAt > MAIL_ALERT_DEADLINE_MS) {
                counts.deferredByDeadline = subscribers.length - queue.next;
                queue.next = subscribers.length;
                return;
            }
            const subscriber = subscribers[queue.next++];
            if (subscriber === undefined) return;
            try {
                await processOne(subscriber);
            } catch (error) {
                // 선점 자체가 실패한 경우 — 기록할 행이 없으니 로그만 남긴다.
                counts.failed += 1;
                console.error(
                    `[mail-alert] claim failed for ${subscriber.target.id}`,
                    redactDbErrorForLog(error)
                );
            }
        }
    }
    await Promise.all(
        Array.from(
            { length: Math.min(MAIL_ALERT_WORKERS, subscribers.length) },
            worker
        )
    );

    try {
        const prunedAlerts = await deps.priceAlerts.pruneExpiredAndFired(
            alertDate,
            expected.signals
        );
        counts.priceAlertsPruned = prunedAlerts.alertsDeleted;
        counts.priceAlertSubscribersPruned = prunedAlerts.subscribersDeleted;
    } catch (error) {
        console.error(
            '[mail-alert] price alert prune failed',
            redactDbErrorForLog(error)
        );
    }
    try {
        counts.pruned = await deps.deliveries.pruneBefore(
            kstDateKeyDaysBefore(alertDate, MAIL_ALERT_DELIVERY_RETENTION_DAYS)
        );
    } catch (error) {
        console.error('[mail-alert] prune failed', redactDbErrorForLog(error));
    }
    return { status: 'done', counts };
}
