import 'server-only';
import {
    WELCOME_STALE_SENDING_MS,
    WELCOME_SUPPRESSES_REPORT_MS,
} from '@/entities/email-report/lib/emailReportConstants';
import { isDueAt, toLocalSlot } from '@/entities/email-report/lib/localSlot';
import {
    buildChartImageUrl,
    buildMarketPageUrl,
    buildSymbolPageUrl,
    buildUnsubscribeApiUrl,
    buildUnsubscribePageUrl,
} from '@/entities/email-report/lib/reportLinks';
import {
    selectReportSymbols,
    type ReportHolding,
    type ReportWatchlistItem,
} from '@/entities/email-report/lib/selectReportSymbols';
import type {
    SymbolBrief,
    SymbolReport,
} from '@/entities/email-report/reportModel';
import { buildReportEmail } from '@/entities/email-report/templates/reportEmail';
import type {
    ReportEmailTranslator,
    ReportEmailWelcome,
    SignalLabelResolver,
    SkillLabelResolver,
} from '@/entities/email-report/templates/reportEmailTypes';
import {
    redactDbErrorForLog,
    redactedErrorMessage,
} from '@/shared/db/redactDbErrorForLog';
import type {
    EmailReportDeliveryRepository,
    EmailReportRecipient,
    EmailReportSubscriptionRepository,
    EmailReportWelcomeRecipient,
    EmailReportWelcomeRepository,
} from '@/shared/db/types';
import type { EmailMessage, KeyedEmailDispatcher } from '@/shared/email/types';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { mapChunked } from '@/shared/lib/mapChunked';
import type { SymbolDrawings } from './loadSymbolDrawings';

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
 * 한 회원의 요약 데이터(일봉과 종목 이름 조회)를 동시에 받는 종목 수. 최대 20종목/통을 한 번에 던지지 않는다(CC-1).
 * 회원이 `RECIPIENT_CONCURRENCY`명 동시에 돌므로 요약(일봉·이름) 경로의 동시 종목 수 최악은 그 곱(20)이다.
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
    /** 가입 때 메일 리포트를 고른 회원의 첫 리포트 기록. */
    welcomes: EmailReportWelcomeRepository;
    findHoldings: (userId: string) => Promise<ReportHolding[]>;
    findWatchlist: (userId: string) => Promise<ReportWatchlistItem[]>;
    /** 회원이 리포트에서 뺀 심볼. */
    findExcludedSymbols: (userId: string) => Promise<string[]>;
    loadReport: (symbol: string, locale: Locale) => Promise<SymbolReport>;
    /** 로케일 무관 경량 경로 — `(symbol)`마다 배치 안에서 한 번. */
    loadBrief: (symbol: string) => Promise<SymbolBrief>;
    /**
     * 보유·관심종목이 없는 회원에게 보낼 시장 브리핑 종목(그날 신호가 잡힌 대표 종목). 배치 안에서 한 번만
     * 부른다. 비면 그 회원은 지금처럼 건너뛴다.
     */
    loadMarketPicks: () => Promise<string[]>;
    /**
     * 종목들의 차트에 그려지는 분석 작도. 이미지가 `localDate`까지의 봉으로 그려지므로 범례도 같은 날짜로
     * 계산한다. 배치 안에서 (종목, 날짜)마다 한 번만 부른다(아직 모르는 것만 묶어서). 그릴 작도가 없는 종목은
     * 결과에 없다.
     */
    loadDrawings: (
        symbols: string[],
        localDate: string
    ) => Promise<Map<string, SymbolDrawings>>;
    getTranslator: (locale: Locale) => Promise<ReportEmailTranslator>;
    getSignalLabel: (locale: Locale) => Promise<SignalLabelResolver>;
    getSkillLabel: (locale: Locale) => Promise<SkillLabelResolver>;
    dispatcher: KeyedEmailDispatcher;
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
    /** `sent` 중 보유·관심종목이 없어 시장 브리핑으로 보낸 회원. */
    marketBriefings: number;
    /**
     * 차트에 분석 작도가 그려진 카드 수 / 작도 없이 캔들·이동평균만 나간 카드 수(전체 카드 기준).
     * 정기 회차와 가입 첫 리포트의 카드를 함께 센다(둘 다 `composeEmail`을 거친다).
     */
    drawingsCards: number;
    drawingsNone: number;
    /** 다른 실행이 이미 선점한 회원. */
    alreadyClaimed: number;
    /** 첫 리포트를 보낸 회원. */
    welcomeSent: number;
    /** 첫 리포트 발송이 실패해 `failed`로 기록한 회원(재시도 창 안이면 다음 실행이 다시 잡는다). */
    welcomeFailed: number;
    /** 메일은 나갔지만(`welcomeSent`에 포함) `sent` 기록이 실패한 회원. 행은 `sending`으로 남는다. */
    welcomeFinishFailed: number;
    /** 같은 멱등 키의 요청이 처리 중이라 시도를 쓰지 않고 다음 실행으로 미룬 첫 리포트. */
    welcomeRetryLater: number;
    /** `welcomeSent` 중 실을 종목이 없어 안내와 샘플 링크만 담아 보낸 회원. */
    welcomeFallback: number;
    /** 첫 리포트를 최근에 받아 이번 정기 회차를 건너뛴 회원. */
    suppressedByWelcome: number;
    /** 지운 첫 리포트 기록 수. */
    welcomePruned: number;
    /** 마감으로 손대지 못한 회원. */
    deferred: number;
    pruned: number;
}

/** `composeEmail`의 결과. `symbols`는 메일에 실린 종목이고 `marketBriefing`은 시장 브리핑으로 보냈는지다. */
interface ComposedEmail {
    email: EmailMessage;
    symbols: string[];
    marketBriefing: boolean;
}

interface DueRecipient {
    recipient: EmailReportRecipient;
    localDate: string;
}

function errorText(error: unknown): string {
    return redactedErrorMessage(error).slice(0, ERROR_MAX_LENGTH);
}

/** 요약 조회 결과에 그 종목이 없을 때의 빈 칸 — 메일은 그 종목을 "데이터 없음"으로 그린다. */
function noDataBrief(symbol: string): SymbolBrief {
    return {
        symbol,
        names: null,
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
 * - **가입 첫 리포트**: 정기 회차보다 먼저, 가입 화면에서 메일 리포트를 고른 회원을
 *   `welcomes.claimDue`로 선점해 보낸다. 같은 조립 코드(`composeEmail`)로 실제 리포트를 만들고, 실을
 *   종목이 없으면 안내와 샘플 링크만 담아 보낸다. Resend 멱등 키를 달아 보내고, 결과에 따라
 *   `sent`(수락 또는 같은 키의 첫 요청이 이미 수락됨), `failed`(거절), `retry`(같은 키의 요청이 처리
 *   중이라 시도를 쓰지 않고 미룸)로 기록한다. 정기 발송 기록(`email_report_deliveries`)은 건드리지 않는다.
 * - **정기 회차 건너뛰기**: 첫 리포트를 최근 12시간 안에 보냈거나(`WELCOME_SUPPRESSES_REPORT_MS`) 지금
 *   `sending`으로 처리 중인(겹친 실행이 보내는 중일 수 있다) 회원은 그 회차를 건너뛴다. 행도 선점하지
 *   않아 다음 회차는 평소대로다.
 * - 첫 리포트와 정기 회차는 같은 워커 풀(`runPool`, 동시 처리 수와 마감 `BATCH_DEADLINE_MS` 공유)로 돈다.
 *   마감을 넘기면 남은 항목은 손대지 않고 `deferred`로 센다. 선점해 둔 첫 리포트 행은 `onDefer`로
 *   `retry`로 돌려놓아(시도를 쓰지 않는다) 다음 실행이 바로 잡고 정기 회차의 `sending` 건너뛰기에도 걸리지 않는다.
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
        marketBriefings: 0,
        drawingsCards: 0,
        drawingsNone: 0,
        alreadyClaimed: 0,
        welcomeSent: 0,
        welcomeFailed: 0,
        welcomeFinishFailed: 0,
        welcomeRetryLater: 0,
        welcomeFallback: 0,
        suppressedByWelcome: 0,
        welcomePruned: 0,
        deferred: 0,
        pruned: 0,
    };

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

    const skillLabelCache = new Map<Locale, Promise<SkillLabelResolver>>();
    const skillLabelFor = (locale: Locale) => {
        let pending = skillLabelCache.get(locale);
        if (pending === undefined) {
            pending = deps.getSkillLabel(locale);
            skillLabelCache.set(locale, pending);
        }
        return pending;
    };

    // 작도는 로케일과 무관하다 — (종목, 날짜)마다 한 번만 읽고, 처음 보는 종목만 한 번에 묶어 조회한다.
    // 작도 조회가 일시적으로 실패하면 그 결과(작도 없음)를 이 배치 안에서는 다시 시도하지 않는다 — 작도는 부가 표시다.
    const drawingsCache = new Map<string, Promise<SymbolDrawings | null>>();
    const drawingsFor = (symbols: readonly string[], localDate: string) => {
        const keyOf = (symbol: string) => `${symbol}\u0000${localDate}`;
        const missing = symbols.filter(s => !drawingsCache.has(keyOf(s)));
        if (missing.length > 0) {
            const pending = deps
                .loadDrawings(missing, localDate)
                .catch(error => {
                    console.warn(
                        '[email-report] chart drawings failed',
                        redactDbErrorForLog(error)
                    );
                    return new Map<string, SymbolDrawings>();
                });
            for (const symbol of missing) {
                drawingsCache.set(
                    keyOf(symbol),
                    pending.then(found => found.get(symbol) ?? null)
                );
            }
        }
        return Promise.all(
            symbols.map(
                s => drawingsCache.get(keyOf(s)) ?? Promise.resolve(null)
            )
        );
    };

    // 시장 브리핑 종목은 회원과 무관해 배치에 한 번만 조회한다(첫 필요 시점에). 실패는 빈 목록 — 그
    // 회원들은 지금처럼 건너뛴다. 로더 자체가 시장별 실패를 삼키지만, 예상 밖 throw도 배치를 멈추지 않게 둔다.
    let marketPicks: Promise<string[]> | null = null;
    const marketPicksOnce = () => {
        marketPicks ??= deps.loadMarketPicks().catch(error => {
            console.error(
                '[email-report] market picks failed',
                redactDbErrorForLog(error)
            );
            return [];
        });
        return marketPicks;
    };

    /** 한 통을 만들 재료를 모아 메일로 조립한다. 정기 회차와 가입 첫 리포트가 같은 캐시와 같은 템플릿을 쓴다. */
    function composeEmail(
        recipient: EmailReportRecipient,
        localDate: string,
        welcome: ReportEmailWelcome
    ): Promise<ComposedEmail>;
    function composeEmail(
        recipient: EmailReportRecipient,
        localDate: string
    ): Promise<ComposedEmail | null>;
    async function composeEmail(
        recipient: EmailReportRecipient,
        localDate: string,
        welcome?: ReportEmailWelcome
    ): Promise<ComposedEmail | null> {
        const [holdings, watchlist, excluded] = await Promise.all([
            deps.findHoldings(recipient.userId),
            deps.findWatchlist(recipient.userId),
            deps.findExcludedSymbols(recipient.userId),
        ]);
        const selection = selectReportSymbols({
            holdings,
            watchlist,
            excluded,
        });
        // 보유·관심종목이 아예 없으면 그날 신호가 잡힌 대표 종목으로 시장 브리핑을 보낸다. 요약 표만
        // 쓰고 전체 카드(AI 분석 로드)는 없다 — 회원이 고른 종목이 아니라서다. 담은 종목을 전부 리포트에서
        // 뺀 회원은 브리핑을 받지 않는다(종목을 고른 뒤 뺀 것은 "이 종목들 메일은 그만"이라는 뜻이다).
        const noHoldingsOrWatchlist =
            holdings.length === 0 && watchlist.length === 0;
        const briefSymbols = noHoldingsOrWatchlist
            ? await marketPicksOnce()
            : selection.brief;
        const symbols = noHoldingsOrWatchlist
            ? briefSymbols
            : [...selection.full, ...selection.brief];
        // 정기 회차는 실을 종목이 없으면 보내지 않는다. 첫 리포트는 수신 동의 확인을 겸하므로 빈 채로도
        // 보낸다(안내와 샘플 링크만 담는다).
        if (symbols.length === 0 && welcome === undefined) return null;
        const marketBriefing = noHoldingsOrWatchlist && symbols.length > 0;
        const { locale } = recipient;
        // 요약 조회는 전체 카드·요약 행을 한 줄로 묶어 청크로 돌린다 — 회원 한 명당 동시에
        // 떠 있는 일봉 조회가 BRIEF_CONCURRENCY를 넘지 않는다(최악 RECIPIENT_CONCURRENCY ×
        // BRIEF_CONCURRENCY = 20). 전체 카드의 리포트 로드는 이 청크와 나란히 돈다.
        const [reports, briefs, t, signalLabel, skillLabel, drawingList] =
            await Promise.all([
                Promise.all(selection.full.map(s => reportFor(s, locale))),
                mapChunked(symbols, BRIEF_CONCURRENCY, briefFor),
                translatorFor(locale),
                signalLabelFor(locale),
                skillLabelFor(locale),
                marketBriefing
                    ? Promise.resolve([])
                    : drawingsFor(selection.full, localDate),
            ]);
        const drawingsBySymbol = new Map(
            selection.full.map((symbol, i) => [symbol, drawingList[i] ?? null])
        );
        const briefBySymbol = new Map(briefs.map(b => [b.symbol, b]));
        const briefOf = (symbol: string) =>
            briefBySymbol.get(symbol) ?? noDataBrief(symbol);
        const email = buildReportEmail({
            to: recipient.email,
            locale,
            localDate,
            sections: reports.map(report => {
                const drawings = drawingsBySymbol.get(report.symbol) ?? null;
                return {
                    report,
                    brief: briefOf(report.symbol),
                    chartUrl: buildChartImageUrl(
                        deps.siteUrl,
                        deps.secret,
                        report.symbol,
                        localDate,
                        drawings?.analysisAt ?? null
                    ),
                    drawings:
                        drawings === null
                            ? null
                            : {
                                  analyzedAt: drawings.analysisAt.toISOString(),
                                  legend: drawings.legend,
                              },
                    pageUrl: buildSymbolPageUrl(
                        deps.siteUrl,
                        locale,
                        report.symbol
                    ),
                };
            }),
            briefRows: briefSymbols.map(symbol => ({
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
            ...(marketBriefing && {
                marketBriefing: {
                    marketUrl: buildMarketPageUrl(deps.siteUrl, locale),
                },
            }),
            ...(welcome !== undefined && { welcome }),
            timeZone: recipient.timezone,
            t,
            signalLabel,
            skillLabel,
        });
        for (const drawings of drawingsBySymbol.values()) {
            if (drawings === null) counts.drawingsNone += 1;
            else counts.drawingsCards += 1;
        }
        return { email, symbols, marketBriefing };
    }

    async function processOne({ recipient, localDate }: DueRecipient) {
        // 첫 리포트를 방금 받은 회원은 이번 회차를 건너뛴다. 행도 선점하지 않는다 — 내일 회차는 평소대로다.
        if (recentlyWelcomed.has(recipient.userId)) {
            counts.suppressedByWelcome += 1;
            return;
        }
        const claimId = await deps.deliveries.claim(
            recipient.userId,
            localDate
        );
        if (claimId === null) {
            counts.alreadyClaimed += 1;
            return;
        }
        // 조립이 던지면 실린 종목이 확정되지 않아 실패 기록의 종목은 빈 목록이다.
        const composed = await composeEmail(recipient, localDate).then(
            result => ({ ok: true as const, result }),
            error => ({ ok: false as const, error })
        );
        if (!composed.ok) {
            await recordFailure(claimId, recipient.userId, composed.error);
            return;
        }
        try {
            // 기록이 던지면 아래 catch가 실패 행을 남긴다 — 선점 실패 경로로 흘려보내지 않는다.
            if (composed.result === null) {
                await deps.deliveries.finish(claimId, 'skipped', [], null);
                counts.skipped += 1;
                return;
            }
            const { email, symbols, marketBriefing } = composed.result;
            const accepted = await deps.dispatcher.sendEmail(email);
            await deps.deliveries.finish(
                claimId,
                accepted ? 'sent' : 'failed',
                symbols,
                accepted ? null : 'dispatcher rejected'
            );
            if (accepted) {
                counts.sent += 1;
                if (marketBriefing) counts.marketBriefings += 1;
            } else counts.failed += 1;
        } catch (error) {
            await recordFailure(
                claimId,
                recipient.userId,
                error,
                composed.result?.symbols
            );
        }
    }

    async function recordFailure(
        claimId: string,
        userId: string,
        error: unknown,
        symbols: readonly string[] = []
    ) {
        counts.failed += 1;
        console.error(
            `[email-report] delivery failed for ${userId}`,
            redactDbErrorForLog(error)
        );
        await deps.deliveries
            .finish(claimId, 'failed', symbols, errorText(error))
            .catch(finishError =>
                console.error(
                    '[email-report] could not record failure',
                    redactDbErrorForLog(finishError)
                )
            );
    }

    /**
     * 가입 첫 리포트 한 통. 선점(`claimDue`)은 이미 끝났다 — 여기서는 만들고, 보내고, 결과를 기록한다.
     * 정기 발송 기록(`email_report_deliveries`)은 건드리지 않는다. 멱등 키가 같은 회원의 재시도를
     * Resend 쪽에서도 한 번으로 접는다(기록 직전에 죽어 `sending`으로 남은 행을 다시 잡았을 때).
     */
    async function processWelcome(recipient: EmailReportWelcomeRecipient) {
        const { userId, locale } = recipient;
        const localDate =
            toLocalSlot(now, recipient.timezone)?.localDate ?? kstDateKey(now);
        const { email, symbols } = await composeEmail(recipient, localDate, {
            consentedAt: recipient.consentedAt,
            daysOfWeek: recipient.daysOfWeek,
            sendHour: recipient.sendHour,
            sampleUrl: `${deps.siteUrl}${localePath(locale, '/email-report/sample')}`,
        });
        const outcome = await deps.dispatcher.sendKeyedEmail({
            ...email,
            idempotencyKey: `email-report-welcome/${userId}`,
        });
        if (outcome === 'in_flight') {
            // 같은 키의 요청이 아직 처리 중이다. 시도를 쓰지 않고 돌려놓아 다음 실행이 다시 잡는다.
            await deps.welcomes.finish(userId, 'retry', 'request in flight');
            counts.welcomeRetryLater += 1;
            return;
        }
        if (outcome === 'rejected') {
            await deps.welcomes.finish(userId, 'failed', 'dispatcher rejected');
            counts.welcomeFailed += 1;
            return;
        }
        // `already_accepted`: 같은 키의 첫 요청을 Resend가 이미 받았다(재시도 본문이 달라 거절됐을 뿐).
        // 메일은 나갔으므로 실패가 아니라 보냄으로 기록한다.
        // 메일이 나간 뒤에는 기록이 실패해도 실패로 세지 않는다. 행은 `sending`으로 남고, 시도 횟수가
        // `WELCOME_MAX_ATTEMPTS` 아래인 동안만 30분 뒤 다시 잡힌다(같은 멱등 키라 Resend가
        // `already_accepted`로 접는다). 마지막 시도였다면 보관 기간이 지나 지워질 때까지 `sending`으로 남는다.
        counts.welcomeSent += 1;
        if (symbols.length === 0) counts.welcomeFallback += 1;
        await deps.welcomes.finish(userId, 'sent', null).catch(error => {
            counts.welcomeFinishFailed += 1;
            console.error(
                `[email-report] welcome sent but could not record for ${userId}`,
                redactDbErrorForLog(error)
            );
        });
    }

    /** 마감으로 손대지 못한 첫 리포트 행을 `sending`에서 돌려놓는다(시도를 쓰지 않는다). */
    async function releaseDeferredWelcomes(
        items: readonly EmailReportWelcomeRecipient[]
    ) {
        await Promise.all(
            items.map(item =>
                deps.welcomes
                    .finish(item.userId, 'retry', 'deadline deferred')
                    .catch(error =>
                        console.error(
                            `[email-report] could not release deferred welcome for ${item.userId}`,
                            redactDbErrorForLog(error)
                        )
                    )
            )
        );
    }

    /** 첫 리포트 처리 중 던진 오류를 `failed`로 기록한다(시도 횟수가 남아 있으면 다음 실행이 다시 잡는다). */
    async function recordWelcomeFailure(
        recipient: EmailReportWelcomeRecipient,
        error: unknown
    ) {
        counts.welcomeFailed += 1;
        console.error(
            `[email-report] welcome failed for ${recipient.userId}`,
            redactDbErrorForLog(error)
        );
        await deps.welcomes
            .finish(recipient.userId, 'failed', errorText(error))
            .catch(finishError =>
                console.error(
                    '[email-report] could not record welcome failure',
                    redactDbErrorForLog(finishError)
                )
            );
    }

    /**
     * `items`를 회원 동시성 `RECIPIENT_CONCURRENCY`로 처리한다. 마감을 넘기면 남은 항목은 손대지 않고
     * `counts.deferred`에 더한다. `work`가 던지면 `onError`가 처리한다(루프를 멈추지 않는다).
     * `onDefer`는 마감으로 손대지 못한 항목을 받아 선점 상태를 풀어 준다(첫 리포트 행을 `retry`로 돌림).
     */
    async function runPool<T>(
        items: readonly T[],
        work: (item: T) => Promise<void>,
        onError: (item: T, error: unknown) => void | Promise<void>,
        onDefer?: (items: readonly T[]) => Promise<void>
    ) {
        // 한 이터레이터를 워커들이 나눠 쓴다 — `next()`가 항목을 한 번에 하나씩만 내주므로 겹치지 않는다.
        const queue = items[Symbol.iterator]();
        async function worker(): Promise<void> {
            const step = queue.next();
            if (step.done === true) return;
            if (clock() - startedAt > BATCH_DEADLINE_MS) {
                // 남은 항목을 전부 꺼내 버려 다른 워커도 끝나게 한다.
                const rest = [step.value, ...queue];
                counts.deferred += rest.length;
                await onDefer?.(rest);
                return;
            }
            try {
                await work(step.value);
            } catch (error) {
                await onError(step.value, error);
            }
            return worker();
        }
        await Promise.all(
            Array.from(
                { length: Math.min(RECIPIENT_CONCURRENCY, items.length) },
                worker
            )
        );
    }

    // 1) 가입 첫 리포트. 정기 회차보다 먼저 돌아 방금 보낸 회원이 아래에서 걸러진다. 선점이 실패해도
    // 정기 회차는 그대로 돈다. 마감을 넘겨 못 보낸 행은 `retry`로 돌려놓아 다음 실행이 바로 잡고,
    // 정기 회차의 `sending` 건너뛰기에도 걸리지 않는다.
    const welcomeRecipients = await deps.welcomes.claimDue(now).catch(error => {
        console.error(
            '[email-report] welcome claim failed',
            redactDbErrorForLog(error)
        );
        return [];
    });
    await runPool(
        welcomeRecipients,
        processWelcome,
        recordWelcomeFailure,
        releaseDeferredWelcomes
    );

    // 2) 첫 리포트를 최근 받은 회원은 이번 정기 회차를 건너뛴다. 조회가 실패하면 건너뛰기 없이 진행한다 —
    // DB 오류 한 번으로 모든 정기 메일을 막는 것보다 같은 내용이 한 번 더 가는 편이 낫다.
    const recentlyWelcomed = await deps.welcomes
        .findWelcomed(
            new Date(now.getTime() - WELCOME_SUPPRESSES_REPORT_MS),
            new Date(now.getTime() - WELCOME_STALE_SENDING_MS)
        )
        .catch(error => {
            console.error(
                '[email-report] welcome lookup failed',
                redactDbErrorForLog(error)
            );
            return new Set<string>();
        });

    // 3) 정기 회차.
    const due = selectDueRecipients(
        await deps.subscriptions.findEnabledRecipients(),
        now
    );
    counts.due = due.length;
    await runPool(due, processOne, (item, error) => {
        // 선점 자체가 실패한 경우 — 기록할 행이 없으니 로그만 남긴다.
        counts.failed += 1;
        console.error(
            `[email-report] claim failed for ${item.recipient.userId}`,
            redactDbErrorForLog(error)
        );
    });

    const cutoff = new Date(now.getTime() - DELIVERY_RETENTION_MS);
    try {
        counts.pruned = await deps.deliveries.pruneOlderThan(cutoff);
    } catch (error) {
        console.error(
            '[email-report] prune failed',
            redactDbErrorForLog(error)
        );
    }
    try {
        counts.welcomePruned = await deps.welcomes.pruneOlderThan(cutoff);
    } catch (error) {
        console.error(
            '[email-report] welcome prune failed',
            redactDbErrorForLog(error)
        );
    }
    return counts;
}
