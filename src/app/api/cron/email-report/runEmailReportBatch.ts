import 'server-only';
import { EMAIL_REPORT_MAX_SYMBOLS } from '@/entities/email-report/lib/emailReportConstants';
import {
    selectReportSymbols,
    type ReportHolding,
} from '@/entities/email-report/lib/buildSymbolReport';
import { isDueAt, toLocalSlot } from '@/entities/email-report/lib/localSlot';
import {
    buildChartImageUrl,
    buildSymbolPageUrl,
    buildUnsubscribeApiUrl,
    buildUnsubscribePageUrl,
} from '@/entities/email-report/lib/reportLinks';
import type { SymbolReport } from '@/entities/email-report/reportModel';
import {
    buildReportEmail,
    type ReportEmailTranslator,
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
const ERROR_MAX_LENGTH = 500;

export interface EmailReportBatchDeps {
    subscriptions: Pick<
        EmailReportSubscriptionRepository,
        'findEnabledRecipients'
    >;
    deliveries: EmailReportDeliveryRepository;
    findHoldings: (userId: string) => Promise<ReportHolding[]>;
    loadReport: (symbol: string, locale: Locale) => Promise<SymbolReport>;
    getTranslator: (locale: Locale) => Promise<ReportEmailTranslator>;
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
            symbols = selectReportSymbols(
                await deps.findHoldings(recipient.userId),
                EMAIL_REPORT_MAX_SYMBOLS
            );
            if (symbols.length === 0) {
                await deps.deliveries.finish(claimId, 'skipped', [], null);
                counts.skipped += 1;
                return;
            }
            const { locale } = recipient;
            const [reports, t] = await Promise.all([
                Promise.all(symbols.map(s => reportFor(s, locale))),
                translatorFor(locale),
            ]);
            const email = buildReportEmail({
                to: recipient.email,
                locale,
                localDate,
                sections: reports.map(report => ({
                    report,
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
