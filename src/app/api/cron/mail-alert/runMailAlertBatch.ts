import 'server-only';
import { isMissingTableError } from '@/entities/mail-alert/lib/dbErrorKind';
import {
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
    planMailAlertItems,
    type MailAlertEpisodeRow,
    type MailAlertPlan,
} from '@/entities/mail-alert/lib/planMailAlertItems';
import { rowToTopic } from '@/entities/mail-alert/lib/topics';
import type {
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
} from '@/shared/db/types';
import type { EmailDispatcher } from '@/shared/email/types';
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
} from './collectAlertSources';

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
    readonly sources: AlertSourceDeps;
    /** 시장별 스캐너 대상 종목. */
    readonly universe: Readonly<
        Record<SignalHistoryMarket, ReadonlySet<string>>
    >;
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
    readonly dispatcher: EmailDispatcher;
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
    computedSymbols: number;
    noFreshBar: number;
    /** 일봉 판정이나 종목 → 시장 판정이 실패한 종목 수. */
    computeErrors: number;
    /** 보유·관심종목을 읽지 못해 이번 실행에서 건너뛴 구독자(선점하지 않았으니 다음 슬롯이 다시 본다). */
    portfolioErrors: number;
    pruned: number;
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

async function resolveMarkets(
    deps: MailAlertBatchDeps,
    symbols: readonly string[],
    counts: MailAlertBatchCounts
): Promise<Map<string, SignalHistoryMarket | null>> {
    const entries = await mapChunked(
        symbols,
        MAIL_ALERT_LOOKUP_CONCURRENCY,
        async (symbol): Promise<[string, SignalHistoryMarket | null]> => {
            try {
                return [symbol, await deps.resolveMarket(symbol)];
            } catch (error) {
                counts.computeErrors += 1;
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
 * - **반복 방지**: 최근 `MAIL_ALERT_SUPPRESS_DAYS`일 안에 보낸(`sent`) 항목 키는 뺀다. 실패한 발송의 항목은
 *   받지 못한 것이라 세지 않는다.
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
        pruned: 0,
    };

    const targets = await deps.subscribers.findAllForDelivery(alertDate);
    counts.subscribers = targets.length;
    const topicSubscribers = targets.map(target => ({
        target,
        topics: topicsOf(target),
    }));

    const expected = expectedSessions(now);
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

    const marketOf = await resolveMarkets(
        deps,
        watchedSymbolsOf(subscribers),
        counts
    );
    const computedTargets = [...marketOf].flatMap(([symbol, market]) =>
        market === null || deps.universe[market].has(symbol)
            ? []
            : [{ symbol, sessionDate: expected.signals[market] }]
    );
    const computedSources = await loadComputedSources(
        deps.sources,
        computedTargets
    );
    counts.computedSymbols = computedSources.computedSymbols;
    counts.noFreshBar = computedSources.noFreshBar;
    counts.computeErrors += computedSources.computeErrors;

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
            universe: deps.universe,
            computed: computedSources.computed,
            fearGreed: fearGreed.entries,
            suppressed: recent.get(subscriber.target.id) ?? new Set<string>(),
        });
    }

    async function deliver(
        subscriber: PreparedSubscriber,
        plan: MailAlertPlan
    ): Promise<void> {
        const { target } = subscriber;
        // 싣지 못한 후보(줄 수 상한)의 키도 함께 남긴다 — 같은 세션이 이어지는 날 넘친 줄이 다시 올라오지 않는다.
        const recordedKeys = [...plan.itemKeys, ...plan.overflowKeys];
        const claimId = await deps.deliveries.claim(
            target.id,
            alertDate,
            recordedKeys
        );
        if (claimId === null) {
            counts.alreadyClaimed += 1;
            return;
        }
        try {
            const [t, signalLabel, disclaimer] = await Promise.all([
                translatorFor(target.locale),
                signalLabelFor(target.locale),
                disclaimerFor(target.locale),
            ]);
            const message = buildMailAlertEmail({
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
            });
            const accepted = await deps.dispatcher.sendEmail(message);
            await deps.deliveries.finish(
                claimId,
                accepted ? 'sent' : 'failed',
                recordedKeys,
                accepted ? null : 'dispatcher rejected'
            );
            if (accepted) counts.sent += 1;
            else counts.failed += 1;
        } catch (error) {
            counts.failed += 1;
            console.error(
                `[mail-alert] delivery failed for ${target.id}`,
                redactDbErrorForLog(error)
            );
            await deps.deliveries
                .finish(claimId, 'failed', recordedKeys, errorText(error))
                .catch(finishError =>
                    console.error(
                        '[mail-alert] could not record failure',
                        redactDbErrorForLog(finishError)
                    )
                );
        }
    }

    async function processOne(subscriber: PreparedSubscriber): Promise<void> {
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
        counts.pruned = await deps.deliveries.pruneBefore(
            kstDateKeyDaysBefore(alertDate, MAIL_ALERT_DELIVERY_RETENTION_DAYS)
        );
    } catch (error) {
        console.error('[mail-alert] prune failed', redactDbErrorForLog(error));
    }
    return { status: 'done', counts };
}
