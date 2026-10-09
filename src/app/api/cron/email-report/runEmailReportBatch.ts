import 'server-only';
import {
    selectReportSymbols,
    type ReportHolding,
    type ReportWatchlistItem,
} from '@/entities/email-report/lib/selectReportSymbols';
import { isDueAt, toLocalSlot } from '@/entities/email-report/lib/localSlot';
import {
    buildChartImageUrl,
    buildSymbolPageUrl,
    buildUnsubscribeApiUrl,
    buildUnsubscribePageUrl,
} from '@/entities/email-report/lib/reportLinks';
import type {
    SymbolBrief,
    SymbolReport,
} from '@/entities/email-report/reportModel';
import {
    buildReportEmail,
    type ReportEmailTranslator,
    type SignalLabelResolver,
} from '@/entities/email-report/templates/reportEmail';
import type {
    EmailReportDeliveryRepository,
    EmailReportRecipient,
    EmailReportSubscriptionRepository,
} from '@/shared/db/types';
import type { EmailDispatcher } from '@/shared/email/types';
import { localePath, type Locale } from '@/shared/i18n/locales';

/** 발송 기록 보관 기간 — 그보다 오래된 행은 매 실행 끝에 지운다. */
export const DELIVERY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
/** 동시에 처리하는 회원 수. Resend 초당 한도와 FMP·DB 부하 사이의 타협. */
export const RECIPIENT_CONCURRENCY = 4;
/**
 * 새 회원 처리를 시작하는 마감. cron이 매시 돌므로 다음 실행과 겹치기 전에 멈춘다 —
 * 마감 뒤에 남은 회원은 선점하지 않으므로 기록도 없이 그날을 건너뛴다(로그로 남긴다).
 */
export const BATCH_DEADLINE_MS = 45 * 60 * 1000;
/**
 * 한 회원의 요약 데이터(일봉)를 동시에 받는 종목 수. 최대 20종목/통을 한 번에 던지지 않는다(CC-1).
 * 회원이 `RECIPIENT_CONCURRENCY`명 동시에 돌므로 요약(일봉) 경로의 동시 조회 최악은 그 곱(20)이다.
 * 전체 카드의 리포트 로드(`reportFor`)는 같은 회원 안에서 이 청크와 나란히 돌아 이 상한에
 * 포함되지 않는다 — 배치 전체의 업스트림 호출 상한이 아니다.
 */
export const BRIEF_CONCURRENCY = 5;
const ERROR_MAX_LENGTH = 500;

export interface EmailReportBatchDeps {
    subscriptions: Pick<
        EmailReportSubscriptionRepository,
        'findEnabledRecipients'
    >;
    deliveries: EmailReportDeliveryRepository;
    findHoldings: (userId: string) => Promise<ReportHolding[]>;
    findWatchlist: (userId: string) => Promise<ReportWatchlistItem[]>;
    loadReport: (symbol: string, locale: Locale) => Promise<SymbolReport>;
    /** 로케일 무관 경량 경로 — `(symbol)`마다 배치 안에서 한 번. */
    loadBrief: (symbol: string) => Promise<SymbolBrief>;
    getTranslator: (locale: Locale) => Promise<ReportEmailTranslator>;
    getSignalLabel: (locale: Locale) => Promise<SignalLabelResolver>;
    dispatcher: EmailDispatcher;
    secret: string;
    siteUrl: string;
    /** 테스트가 마감을 당길 수 있게 주입한다. */
    clock?: () => number;
}

export interface EmailReportBatchCounts {
    due: number;
    sent: number;
    failed: number;
    skipped: number;
    /** 다른 실행이 이미 선점한 회원. */
    alreadyClaimed: number;
    /** 마감으로 손대지 못한 회원. */
    deferred: number;
    pruned: number;
}

interface DueRecipient {
    recipient: EmailReportRecipient;
    localDate: string;
}

function errorText(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.slice(0, ERROR_MAX_LENGTH);
}

/**
 * `items`를 `size`개씩 순서대로 처리한다 — 결과 순서는 입력 순서.
 * 청크를 직렬로 돌리는 이유: 한 번에 떠 있는 조회를 `size`개로 묶기 위해서다.
 * reduce가 프라미스 체인을 만들어, 앞 청크가 끝나야 다음 청크의 `work`가 시작된다.
 */
function mapChunked<T, R>(
    items: readonly T[],
    size: number,
    work: (item: T) => Promise<R>
): Promise<R[]> {
    const chunks = Array.from(
        { length: Math.ceil(items.length / size) },
        (_, i) => items.slice(i * size, (i + 1) * size)
    );
    return chunks.reduce<Promise<R[]>>(
        (previous, chunk) =>
            previous.then(done =>
                Promise.all(chunk.map(work)).then(rows => [...done, ...rows])
            ),
        Promise.resolve([])
    );
}

/** 요약 조회 결과에 그 종목이 없을 때의 빈 칸 — 메일은 그 종목을 "데이터 없음"으로 그린다. */
function noDataBrief(symbol: string): SymbolBrief {
    return {
        symbol,
        close: null,
        changePercent: null,
        trend: null,
        signals: null,
    };
}

/** 이 시각 슬롯에 보낼 회원. 타임존이 깨진 행은 건너뛴다(루프를 멈추지 않는다). */
export function selectDueRecipients(
    recipients: readonly EmailReportRecipient[],
    now: Date
): DueRecipient[] {
    return recipients.flatMap(recipient => {
        const slot = toLocalSlot(now, recipient.timezone);
        return slot !== null &&
            isDueAt(slot, recipient.daysOfWeek, recipient.sendHour)
            ? [{ recipient, localDate: slot.localDate }]
            : [];
    });
}

/**
 * 매시 cron 한 번의 메일 리포트 발송.
 *
 * - 회원마다 `(user, 로컬 날짜)`를 **보내기 전에 선점**한다. 겹친 실행·재시도가 같은
 *   회원에게 두 통을 보내지 못한다. 발송이 실패해도 그날 다시 보내지 않는다 — 실패한
 *   메일을 다음 시각에 몰아 보내는 것보다 하루 건너뛰는 편이 회원 기대에 맞다.
 * - 종목 데이터는 `(symbol, locale)`마다 한 번만 모은다. 같은 종목을 가진 회원 100명이
 *   있어도 조회는 한 번이다.
 *   요약 데이터(일봉·신호)는 `(symbol)`마다 한 번만 모은다(로케일 무관).
 * - 새 AI 분석은 돌리지 않는다(`loadSymbolReport` JSDoc).
 */
export async function runEmailReportBatch(
    deps: EmailReportBatchDeps,
    now: Date
): Promise<EmailReportBatchCounts> {
    const clock = deps.clock ?? Date.now;
    const startedAt = clock();
    const counts: EmailReportBatchCounts = {
        due: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        alreadyClaimed: 0,
        deferred: 0,
        pruned: 0,
    };

    const due = selectDueRecipients(
        await deps.subscriptions.findEnabledRecipients(),
        now
    );
    counts.due = due.length;

    const reportCache = new Map<string, Promise<SymbolReport>>();
    const reportFor = (symbol: string, locale: Locale) => {
        const key = `${symbol}\u0000${locale}`;
        let pending = reportCache.get(key);
        if (pending === undefined) {
            pending = deps.loadReport(symbol, locale);
            reportCache.set(key, pending);
        }
        return pending;
    };
    const translatorCache = new Map<Locale, Promise<ReportEmailTranslator>>();
    const translatorFor = (locale: Locale) => {
        let pending = translatorCache.get(locale);
        if (pending === undefined) {
            pending = deps.getTranslator(locale);
            translatorCache.set(locale, pending);
        }
        return pending;
    };

    // 요약 표용 캐시는 로케일과 무관해 `reportFor`와 **따로** 둔다. 둘 다 배치 한 번 안에서만 산다.
    const briefCache = new Map<string, Promise<SymbolBrief>>();
    const briefFor = (symbol: string) => {
        let pending = briefCache.get(symbol);
        if (pending === undefined) {
            pending = deps.loadBrief(symbol);
            briefCache.set(symbol, pending);
        }
        return pending;
    };
    const signalLabelCache = new Map<Locale, Promise<SignalLabelResolver>>();
    const signalLabelFor = (locale: Locale) => {
        let pending = signalLabelCache.get(locale);
        if (pending === undefined) {
            pending = deps.getSignalLabel(locale);
            signalLabelCache.set(locale, pending);
        }
        return pending;
    };

    async function processOne({ recipient, localDate }: DueRecipient) {
        const claimId = await deps.deliveries.claim(
            recipient.userId,
            localDate
        );
        if (claimId === null) {
            counts.alreadyClaimed += 1;
            return;
        }
        let symbols: string[] = [];
        try {
            const [holdings, watchlist] = await Promise.all([
                deps.findHoldings(recipient.userId),
                deps.findWatchlist(recipient.userId),
            ]);
            const selection = selectReportSymbols({ holdings, watchlist });
            symbols = [...selection.full, ...selection.brief];
            if (symbols.length === 0) {
                await deps.deliveries.finish(claimId, 'skipped', [], null);
                counts.skipped += 1;
                return;
            }
            const { locale } = recipient;
            // 요약 조회는 전체 카드·요약 행을 한 줄로 묶어 청크로 돌린다 — 회원 한 명당 동시에
            // 떠 있는 일봉 조회가 BRIEF_CONCURRENCY를 넘지 않는다(최악 RECIPIENT_CONCURRENCY ×
            // BRIEF_CONCURRENCY = 20). 전체 카드의 리포트 로드는 이 청크와 나란히 돈다.
            const [reports, briefs, t, signalLabel] = await Promise.all([
                Promise.all(selection.full.map(s => reportFor(s, locale))),
                mapChunked(symbols, BRIEF_CONCURRENCY, briefFor),
                translatorFor(locale),
                signalLabelFor(locale),
            ]);
            const briefBySymbol = new Map(briefs.map(b => [b.symbol, b]));
            const briefOf = (symbol: string) =>
                briefBySymbol.get(symbol) ?? noDataBrief(symbol);
            const email = buildReportEmail({
                to: recipient.email,
                locale,
                localDate,
                sections: reports.map(report => ({
                    report,
                    brief: briefOf(report.symbol),
                    chartUrl: buildChartImageUrl(
                        deps.siteUrl,
                        deps.secret,
                        report.symbol,
                        localDate
                    ),
                    pageUrl: buildSymbolPageUrl(
                        deps.siteUrl,
                        locale,
                        report.symbol
                    ),
                })),
                briefRows: selection.brief.map(symbol => ({
                    brief: briefOf(symbol),
                    pageUrl: buildSymbolPageUrl(deps.siteUrl, locale, symbol),
                })),
                unsubscribePageUrl: buildUnsubscribePageUrl(
                    deps.siteUrl,
                    deps.secret,
                    locale,
                    recipient.userId
                ),
                unsubscribeApiUrl: buildUnsubscribeApiUrl(
                    deps.siteUrl,
                    deps.secret,
                    recipient.userId
                ),
                settingsUrl: `${deps.siteUrl}${localePath(locale, '/email-report')}`,
                t,
                signalLabel,
            });
            const accepted = await deps.dispatcher.sendEmail(email);
            await deps.deliveries.finish(
                claimId,
                accepted ? 'sent' : 'failed',
                symbols,
                accepted ? null : 'dispatcher rejected'
            );
            if (accepted) counts.sent += 1;
            else counts.failed += 1;
        } catch (error) {
            counts.failed += 1;
            console.error(
                `[email-report] delivery failed for ${recipient.userId}`,
                error
            );
            await deps.deliveries
                .finish(claimId, 'failed', symbols, errorText(error))
                .catch(finishError =>
                    console.error(
                        '[email-report] could not record failure',
                        finishError
                    )
                );
        }
    }

    let next = 0;
    async function worker() {
        while (next < due.length) {
            if (clock() - startedAt > BATCH_DEADLINE_MS) {
                counts.deferred = due.length - next;
                next = due.length;
                return;
            }
            const item = due[next++]!;
            try {
                await processOne(item);
            } catch (error) {
                // 선점 자체가 실패한 경우 — 기록할 행이 없으니 로그만 남긴다.
                counts.failed += 1;
                console.error(
                    `[email-report] claim failed for ${item.recipient.userId}`,
                    error
                );
            }
        }
    }
    await Promise.all(
        Array.from(
            { length: Math.min(RECIPIENT_CONCURRENCY, due.length) },
            worker
        )
    );

    try {
        counts.pruned = await deps.deliveries.pruneOlderThan(
            new Date(now.getTime() - DELIVERY_RETENTION_MS)
        );
    } catch (error) {
        console.error('[email-report] prune failed', error);
    }
    return counts;
}
