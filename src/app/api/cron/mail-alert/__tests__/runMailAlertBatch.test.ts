vi.mock('server-only', () => ({}));

/**
 * 담은 종목의 일봉 판정을 심는 표. 키는 마지막 봉의 거래량(표지)이고 값은 그 봉에서 "새로 켜진" 신호 유형이다.
 * 표지가 없는 봉은 진짜 코어 판정을 그대로 쓴다. 발송기는 신호를 코어 `technicalChangesBetween`의
 * `signal_started`로 읽으므로 그 결과에 심고, 호출이 고른 유형(`signalTypes`) 밖의 것은 코어처럼 뺀다.
 */
const planted = vi.hoisted(() => ({
    newSignals: new Map<number, readonly string[]>(),
}));

vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        technicalChangesBetween: (
            bars: Bar[],
            options: Parameters<typeof actual.technicalChangesBetween>[1]
        ) => {
            const result = actual.technicalChangesBetween(bars, options);
            const last = bars.at(-1);
            const types =
                last === undefined
                    ? undefined
                    : planted.newSignals.get(last.volume);
            if (types === undefined || !result.ok) return result;
            const plantedSignals: TechnicalChange[] = types
                .filter(
                    type =>
                        options.signalTypes === undefined ||
                        options.signalTypes.some(allowed => allowed === type)
                )
                .map(type => ({
                    kind: 'signal_started',
                    type: type as ConfirmedSignalType,
                    direction: 'bullish',
                    time: last?.time ?? 0,
                }));
            return {
                ...result,
                changes: [
                    ...result.changes.filter(
                        change => change.kind !== 'signal_started'
                    ),
                    ...plantedSignals,
                ],
            };
        },
    };
});

import type {
    Bar,
    ConfirmedSignalType,
    SignalType,
    TechnicalChange,
    Tier,
} from '@y0ngha/siglens-core';
import { MAIL_ALERT_SIGNAL_TYPES } from '@/entities/mail-alert/lib/mailAlertConstants';
import { MS_PER_SECOND, SECONDS_PER_DAY } from '@/shared/config/time';
import type {
    FiredPriceAlert,
    MailAlertClaim,
    MailAlertDeliveryRepository,
    MailAlertDeliveryTarget,
    PriceAlertRecord,
    PriceAlertRepository,
} from '@/shared/db/types';
import type {
    EmailMessage,
    KeyedEmailDispatcher,
    KeyedEmailOutcome,
} from '@/shared/email/types';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import {
    PLANTED_EMAIL,
    PLANTED_TOKEN,
    plantedDbError,
} from '@/shared/test-utils/plantedDbError';
import type { AlertSourceDeps } from '../collectAlertSources';
import {
    MAIL_ALERT_DEADLINE_MS,
    runMailAlertBatch,
    type MailAlertBatchCounts,
    type MailAlertBatchDeps,
    type MailAlertBatchResult,
} from '../runMailAlertBatch';

/** 2026-11-25(수) 07:05 KST. 미국 화요일 세션·한국 화요일 세션이 기대 세션이다. */
const FIRST = new Date('2026-11-24T22:05:00Z');
/** 같은 날 08:05 KST — 최종 슬롯. */
const FINAL = new Date('2026-11-24T23:05:00Z');
const ALERT_DATE = '2026-11-25';
/** 다음 날 07:05 KST. */
const NEXT_DAY_FIRST = new Date('2026-11-25T22:05:00Z');
const US_SESSION = '2026-11-24';
const KR_SESSION = '2026-11-24';
const SECRET = 'batch-secret-batch-secret-batch-secret';
const SITE = 'https://siglens.io';

const tKo = catalogTranslator('entities.mail-alert.email', 'ko');
const labelKo = catalogTranslator('shared.enumLabel', 'ko');

function target(
    id: string,
    overrides: Partial<MailAlertDeliveryTarget> = {}
): MailAlertDeliveryTarget {
    return {
        id,
        email: `${id}@example.com`,
        locale: 'ko',
        userId: null,
        includePortfolio: false,
        topics: [],
        ...overrides,
    };
}

/** 멱등 키 발송 결과를 정하는 가짜 발송기. 알림 패스는 `sendKeyedEmail`만 부른다. */
function keyedDispatcher(
    send: (message: EmailMessage) => Promise<KeyedEmailOutcome>
): KeyedEmailDispatcher {
    return {
        sendEmail: async message => (await send(message)) !== 'rejected',
        sendKeyedEmail: send,
    };
}

const signalTopic = (key: string) => ({ kind: 'signal' as const, key });
const symbolTopic = (key: string) => ({ kind: 'symbol' as const, key });
const fgTopic = (key: string) => ({ kind: 'fear_greed' as const, key });

/** 마지막 봉이 `session`인 평평한 일봉 `count`개 — 새 신호가 없는 봉이다. */
function barsEndingOn(session: string, count = 300): Bar[] {
    const last = Date.parse(`${session}T00:00:00Z`) / MS_PER_SECOND;
    return Array.from({ length: count }, (_, i) => ({
        time: last - (count - 1 - i) * SECONDS_PER_DAY,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1000,
    }));
}

/** 심은 판정마다 새 표지(평평한 봉의 거래량 1000과 겹치지 않는 값). */
const nextTag = { value: 10_000 };

/**
 * `bySymbol`의 종목은 일봉 판정이 그 유형들을 새 신호로 내고, 나머지 종목은 신호 없는 평평한 일봉이다. 봉의
 * 마지막 날짜는 `session`(기본: 미국 기대 세션)이다.
 */
function plantMineSignals(
    harness: Harness,
    bySymbol: Readonly<Record<string, readonly SignalType[]>>,
    session = US_SESSION
): void {
    harness.sources.loadDailyBars = vi.fn(async (symbol: string) => {
        const bars = barsEndingOn(session);
        const types = bySymbol[symbol];
        if (types === undefined) return bars;
        const tag = nextTag.value++;
        planted.newSignals.set(tag, types);
        return bars.map((bar, i) =>
            i === bars.length - 1 ? { ...bar, volume: tag } : bar
        );
    });
}

/** 테스트가 소스 함수를 갈아 끼울 수 있게 읽기 전용을 푼 소스 묶음. */
type MutableSources = {
    -readonly [K in keyof AlertSourceDeps]: AlertSourceDeps[K];
};

interface Harness {
    deps: MailAlertBatchDeps;
    sources: MutableSources;
    claimOnce: (
        subscriberId: string,
        alertDate: string,
        itemKeys?: readonly string[],
        firedAlerts?: readonly FiredPriceAlert[]
    ) => Promise<MailAlertClaim | null>;
    sent: EmailMessage[];
    claims: Set<string>;
    deliveries: {
        [K in keyof MailAlertDeliveryRepository]: ReturnType<typeof vi.fn>;
    };
    /** 저장소의 가격대 알림. 선점이 이기면 `fired`로 바뀐다(진짜 트랜잭션은 DB 테스트가 본다). */
    alerts: PriceAlertRecord[];
    priceAlerts: {
        [
            K in keyof PriceAlertRepository as K extends
                | 'listActiveForDelivery'
                | 'removeSubscriberIfNothingToReceive'
                | 'pruneExpiredAndFired'
                ? K
                : never
        ]: ReturnType<typeof vi.fn>;
    };
}

function sentTo(harness: Harness, email: string): EmailMessage[] {
    return harness.sent.filter(message => message.to === email);
}

function makeHarness(
    overrides: Partial<MailAlertBatchDeps> = {},
    options: { targets?: MailAlertDeliveryTarget[] } = {}
): Harness {
    const sent: EmailMessage[] = [];
    const claims = new Set<string>();
    const alerts: PriceAlertRecord[] = [];
    const claimOnce = async (
        subscriberId: string,
        alertDate: string,
        _itemKeys: readonly string[] = [],
        firedAlerts: readonly FiredPriceAlert[] = []
    ): Promise<MailAlertClaim | null> => {
        const key = `${subscriberId}|${alertDate}`;
        if (claims.has(key)) return null;
        claims.add(key);
        // 저장소처럼 실제로 `active`였던 알림만 `fired`로 바꾸고 그 id를 돌려준다.
        const firedAlertIds = firedAlerts.flatMap(fired => {
            const index = alerts.findIndex(
                alert =>
                    alert.id === fired.id &&
                    alert.subscriberId === subscriberId &&
                    alert.status === 'active'
            );
            const found = alerts[index];
            if (found === undefined) return [];
            alerts[index] = {
                ...found,
                status: 'fired',
                firedSession: fired.session,
                firedClose: fired.close,
                firedAt: new Date('2026-11-24T22:05:00Z'),
            };
            return [fired.id];
        });
        return { id: `claim-${key}`, firedAlertIds };
    };
    const priceAlerts = {
        // 저장소의 만료 정의(시장별 기대 세션 이상)를 그대로 흉내 낸다.
        listActiveForDelivery: vi.fn(async (asOf: { us: string; kr: string }) =>
            Map.groupBy(
                alerts.filter(
                    alert =>
                        alert.status === 'active' &&
                        alert.expiresOn >= asOf[alert.market]
                ),
                alert => alert.subscriberId
            )
        ),
        removeSubscriberIfNothingToReceive: vi.fn(async () => false),
        pruneExpiredAndFired: vi
            .fn()
            .mockResolvedValue({ alertsDeleted: 0, subscribersDeleted: 0 }),
    };
    const deliveries = {
        claim: vi.fn(claimOnce),
        // 저장소 `finish`의 알림 정리를 흉내 낸다: 거절이면 알린 알림(p:)을 되살리고, 아니면 끝낸 알림(v:)을 지운다.
        finish: vi.fn(
            async (
                claimId: string,
                _outcome: string,
                keys: readonly string[],
                _error: string | null,
                mailNotSent = false
            ) => {
                const subscriberId = claimId
                    .slice('claim-'.length)
                    .split('|')[0];
                const idsOf = (prefix: string) =>
                    keys.flatMap(key =>
                        key.startsWith(prefix) ? [key.slice(prefix.length)] : []
                    );
                if (mailNotSent) {
                    idsOf('p:').forEach(id => {
                        const index = alerts.findIndex(
                            alert =>
                                alert.id === id &&
                                alert.subscriberId === subscriberId &&
                                alert.status === 'fired'
                        );
                        const found = alerts[index];
                        if (found === undefined) return;
                        alerts[index] = {
                            ...found,
                            status: 'active',
                            firedSession: null,
                            firedClose: null,
                            firedAt: null,
                        };
                    });
                    return;
                }
                idsOf('v:').forEach(id => {
                    const index = alerts.findIndex(
                        alert =>
                            alert.id === id &&
                            alert.subscriberId === subscriberId &&
                            alert.status === 'active'
                    );
                    if (index >= 0) alerts.splice(index, 1);
                });
            }
        ),
        recentItemKeys: vi.fn().mockResolvedValue(new Map()),
        pruneBefore: vi.fn().mockResolvedValue(2),
    };
    const sources: MutableSources = {
        signalHistory: {
            latestRecordedSession: vi.fn(async (market: 'us' | 'kr') =>
                market === 'us' ? US_SESSION : KR_SESSION
            ),
            findEpisodesStartedOn: vi.fn().mockResolvedValue([]),
        },
        loadFearGreedHistory: vi.fn().mockResolvedValue([]),
        loadDailyBars: vi.fn().mockResolvedValue([]),
    };
    const deps: MailAlertBatchDeps = {
        launched: true,
        secret: SECRET,
        siteUrl: SITE,
        subscribers: {
            findAllForDelivery: vi
                .fn()
                .mockResolvedValue(options.targets ?? [target('s1')]),
        },
        deliveries,
        priceAlerts,
        sources,
        getSymbolNames: vi.fn(async () => null),
        findHoldings: vi.fn().mockResolvedValue([]),
        findWatchlist: vi.fn().mockResolvedValue([]),
        resolveMarket: vi.fn(async (symbol: string) =>
            symbol.endsWith('.KS') ? 'kr' : 'us'
        ),
        getTranslator: async () => tKo,
        getSignalLabel: async () => type =>
            labelKo.has(`signalType.${type}`)
                ? labelKo(`signalType.${type}`)
                : null,
        getDisclaimer: async () => '투자 참고용이에요.',
        dispatcher: keyedDispatcher(async message => {
            sent.push(message);
            return 'accepted';
        }),
        ...overrides,
    };
    return {
        deps,
        sources,
        claimOnce,
        sent,
        claims,
        deliveries,
        alerts,
        priceAlerts,
    };
}

function countsOf(result: MailAlertBatchResult): MailAlertBatchCounts {
    if (result.status !== 'done') {
        throw new Error(`expected a finished run, got ${result.status}`);
    }
    return result.counts;
}

const usEpisode = (symbol: string, signalType = 'golden_cross') => ({
    symbol,
    signalType,
    changePercent: 2.5,
    koreanName: null,
});

function withEpisodes(
    harness: Harness,
    byMarket: Partial<Record<'us' | 'kr', ReturnType<typeof usEpisode>[]>>
): void {
    harness.deps.sources.signalHistory.findEpisodesStartedOn = vi.fn(
        async (market: 'us' | 'kr') => byMarket[market] ?? []
    );
}

describe('runMailAlertBatch', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('실행 조건', () => {
        it('발송 시각이 아니면 아무것도 읽지 않는다', async () => {
            const harness = makeHarness();

            const result = await runMailAlertBatch(
                harness.deps,
                new Date('2026-11-24T10:00:00Z')
            );

            expect(result).toEqual({ status: 'outside_window' });
            expect(
                harness.deps.subscribers.findAllForDelivery
            ).not.toHaveBeenCalled();
        });

        it('발송 대상을 이번 실행의 시장별 기대 세션으로 읽는다(가격대 알림 만료 판정이 같은 정의를 쓴다)', async () => {
            const harness = makeHarness();

            await runMailAlertBatch(harness.deps, FIRST);

            expect(
                harness.deps.subscribers.findAllForDelivery
            ).toHaveBeenCalledWith({ us: US_SESSION, kr: KR_SESSION });
        });

        it('공개 전이면 시각과 무관하게 아무것도 읽지 않는다', async () => {
            const harness = makeHarness({ launched: false });

            const result = await runMailAlertBatch(harness.deps, FIRST);

            expect(result).toEqual({ status: 'disabled', reason: 'flag_off' });
            expect(
                harness.deps.subscribers.findAllForDelivery
            ).not.toHaveBeenCalled();
        });

        it('서명 비밀이 없으면 보내지 않는다(수신거부 링크가 안 되는 메일 금지)', async () => {
            const harness = makeHarness({ secret: null });

            const result = await runMailAlertBatch(harness.deps, FIRST);

            expect(result).toEqual({ status: 'no_secret' });
            expect(
                harness.deps.subscribers.findAllForDelivery
            ).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('EMAIL_REPORT_SIGNING_SECRET')
            );
        });

        it('테이블이 없으면(42P01) 한 번 알리고 disabled로 끝난다', async () => {
            const harness = makeHarness();
            harness.deps.subscribers.findAllForDelivery = vi
                .fn()
                .mockRejectedValue(
                    new Error('Failed query', {
                        cause: Object.assign(new Error('relation missing'), {
                            code: '42P01',
                        }),
                    })
                );

            const result = await runMailAlertBatch(harness.deps, FIRST);

            expect(result).toEqual({
                status: 'disabled',
                reason: 'missing_table',
            });
            expect(harness.sent).toEqual([]);
        });

        it('다른 DB 오류는 그대로 던져 호출자가 실패로 기록한다', async () => {
            const harness = makeHarness();
            harness.deps.subscribers.findAllForDelivery = vi
                .fn()
                .mockRejectedValue(new Error('connection reset'));

            await expect(
                runMailAlertBatch(harness.deps, FIRST)
            ).rejects.toThrow('connection reset');
        });
    });

    describe('준비 게이트', () => {
        it('첫 슬롯에서 미국 기록이 없으면 선점도 발송도 없이 통째로 미룬다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            harness.deps.sources.signalHistory.latestRecordedSession = vi.fn(
                async (market: 'us' | 'kr') =>
                    market === 'us' ? '2026-11-23' : KR_SESSION
            );
            withEpisodes(harness, { kr: [usEpisode('005930.KS')] });

            const result = await runMailAlertBatch(harness.deps, FIRST);

            expect(result).toEqual({
                status: 'deferred',
                notReady: ['signals:us'],
            });
            expect(harness.deliveries.claim).not.toHaveBeenCalled();
            expect(harness.sent).toEqual([]);
        });

        it('미뤄진 첫 슬롯은 보유·관심종목을 읽지 않는다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('m1', {
                            userId: 'user-1',
                            includePortfolio: true,
                            topics: [signalTopic('golden_cross')],
                        }),
                    ],
                }
            );
            harness.sources.signalHistory.latestRecordedSession = vi.fn(
                async () => null
            );

            const result = await runMailAlertBatch(harness.deps, FIRST);

            expect(result.status).toBe('deferred');
            expect(harness.deps.findHoldings).not.toHaveBeenCalled();
            expect(harness.deps.findWatchlist).not.toHaveBeenCalled();
            expect(harness.deps.resolveMarket).not.toHaveBeenCalled();
        });

        it('최종 슬롯은 준비된 소스(한국)만으로 보내고 빠진 소스를 로그로 남긴다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            harness.deps.sources.signalHistory.latestRecordedSession = vi.fn(
                async (market: 'us' | 'kr') =>
                    market === 'us' ? null : KR_SESSION
            );
            withEpisodes(harness, {
                us: [usEpisode('AAPL')],
                kr: [usEpisode('005930.KS')],
            });

            const result = await runMailAlertBatch(harness.deps, FINAL);

            const counts = countsOf(result);
            expect(counts.notReady).toEqual(['signals:us']);
            expect(counts.sent).toBe(1);
            expect(sentTo(harness, 's1@example.com')[0]?.text).toContain(
                '005930.KS'
            );
            expect(sentTo(harness, 's1@example.com')[0]?.text).not.toContain(
                'AAPL'
            );
            expect(console.warn).toHaveBeenCalledWith(
                '[mail-alert] not ready at final slot: signals:us'
            );
            // 준비되지 않은 시장의 신호 기록은 읽지도 않는다.
            expect(
                harness.deps.sources.signalHistory.findEpisodesStartedOn
            ).not.toHaveBeenCalledWith(
                'us',
                expect.anything(),
                expect.anything()
            );
        });

        it('공포탐욕 판독이 기대 세션까지 오지 않으면 첫 슬롯은 미루고 최종 슬롯은 그 항목만 뺀다', async () => {
            const targets = [
                target('s1', {
                    topics: [fgTopic('crypto'), signalTopic('golden_cross')],
                }),
            ];
            const first = makeHarness({}, { targets });
            withEpisodes(first, { us: [usEpisode('AAPL')] });

            const deferred = await runMailAlertBatch(first.deps, FIRST);
            const final = makeHarness({}, { targets });
            withEpisodes(final, { us: [usEpisode('AAPL')] });
            const sentRun = await runMailAlertBatch(final.deps, FINAL);

            expect(deferred).toEqual({
                status: 'deferred',
                notReady: ['fg:crypto'],
            });
            expect(countsOf(sentRun).notReady).toEqual(['fg:crypto']);
            expect(countsOf(sentRun).sent).toBe(1);
        });

        it('공포탐욕 구독자가 없으면 판독을 읽지 않는다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );

            await runMailAlertBatch(harness.deps, FIRST);

            expect(
                harness.deps.sources.loadFearGreedHistory
            ).not.toHaveBeenCalled();
        });
    });

    describe('발송', () => {
        it('새 항목이 있는 구독자에게 한 통을 선점한 뒤 보내고 항목 키를 기록한다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts).toMatchObject({
                slot: 'first',
                alertDate: ALERT_DATE,
                subscribers: 1,
                sent: 1,
                failed: 0,
                quiet: 0,
                alreadyClaimed: 0,
            });
            const message = sentTo(harness, 's1@example.com')[0];
            expect(message?.subject).toBe(
                '[시그렌즈] 11월 25일 새로 잡힌 변화 1건'
            );
            expect(message?.idempotencyKey).toBe(`mail-alert/s1/${ALERT_DATE}`);
            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                ['s:us:AAPL:golden_cross'],
                []
            );
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                `claim-s1|${ALERT_DATE}`,
                'sent',
                ['s:us:AAPL:golden_cross'],
                null,
                false
            );
        });

        it('선점과 기록에는 실린 항목과 줄 수 상한으로 넘친 후보의 키를 함께 남긴다', async () => {
            const rows = Array.from({ length: 12 }, (_, i) =>
                usEpisode(`H${String(i).padStart(2, '0')}`)
            );
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            withEpisodes(harness, { us: rows });

            await runMailAlertBatch(harness.deps, FIRST);

            const allKeys = rows.map(row => `s:us:${row.symbol}:golden_cross`);
            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                expect.arrayContaining(allKeys),
                []
            );
            expect(sentTo(harness, 's1@example.com')[0]?.subject).toContain(
                '10건'
            );
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                expect.any(String),
                'sent',
                expect.arrayContaining(allKeys),
                null,
                false
            );
        });

        it('메일의 설정·수신거부 링크는 그 구독자 id로 서명되어 있다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            await runMailAlertBatch(harness.deps, FIRST);

            const message = sentTo(harness, 's1@example.com')[0];
            expect(message?.headers?.['List-Unsubscribe']).toContain(
                `${SITE}/api/mail-alert/unsubscribe?s=s1&sig=`
            );
            expect(message?.text).toContain(
                `${SITE}/email-report/alerts?s=s1&sig=`
            );
        });

        it('새 항목이 없는 구독자는 선점도 발송도 없고 조용한 날로 센다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.quiet).toBe(1);
            expect(counts.sent).toBe(0);
            expect(harness.deliveries.claim).not.toHaveBeenCalled();
            expect(harness.sent).toEqual([]);
        });

        it('같은 알림 날짜의 두 번째 실행은 선점에서 막혀 같은 수신자에게 다시 보내지 않는다', async () => {
            const targets = [
                target('s1', { topics: [signalTopic('golden_cross')] }),
            ];
            const harness = makeHarness({}, { targets });
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            await runMailAlertBatch(harness.deps, FIRST);
            const second = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(second.alreadyClaimed).toBe(1);
            expect(second.sent).toBe(0);
            expect(sentTo(harness, 's1@example.com')).toHaveLength(1);
        });

        it('07시 슬롯이 보낸 구독자는 08시 최종 슬롯에서 다시 보내지 않는다', async () => {
            const targets = [
                target('s1', { topics: [signalTopic('golden_cross')] }),
            ];
            const harness = makeHarness({}, { targets });
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            await runMailAlertBatch(harness.deps, FIRST);
            const final = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(final.slot).toBe('final');
            expect(final.sent).toBe(0);
            expect(sentTo(harness, 's1@example.com')).toHaveLength(1);
        });

        it('선점 행이 사라져 같은 날 다시 시도돼도 두 슬롯이 같은 멱등 키를 쓴다', async () => {
            const targets = [
                target('s1', { topics: [signalTopic('golden_cross')] }),
            ];
            const harness = makeHarness({}, { targets });
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            await runMailAlertBatch(harness.deps, FIRST);
            harness.claims.clear();
            await runMailAlertBatch(harness.deps, FINAL);

            const keys = sentTo(harness, 's1@example.com').map(
                message => message.idempotencyKey
            );
            expect(keys).toEqual([
                `mail-alert/s1/${ALERT_DATE}`,
                `mail-alert/s1/${ALERT_DATE}`,
            ]);
        });

        it('발송기가 거절하면 failed로 기록하고 같은 날 다시 시도하지 않는다', async () => {
            const harness = makeHarness(
                { dispatcher: keyedDispatcher(async () => 'rejected') },
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            const first = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );
            const final = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(first.failed).toBe(1);
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                `claim-s1|${ALERT_DATE}`,
                'failed',
                ['s:us:AAPL:golden_cross'],
                'dispatcher rejected',
                true
            );
            expect(final.alreadyClaimed).toBe(1);
            expect(final.failed).toBe(0);
        });

        it.each(['already_accepted', 'in_flight'] as const)(
            '제공자가 같은 키를 이미 받았다고 하면(%s) 실패가 아니라 sent로 기록한다(DB-11)',
            async outcome => {
                const harness = makeHarness(
                    { dispatcher: keyedDispatcher(async () => outcome) },
                    {
                        targets: [
                            target('s1', {
                                topics: [signalTopic('golden_cross')],
                            }),
                        ],
                    }
                );
                withEpisodes(harness, { us: [usEpisode('AAPL')] });

                const counts = countsOf(
                    await runMailAlertBatch(harness.deps, FIRST)
                );

                expect(counts.sent).toBe(1);
                expect(counts.failed).toBe(0);
                expect(harness.deliveries.finish).toHaveBeenCalledWith(
                    `claim-s1|${ALERT_DATE}`,
                    'sent',
                    ['s:us:AAPL:golden_cross'],
                    null,
                    false
                );
            }
        );

        it('메일을 만들다 던지면 가린 오류 문장으로 failed를 기록한다', async () => {
            const targets = [
                target('s1', { topics: [signalTopic('golden_cross')] }),
                target('s2', { topics: [signalTopic('golden_cross')] }),
            ];
            const harness = makeHarness(
                {
                    getDisclaimer: async locale => {
                        if (harness.sent.length === 0 && locale === 'ko') {
                            throw plantedDbError();
                        }
                        return '고지';
                    },
                },
                { targets }
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.failed).toBeGreaterThanOrEqual(1);
            const failedFinish = harness.deliveries.finish.mock.calls.find(
                ([, outcome]) => outcome === 'failed'
            );
            expect(failedFinish).toBeDefined();
            const recorded = String(failedFinish?.[3]);
            expect(recorded).not.toContain(PLANTED_TOKEN);
            expect(recorded).not.toContain(PLANTED_EMAIL);
            expect(recorded.length).toBeLessThanOrEqual(500);
        });

        it('발송기가 동기로 던져도 보내다 던진 것으로 보고 failed를 기록한다(나갔는지 알 수 없어 mailNotSent는 false)', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const harness = makeHarness(
                {
                    dispatcher: {
                        sendEmail: async () => true,
                        sendKeyedEmail: () => {
                            throw new Error('sync boom');
                        },
                    },
                },
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.failed).toBe(1);
            expect(counts.sent).toBe(0);
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                `claim-s1|${ALERT_DATE}`,
                'failed',
                ['s:us:AAPL:golden_cross'],
                expect.stringContaining('sync boom'),
                false
            );
        });

        it('실패 기록을 남기지 못해도 로그만 남기고 실행은 끝낸다', async () => {
            const harness = makeHarness(
                {
                    dispatcher: keyedDispatcher(async () => {
                        throw new Error('boom');
                    }),
                },
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            harness.deliveries.finish.mockRejectedValue(new Error('db down'));
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.failed).toBe(1);
            expect(console.error).toHaveBeenCalledWith(
                '[mail-alert] could not record failure',
                expect.anything()
            );
        });

        it('선점 자체가 실패한 구독자는 failed로 세고 나머지는 계속한다', async () => {
            const targets = [
                target('bad', { topics: [signalTopic('golden_cross')] }),
                target('ok', { topics: [signalTopic('golden_cross')] }),
            ];
            const harness = makeHarness({}, { targets });
            withEpisodes(harness, { us: [usEpisode('AAPL')] });
            harness.deliveries.claim.mockImplementation(
                async (
                    id: string,
                    date: string,
                    keys: readonly string[],
                    fired: readonly FiredPriceAlert[]
                ) => {
                    if (id === 'bad') throw new Error('claim failed');
                    return harness.claimOnce(id, date, keys, fired);
                }
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.failed).toBe(1);
            expect(counts.sent).toBe(1);
            expect(sentTo(harness, 'ok@example.com')).toHaveLength(1);
            expect(sentTo(harness, 'bad@example.com')).toHaveLength(0);
        });

        it('마감이 지나면 남은 구독자는 선점하지 않고 건너뛴다', async () => {
            const targets = [
                target('s1', { topics: [signalTopic('golden_cross')] }),
                target('s2', { topics: [signalTopic('golden_cross')] }),
            ];
            const readings = [0];
            const harness = makeHarness(
                {
                    // 첫 호출(시작 시각)만 0, 이후는 마감 뒤.
                    clock: () => readings.shift() ?? MAIL_ALERT_DEADLINE_MS + 1,
                },
                { targets }
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.deferredByDeadline).toBe(2);
            expect(counts.sent).toBe(0);
            expect(harness.deliveries.claim).not.toHaveBeenCalled();
        });
    });

    describe('종목 소스', () => {
        it('담은 종목은 스캐너 대상이어도 신호 기록이 아니라 그 종목의 일봉으로 판정한다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', {
                            topics: [symbolTopic('AAPL'), symbolTopic('PLTR')],
                        }),
                    ],
                }
            );
            // 신호 기록에는 AAPL 골든크로스가 있지만, AAPL의 일봉은 RSI 과매도만 새로 켠다.
            withEpisodes(harness, { us: [usEpisode('AAPL')] });
            plantMineSignals(harness, { AAPL: ['rsi_oversold'] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(harness.deps.sources.loadDailyBars).toHaveBeenCalledWith(
                'AAPL'
            );
            expect(harness.deps.sources.loadDailyBars).toHaveBeenCalledWith(
                'PLTR'
            );
            expect(counts.computedSymbols).toBe(2);
            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                ['s:us:AAPL:rsi_oversold'],
                []
            );
            const text = sentTo(harness, 's1@example.com')[0]?.text ?? '';
            expect(text).toContain(labelKo('signalType.rsi_oversold'));
            expect(text).not.toContain(labelKo('signalType.golden_cross'));
        });

        it('실린 종목의 이름은 종목 정보에서 읽는다(메일 리포트와 같은 원천)', async () => {
            const harness = makeHarness(
                {
                    getSymbolNames: vi.fn(async (symbol: string) =>
                        symbol === '005930.KS'
                            ? {
                                  name: 'Samsung Electronics',
                                  koreanName: '삼성전자',
                              }
                            : null
                    ),
                },
                {
                    targets: [
                        target('s1', { topics: [symbolTopic('005930.KS')] }),
                    ],
                }
            );
            plantMineSignals(
                harness,
                { '005930.KS': ['new_52w_high'] },
                KR_SESSION
            );

            await runMailAlertBatch(harness.deps, FIRST);

            expect(sentTo(harness, 's1@example.com')[0]?.text).toContain(
                '삼성전자 (005930)'
            );
            expect(harness.deps.getSymbolNames).toHaveBeenCalledWith(
                '005930.KS'
            );
        });

        it('이름 조회가 던지면 그 종목은 코드로 싣고 메일은 나간다', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const harness = makeHarness(
                {
                    getSymbolNames: vi.fn(async () => {
                        throw plantedDbError();
                    }),
                },
                { targets: [target('s1', { topics: [symbolTopic('AAPL')] })] }
            );
            plantMineSignals(harness, { AAPL: ['golden_cross'] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.sent).toBe(1);
            expect(sentTo(harness, 's1@example.com')[0]?.text).toContain(
                '- AAPL'
            );
        });

        it('첫 슬롯은 담은 종목의 봉이 아직 기대 세션이 아닌 구독자를 선점하지 않고 최종 슬롯에 맡긴다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('late', {
                            topics: [symbolTopic('AAPL'), symbolTopic('PLTR')],
                        }),
                        target('ok', { topics: [symbolTopic('AAPL')] }),
                    ],
                }
            );
            plantMineSignals(harness, { AAPL: ['golden_cross'] });
            const fresh = harness.sources.loadDailyBars;
            harness.sources.loadDailyBars = vi.fn(async (symbol: string) =>
                symbol === 'PLTR' ? barsEndingOn('2026-11-20') : fresh(symbol)
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.deferredSymbolsNotReady).toBe(1);
            expect(counts.sent).toBe(1);
            expect(sentTo(harness, 'late@example.com')).toEqual([]);
            expect(sentTo(harness, 'ok@example.com')).toHaveLength(1);
            expect(harness.deliveries.claim).not.toHaveBeenCalledWith(
                'late',
                ALERT_DATE,
                expect.anything()
            );
        });

        it('첫 슬롯은 담은 종목의 일봉 조회가 실패한 구독자도 미룬다', async () => {
            const harness = makeHarness(
                {},
                { targets: [target('s1', { topics: [symbolTopic('BAD')] })] }
            );
            harness.sources.loadDailyBars = vi.fn(async () => {
                throw plantedDbError();
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.deferredSymbolsNotReady).toBe(1);
            expect(counts.quiet).toBe(0);
            expect(harness.deliveries.claim).not.toHaveBeenCalled();
        });

        it('최종 슬롯은 판정된 종목만으로 보내고 판정하지 못한 종목 코드를 한 줄로 남긴다', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', {
                            topics: [
                                symbolTopic('AAPL'),
                                symbolTopic('PLTR'),
                                symbolTopic('BAD'),
                            ],
                        }),
                    ],
                }
            );
            plantMineSignals(harness, { AAPL: ['golden_cross'] });
            const fresh = harness.sources.loadDailyBars;
            harness.sources.loadDailyBars = vi.fn(async (symbol: string) => {
                if (symbol === 'BAD') throw plantedDbError();
                return symbol === 'PLTR'
                    ? barsEndingOn('2026-11-20')
                    : fresh(symbol);
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(counts.deferredSymbolsNotReady).toBe(0);
            expect(counts.sent).toBe(1);
            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                ['s:us:AAPL:golden_cross'],
                []
            );
            const line = warn.mock.calls.find(
                ([message]) =>
                    message === '[mail-alert] symbols not ready at final slot:'
            );
            expect(line?.[1]).toBe(JSON.stringify(['BAD', 'PLTR']));
            // 구독자 주소·식별자와 오류 원문은 이 줄에 없다.
            const logged = JSON.stringify(warn.mock.calls);
            expect(logged).not.toContain('s1@example.com');
            expect(logged).not.toContain(PLANTED_TOKEN);
            expect(logged).not.toContain(PLANTED_EMAIL);
        });

        it('시장 조회가 실패한 종목도 첫 슬롯에서 그 구독자를 미룬다', async () => {
            const harness = makeHarness(
                {
                    resolveMarket: vi.fn(async () => {
                        throw new Error('lookup failed');
                    }),
                },
                { targets: [target('s1', { topics: [symbolTopic('AAPL')] })] }
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.deferredSymbolsNotReady).toBe(1);
            expect(harness.deliveries.claim).not.toHaveBeenCalled();
        });

        it('일봉으로 판정한 담은 종목의 새 신호가 메일에 실린다', async () => {
            const harness = makeHarness(
                {},
                { targets: [target('s1', { topics: [symbolTopic('PLTR')] })] }
            );
            const flat = barsEndingOn(US_SESSION);
            const last = flat.at(-1);
            // 마지막 봉이 장기 횡보를 뚫는다 — 코어가 허브 유형 신호(RSI 과매수 등)를 새로 판정한다.
            harness.sources.loadDailyBars = vi.fn(async () => [
                ...flat.slice(0, -1),
                { ...(last as Bar), high: 130, close: 130, volume: 5000 },
            ]);

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.sent).toBe(1);
            expect(sentTo(harness, 's1@example.com')[0]?.text).toContain(
                'PLTR'
            );
        });

        it('최종 슬롯에서 마지막 봉이 기대 세션이 아니면 항목이 없고 센다', async () => {
            const harness = makeHarness(
                {},
                { targets: [target('s1', { topics: [symbolTopic('PLTR')] })] }
            );
            harness.sources.loadDailyBars = vi.fn(async () =>
                barsEndingOn('2026-11-20')
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(counts.noFreshBar).toBe(1);
            expect(counts.quiet).toBe(1);
        });

        it('한 종목의 판정 오류는 그 종목만 세고 다른 종목은 계속한다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', {
                            topics: [symbolTopic('BAD'), symbolTopic('PLTR')],
                        }),
                    ],
                }
            );
            harness.sources.loadDailyBars = vi.fn(async (symbol: string) => {
                if (symbol === 'BAD') throw new Error('fmp down');
                return barsEndingOn('2026-11-20');
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.computeErrors).toBe(1);
            expect(counts.noFreshBar).toBe(1);
        });

        it('최종 슬롯에서 종목의 시장을 못 알아낸 오류도 그 종목만 세고, 주식이 아닌 종목은 건너뛴다', async () => {
            const harness = makeHarness(
                {
                    resolveMarket: vi.fn(async (symbol: string) => {
                        if (symbol === 'BAD') throw new Error('lookup failed');
                        return symbol === 'BTCUSD' ? null : 'us';
                    }),
                },
                {
                    targets: [
                        target('s1', {
                            topics: [
                                symbolTopic('BAD'),
                                symbolTopic('BTCUSD'),
                                symbolTopic('AAPL'),
                            ],
                        }),
                    ],
                }
            );
            plantMineSignals(harness, { AAPL: ['golden_cross'] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(counts.computeErrors).toBe(1);
            expect(counts.sent).toBe(1);
            expect(harness.deps.sources.loadDailyBars).not.toHaveBeenCalledWith(
                'BTCUSD'
            );
        });

        it('보유·관심종목 함께 받기를 켠 회원은 두 목록의 종목도 받는다', async () => {
            const harness = makeHarness(
                {
                    findHoldings: vi
                        .fn()
                        .mockResolvedValue([{ symbol: 'AAPL' }]),
                    findWatchlist: vi
                        .fn()
                        .mockResolvedValue([
                            { symbol: 'MSFT' },
                            { symbol: 'AAPL' },
                        ]),
                },
                {
                    targets: [
                        target('m1', {
                            userId: 'user-1',
                            includePortfolio: true,
                            topics: [],
                        }),
                    ],
                }
            );
            plantMineSignals(harness, {
                AAPL: ['golden_cross'],
                MSFT: ['rsi_overbought'],
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            const text = sentTo(harness, 'm1@example.com')[0]?.text ?? '';
            expect(counts.sent).toBe(1);
            expect(text).toContain('AAPL');
            expect(text).toContain('MSFT');
            expect(harness.deps.findHoldings).toHaveBeenCalledWith('user-1');
        });

        it('스위치가 꺼졌거나 연결된 회원이 없으면 보유·관심종목을 읽지 않는다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('g1', { includePortfolio: true, userId: null }),
                        target('m2', {
                            userId: 'user-2',
                            includePortfolio: false,
                        }),
                    ],
                }
            );

            await runMailAlertBatch(harness.deps, FIRST);

            expect(harness.deps.findHoldings).not.toHaveBeenCalled();
            expect(harness.deps.findWatchlist).not.toHaveBeenCalled();
        });

        it('보유·관심종목을 못 읽은 구독자는 이번 실행에서 건너뛰고 선점하지 않는다', async () => {
            const harness = makeHarness(
                {
                    findHoldings: vi
                        .fn()
                        .mockRejectedValue(new Error('db blip')),
                },
                {
                    targets: [
                        target('m1', {
                            userId: 'user-1',
                            includePortfolio: true,
                            topics: [signalTopic('golden_cross')],
                        }),
                    ],
                }
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.portfolioErrors).toBe(1);
            expect(counts.sent).toBe(0);
            expect(harness.deliveries.claim).not.toHaveBeenCalled();
        });
    });

    describe('공포·탐욕', () => {
        it('기대 세션에 극단 구간 진입이 있는 시장은 메일에 실린다', async () => {
            const neutral = Array.from({ length: 40 }, (_, i) => ({
                date: new Date(Date.UTC(2026, 9, 1 + i))
                    .toISOString()
                    .slice(0, 10),
                score: 50,
                label: 'NEUTRAL' as const,
            }));
            const harness = makeHarness(
                {},
                { targets: [target('s1', { topics: [fgTopic('crypto')] })] }
            );
            harness.sources.loadFearGreedHistory = vi.fn(async () => [
                ...neutral,
                {
                    date: '2026-11-23',
                    score: 15,
                    label: 'EXTREME_FEAR' as const,
                },
            ]);

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.sent).toBe(1);
            expect(sentTo(harness, 's1@example.com')[0]?.text).toContain(
                '크립토 공포 탐욕 지수가 극단적 공포에 들어섰어요'
            );
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                expect.any(String),
                'sent',
                ['f:crypto:EXTREME_FEAR'],
                null,
                false
            );
        });
    });

    describe('반복 방지와 정리', () => {
        it('최근에 보낸 항목은 빼고(조용한 날), 조회 창은 알림 날짜 7일 전부터다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            harness.deliveries.recentItemKeys.mockResolvedValue(
                new Map([['s1', new Set(['s:us:AAPL:golden_cross'])]])
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.suppressedItems).toBe(1);
            expect(counts.quiet).toBe(1);
            expect(harness.deliveries.recentItemKeys).toHaveBeenCalledWith(
                '2026-11-18'
            );
        });

        it('다른 구독자가 받은 항목은 이 구독자에게 영향을 주지 않는다', async () => {
            const targets = [
                target('s1', { topics: [signalTopic('golden_cross')] }),
                target('s2', { topics: [signalTopic('golden_cross')] }),
            ];
            const harness = makeHarness({}, { targets });
            harness.deliveries.recentItemKeys.mockResolvedValue(
                new Map([['s1', new Set(['s:us:AAPL:golden_cross'])]])
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });

            await runMailAlertBatch(harness.deps, FIRST);

            expect(sentTo(harness, 's1@example.com')).toHaveLength(0);
            expect(sentTo(harness, 's2@example.com')).toHaveLength(1);
        });

        it('발송 기록은 90일 전 알림 날짜 이전 것을 지운다', async () => {
            const harness = makeHarness();

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(harness.deliveries.pruneBefore).toHaveBeenCalledWith(
                '2026-08-27'
            );
            expect(counts.pruned).toBe(2);
        });

        it('정리가 실패해도 실행 결과는 그대로다', async () => {
            const harness = makeHarness();
            harness.deliveries.pruneBefore.mockRejectedValue(
                new Error('prune down')
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.pruned).toBe(0);
            expect(console.error).toHaveBeenCalledWith(
                '[mail-alert] prune failed',
                expect.anything()
            );
        });

        it('저장된 항목 중 모르는 종류·값은 무시한다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', {
                            topics: [
                                { kind: 'signal', key: 'cci_bullish_cross' },
                                { kind: 'symbol', key: 'not a symbol!' },
                                signalTopic('golden_cross'),
                            ],
                        }),
                    ],
                }
            );
            withEpisodes(harness, {
                us: [usEpisode('AAPL', 'cci_bullish_cross')],
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.quiet).toBe(1);
        });

        it('알림 유형 목록은 허브 유형과 같다(발송 대상 유형을 따로 두지 않는다)', () => {
            expect(MAIL_ALERT_SIGNAL_TYPES).toHaveLength(8);
        });
    });
    describe('가격대 알림', () => {
        function priceAlert(
            overrides: Partial<PriceAlertRecord> = {}
        ): PriceAlertRecord {
            return {
                id: 'alert-1',
                subscriberId: 's1',
                proposalId: 'proposal-1',
                symbol: 'AAPL',
                market: 'us',
                condition: { kind: 'close_below', level: 180 },
                basis: 'price_level',
                analysisAt: null,
                referenceClose: 190,
                startsAfterSession: '2026-11-20',
                expiresOn: '2026-12-20',
                status: 'active',
                firedSession: null,
                firedClose: null,
                firedAt: null,
                createdAt: new Date('2026-11-20T03:00:00Z'),
                ...overrides,
            };
        }

        /** 일봉: (세션, 종가) 쌍을 UTC 자정 봉으로 만든다. */
        function dailyBars(...closes: Array<[string, number]>): Bar[] {
            return closes.map(([session, close]) => ({
                time: Date.parse(`${session}T00:00:00Z`) / MS_PER_SECOND,
                open: close,
                high: close,
                low: close,
                close,
                volume: 1000,
            }));
        }

        /** 알림 하나(s1, AAPL 180 아래)와 그 종목의 일봉을 가진 하네스. 구독자는 알림 말고 받을 것이 없다. */
        function withAlert(
            closes: Array<[string, number]>,
            overrides: Partial<PriceAlertRecord> = {},
            depsOverrides: Partial<MailAlertBatchDeps> = {}
        ): Harness {
            const harness = makeHarness(depsOverrides, {
                targets: [target('s1')],
            });
            harness.alerts.push(priceAlert(overrides));
            harness.sources.loadDailyBars = vi.fn(async () =>
                dailyBars(...closes)
            );
            return harness;
        }

        const HIT: Array<[string, number]> = [
            ['2026-11-23', 185],
            ['2026-11-24', 179.5],
        ];

        it('알림만 가진 구독자도 조건을 충족한 날 아침 메일을 받고, 선점이 알림을 fired로 바꾼다', async () => {
            const harness = withAlert(HIT);

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts).toMatchObject({
                sent: 1,
                quiet: 0,
                priceAlertsActive: 1,
                priceAlertsFired: 1,
                priceAlertsVoided: 0,
                priceAlertBarErrors: 0,
            });
            const message = sentTo(harness, 's1@example.com')[0];
            expect(message?.subject).toBe(
                '[시그렌즈] 11월 25일 새로 잡힌 변화 1건'
            );
            expect(message?.text).toContain(tKo('sectionPriceAlert'));
            expect(message?.text).toContain('11월 24일 종가가 알림 가격');
            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                ['p:alert-1'],
                [{ id: 'alert-1', session: '2026-11-24', close: 179.5 }]
            );
            expect(harness.alerts[0]).toMatchObject({
                status: 'fired',
                firedSession: '2026-11-24',
                firedClose: 179.5,
            });
        });

        it('첫 슬롯은 알림 종목의 기대 세션 봉이 아직 없는 구독자를 미루고, 최종 슬롯이 그 세션의 종가로 알린다', async () => {
            const harness = withAlert([['2026-11-23', 185]]);

            const first = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(first.deferredSymbolsNotReady).toBe(1);
            expect(harness.deliveries.claim).not.toHaveBeenCalled();

            harness.sources.loadDailyBars = vi.fn(async () =>
                dailyBars(...HIT)
            );
            const final = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(final.sent).toBe(1);
            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                ['p:alert-1'],
                [{ id: 'alert-1', session: '2026-11-24', close: 179.5 }]
            );
        });

        it('첫 슬롯은 알림 종목의 일봉 조회가 실패한 구독자도 미룬다', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const harness = withAlert(HIT);
            harness.sources.loadDailyBars = vi.fn(async () => {
                throw new Error('fmp down');
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.deferredSymbolsNotReady).toBe(1);
            expect(counts.priceAlertBarErrors).toBe(1);
            expect(harness.deliveries.claim).not.toHaveBeenCalled();
        });

        it('최종 슬롯은 봉이 덜 찬 알림 종목을 미루지 않고 받은 봉까지 판정한다(그 종목 코드를 로그로 남긴다)', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const harness = withAlert([['2026-11-23', 179]]);

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(counts.deferredSymbolsNotReady).toBe(0);
            expect(counts.priceAlertsFired).toBe(1);
            expect(
                warn.mock.calls.some(
                    ([message, symbols]) =>
                        message ===
                            '[mail-alert] symbols not ready at final slot:' &&
                        symbols === JSON.stringify(['AAPL'])
                )
            ).toBe(true);
        });

        it('가격대 알림 줄의 종목은 다른 줄과 같은 이름 원천으로 부른다', async () => {
            const harness = withAlert(
                HIT,
                {},
                {
                    getSymbolNames: vi.fn(async () => ({
                        name: 'Apple Inc.',
                        koreanName: '애플',
                    })),
                }
            );

            await runMailAlertBatch(harness.deps, FIRST);

            expect(harness.deps.getSymbolNames).toHaveBeenCalledWith('AAPL');
            expect(sentTo(harness, 's1@example.com')[0]?.text).toContain(
                '애플 (AAPL)의 11월 24일 종가가 알림 가격'
            );
        });

        it('가격대 알림 줄은 같은 메일의 신호 줄보다 앞에 실린다(메일은 한 통이다)', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', {
                            topics: [signalTopic('golden_cross')],
                        }),
                    ],
                }
            );
            harness.alerts.push(priceAlert());
            harness.sources.loadDailyBars = vi.fn(async () =>
                dailyBars(...HIT)
            );
            withEpisodes(harness, { us: [usEpisode('MSFT')] });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            const [message] = sentTo(harness, 's1@example.com');
            expect(counts.sent).toBe(1);
            expect(message?.subject).toBe(
                '[시그렌즈] 11월 25일 새로 잡힌 변화 2건'
            );
            expect(
                message?.text.indexOf(tKo('sectionPriceAlert'))
            ).toBeLessThan(message?.text.indexOf('MSFT') ?? -1);
            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                ['p:alert-1', 's:us:MSFT:golden_cross'],
                [expect.objectContaining({ id: 'alert-1' })]
            );
        });

        it('미뤄진 날에 충족한 종가도 원래 세션 날짜로 메일에 실린다(상태 없는 재판정)', async () => {
            const harness = withAlert([
                ['2026-11-23', 178],
                ['2026-11-24', 190],
            ]);

            await runMailAlertBatch(harness.deps, FIRST);

            expect(sentTo(harness, 's1@example.com')[0]?.text).toContain(
                '11월 23일 종가가 알림 가격'
            );
            expect(harness.alerts[0]?.firedSession).toBe('2026-11-23');
        });

        it('알림을 만든 세션 이하의 종가는 알리지 않고 조용한 날이다', async () => {
            const harness = withAlert([
                ['2026-11-20', 175],
                ['2026-11-24', 185],
            ]);

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.quiet).toBe(1);
            expect(counts.priceAlertsActive).toBe(1);
            expect(harness.deliveries.claim).not.toHaveBeenCalled();
            expect(harness.alerts[0]?.status).toBe('active');
        });

        it('만료 세션을 판정하는 실행에서 그 세션의 종가가 충족하면 알려 한 통에 싣고, 다음 실행은 그 알림을 읽지 않고 정리한다', async () => {
            // 만료 세션(11-24)이 첫 실행의 기대 세션과 같다 — 알림 날짜(11-25)보다 하루 앞선다.
            const harness = withAlert(
                [
                    ['2026-11-23', 185],
                    ['2026-11-24', 179.5],
                ],
                { expiresOn: '2026-11-24' }
            );

            const first = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(first).toMatchObject({ priceAlertsActive: 1, sent: 1 });
            expect(sentTo(harness, 's1@example.com')[0]?.text).toContain(
                '11월 24일 종가가 알림 가격'
            );
            expect(
                harness.priceAlerts.listActiveForDelivery
            ).toHaveBeenCalledWith({ us: US_SESSION, kr: KR_SESSION });

            // 다음 날: 기대 세션이 11-25가 되어 만료 세션 11-24는 지난 것이다.
            harness.alerts.push(
                priceAlert({
                    id: 'alert-unfired',
                    subscriberId: 's1',
                    symbol: 'MSFT',
                    expiresOn: '2026-11-24',
                })
            );
            harness.sources.signalHistory.latestRecordedSession = vi
                .fn()
                .mockResolvedValue('2026-11-25');
            const next = countsOf(
                await runMailAlertBatch(harness.deps, NEXT_DAY_FIRST)
            );

            expect(
                harness.priceAlerts.listActiveForDelivery
            ).toHaveBeenLastCalledWith({ us: '2026-11-25', kr: '2026-11-25' });
            expect(next.priceAlertsActive).toBe(0);
            expect(
                harness.priceAlerts.pruneExpiredAndFired
            ).toHaveBeenLastCalledWith('2026-11-26', {
                us: '2026-11-25',
                kr: '2026-11-25',
            });
        });

        it('만료 세션이 기대 세션 전인 알림은 알림 날짜가 아직 안 지났어도 읽히지 않는다', async () => {
            const harness = withAlert(HIT, { expiresOn: '2026-11-24' });
            harness.alerts.push(
                priceAlert({
                    id: 'alert-old',
                    symbol: 'MSFT',
                    expiresOn: '2026-11-23',
                })
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.priceAlertsActive).toBe(1);
        });

        it('한 번 알린 알림은 같은 날 두 번째 실행에서 다시 알리지 않고, 다음 날에도 판정하지 않는다', async () => {
            const harness = withAlert(HIT);

            await runMailAlertBatch(harness.deps, FIRST);
            const sameDay = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );
            harness.sources.signalHistory.latestRecordedSession = vi
                .fn()
                .mockResolvedValue('2026-11-25');
            const nextDay = countsOf(
                await runMailAlertBatch(harness.deps, NEXT_DAY_FIRST)
            );

            expect(sentTo(harness, 's1@example.com')).toHaveLength(1);
            expect(sameDay.priceAlertsActive).toBe(0);
            expect(sameDay).toMatchObject({ quiet: 1, alreadyClaimed: 0 });
            expect(nextDay.priceAlertsActive).toBe(0);
            expect(harness.alerts[0]).toMatchObject({
                status: 'fired',
                firedSession: '2026-11-24',
            });
        });

        /** 판정 뒤, 선점 직전에 사용자가 알림을 지운 상황: 선점은 그 알림을 `fired`로 바꾸지 못한다. */
        function deleteAlertBeforeClaim(harness: Harness): void {
            harness.deliveries.claim.mockImplementation(
                async (
                    id: string,
                    date: string,
                    keys?: readonly string[],
                    fired?: readonly FiredPriceAlert[]
                ) => {
                    harness.alerts.splice(0, harness.alerts.length);
                    return harness.claimOnce(id, date, keys, fired);
                }
            );
        }

        it('선점 직전에 지워진 알림은 메일에 싣지 않고 fired로 세지 않는다(다른 줄은 그대로 나간다)', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', {
                            topics: [signalTopic('golden_cross')],
                        }),
                    ],
                }
            );
            harness.alerts.push(priceAlert());
            harness.sources.loadDailyBars = vi.fn(async () =>
                dailyBars(...HIT)
            );
            withEpisodes(harness, { us: [usEpisode('MSFT')] });
            deleteAlertBeforeClaim(harness);

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            const [message] = sentTo(harness, 's1@example.com');
            expect(counts.sent).toBe(1);
            expect(counts.priceAlertsFired).toBe(0);
            expect(message?.subject).toBe(
                '[시그렌즈] 11월 25일 새로 잡힌 변화 1건'
            );
            expect(message?.text).not.toContain(tKo('sectionPriceAlert'));
            expect(message?.text).toContain('MSFT');
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                `claim-s1|${ALERT_DATE}`,
                'sent',
                ['s:us:MSFT:golden_cross'],
                null,
                false
            );
        });

        it('실을 것이 지워진 알림뿐이면 빈 메일을 보내지 않고 선점 행을 보내지 않은 기록으로 닫는다', async () => {
            const harness = withAlert(HIT);
            deleteAlertBeforeClaim(harness);

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(harness.sent).toEqual([]);
            expect(counts).toMatchObject({
                sent: 0,
                failed: 0,
                quiet: 1,
                priceAlertsFired: 0,
            });
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                `claim-s1|${ALERT_DATE}`,
                'failed',
                [],
                'nothing left to send',
                true
            );
        });

        it('같은 알림을 읽은 두 번째 실행이 선점에서 지면 알림을 바꾸지 않고 fired로 세지 않는다', async () => {
            const harness = withAlert(HIT);
            harness.claims.add(`s1|${ALERT_DATE}`);

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.alreadyClaimed).toBe(1);
            expect(counts.priceAlertsFired).toBe(0);
            expect(harness.sent).toEqual([]);
            expect(harness.alerts[0]?.status).toBe('active');
        });

        it('발송기가 확정적으로 거절하면 알림을 되살리도록 finish에 알리고, 같은 날 다시 보내지 않는다', async () => {
            const harness = withAlert(
                HIT,
                {},
                { dispatcher: keyedDispatcher(async () => 'rejected') }
            );

            const first = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );
            const final = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(first.failed).toBe(1);
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                `claim-s1|${ALERT_DATE}`,
                'failed',
                ['p:alert-1'],
                'dispatcher rejected',
                true
            );
            expect(final.sent).toBe(0);
        });

        it('미뤄진 첫 슬롯은 알림을 읽지도 일봉을 받지도 않는다', async () => {
            const harness = withAlert(HIT);
            harness.sources.signalHistory.latestRecordedSession = vi
                .fn()
                .mockResolvedValue('2026-11-20');

            const result = await runMailAlertBatch(harness.deps, FIRST);

            expect(result.status).toBe('deferred');
            expect(
                harness.priceAlerts.listActiveForDelivery
            ).not.toHaveBeenCalled();
            expect(harness.sources.loadDailyBars).not.toHaveBeenCalled();
            expect(harness.alerts[0]?.status).toBe('active');
        });

        it('최종 슬롯은 신호 기록이 덜 준비돼도 알림을 판정해 보낸다', async () => {
            const harness = withAlert(HIT);
            harness.sources.signalHistory.latestRecordedSession = vi
                .fn()
                .mockResolvedValue('2026-11-20');

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(counts.sent).toBe(1);
        });

        it('분할로 가격 척도가 달라진 알림은 메일이 한 줄로 알리고, 메일이 나간 뒤 finish가 지운다', async () => {
            const harness = withAlert(
                [
                    ['2026-11-20', 95],
                    ['2026-11-24', 94],
                ],
                { referenceClose: 190 }
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                ['v:alert-1'],
                []
            );
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                `claim-s1|${ALERT_DATE}`,
                'sent',
                ['v:alert-1'],
                null,
                false
            );
            expect(harness.alerts).toEqual([]);
            expect(counts).toMatchObject({
                priceAlertsVoided: 1,
                priceAlertsFired: 0,
                sent: 1,
                quiet: 0,
            });
            const text = sentTo(harness, 's1@example.com')[0]?.text;
            expect(text).toContain(
                'AAPL 가격 기준이 크게 바뀌어(예: 주식 분할) 가격대 알림을 끝냈어요.'
            );
            expect(
                harness.priceAlerts.removeSubscriberIfNothingToReceive
            ).toHaveBeenCalledWith('s1');
        });

        describe('끝낸 알림의 삭제는 메일 결과를 따른다', () => {
            const SPLIT_CLOSES: Array<[string, number]> = [
                ['2026-11-20', 95],
                ['2026-11-24', 94],
            ];

            it('확정적 거절이면 알림이 남아 다음 실행이 다시 알리고, 구독자 정리도 하지 않는다', async () => {
                const harness = withAlert(
                    SPLIT_CLOSES,
                    { referenceClose: 190 },
                    { dispatcher: keyedDispatcher(async () => 'rejected') }
                );

                const counts = countsOf(
                    await runMailAlertBatch(harness.deps, FIRST)
                );

                expect(harness.deliveries.finish).toHaveBeenCalledWith(
                    `claim-s1|${ALERT_DATE}`,
                    'failed',
                    ['v:alert-1'],
                    'dispatcher rejected',
                    true
                );
                expect(harness.alerts).toHaveLength(1);
                expect(counts.priceAlertsVoided).toBe(0);
                expect(
                    harness.priceAlerts.removeSubscriberIfNothingToReceive
                ).not.toHaveBeenCalled();
            });

            it('보내다 던져 나갔는지 알 수 없으면 알림을 지운다(안내가 나갔을 수 있다)', async () => {
                const harness = withAlert(
                    SPLIT_CLOSES,
                    { referenceClose: 190 },
                    {
                        dispatcher: keyedDispatcher(async () => {
                            throw new Error('provider down');
                        }),
                    }
                );

                const counts = countsOf(
                    await runMailAlertBatch(harness.deps, FIRST)
                );

                expect(harness.deliveries.finish).toHaveBeenCalledWith(
                    `claim-s1|${ALERT_DATE}`,
                    'failed',
                    ['v:alert-1'],
                    expect.any(String),
                    false
                );
                expect(harness.alerts).toEqual([]);
                expect(counts.priceAlertsVoided).toBe(1);
            });

            it('보내기 전에 실패하면(메일을 만들다 던짐) 나가지 않은 것이라 알림을 남기고 알린 알림도 되살린다', async () => {
                const harness = withAlert(
                    HIT,
                    {},
                    {
                        getDisclaimer: async () => {
                            throw new Error('catalog down');
                        },
                    }
                );

                await runMailAlertBatch(harness.deps, FIRST);

                expect(harness.deliveries.finish).toHaveBeenCalledWith(
                    `claim-s1|${ALERT_DATE}`,
                    'failed',
                    ['p:alert-1'],
                    expect.any(String),
                    true
                );
                expect(harness.alerts[0]?.status).toBe('active');
            });

            it('발송을 받아 줬는데 결과 기록이 실패하면 알림은 그대로 두고 센 것도 없다', async () => {
                const harness = withAlert(SPLIT_CLOSES, {
                    referenceClose: 190,
                });
                harness.deliveries.finish.mockRejectedValue(
                    new Error('db down')
                );

                const counts = countsOf(
                    await runMailAlertBatch(harness.deps, FIRST)
                );

                expect(counts.priceAlertsVoided).toBe(0);
                expect(
                    harness.priceAlerts.removeSubscriberIfNothingToReceive
                ).not.toHaveBeenCalled();
            });
        });

        it('끝낸 알림 안내 줄은 한국 종목을 접미사 없는 코드로 말한다', async () => {
            const harness = withAlert(
                [
                    ['2026-11-20', 35000],
                    ['2026-11-24', 35500],
                ],
                {
                    symbol: '005930.KS',
                    market: 'kr',
                    referenceClose: 70000,
                    condition: { kind: 'close_below', level: 68000 },
                }
            );

            await runMailAlertBatch(harness.deps, FIRST);

            const text = sentTo(harness, 's1@example.com')[0]?.text ?? '';
            expect(text).toContain('005930 가격 기준이 크게 바뀌어');
            expect(text).not.toContain('005930.KS 가격 기준');
        });

        it('선점에서 지면 끝낼 알림은 남아 있고 다음 실행이 다시 알린다(정리도 하지 않는다)', async () => {
            const harness = withAlert(
                [
                    ['2026-11-20', 95],
                    ['2026-11-24', 94],
                ],
                { referenceClose: 190 }
            );
            harness.claims.add(`s1|${ALERT_DATE}`);

            const first = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(first).toMatchObject({
                alreadyClaimed: 1,
                priceAlertsVoided: 0,
            });
            expect(harness.alerts).toHaveLength(1);
            expect(
                harness.priceAlerts.removeSubscriberIfNothingToReceive
            ).not.toHaveBeenCalled();

            harness.claims.clear();
            const next = countsOf(await runMailAlertBatch(harness.deps, FINAL));

            expect(next.priceAlertsVoided).toBe(1);
            expect(harness.alerts).toEqual([]);
        });

        it('끝낸 알림 안내와 충족한 알림은 한 통에 함께 실린다', async () => {
            const harness = withAlert(HIT);
            harness.alerts.push(
                priceAlert({
                    id: 'alert-split',
                    symbol: 'MSFT',
                    referenceClose: 400,
                    condition: { kind: 'close_below', level: 390 },
                })
            );
            harness.sources.loadDailyBars = vi.fn(async (symbol: string) =>
                symbol === 'AAPL'
                    ? dailyBars(...HIT)
                    : dailyBars(['2026-11-20', 200], ['2026-11-24', 150])
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts).toMatchObject({
                sent: 1,
                priceAlertsFired: 1,
                priceAlertsVoided: 1,
            });
            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                ['p:alert-1', 'v:alert-split'],
                [expect.objectContaining({ id: 'alert-1' })]
            );
            expect(sentTo(harness, 's1@example.com')).toHaveLength(1);
        });

        it('받을 것이 없어졌는지 정리하다 실패해도 로그만 남기고 실행은 끝낸다', async () => {
            const harness = withAlert(
                [
                    ['2026-11-20', 95],
                    ['2026-11-24', 94],
                ],
                { referenceClose: 190 }
            );
            harness.priceAlerts.removeSubscriberIfNothingToReceive.mockRejectedValue(
                plantedDbError()
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.sent).toBe(1);
            expect(console.error).toHaveBeenCalledWith(
                '[mail-alert] could not clean up subscriber s1',
                expect.not.stringContaining(PLANTED_TOKEN)
            );
        });

        it('한 종목의 일봉 오류는 세고 그 알림만 건너뛴다(다른 구독자의 알림은 계속)', async () => {
            const harness = makeHarness(
                {},
                { targets: [target('s1'), target('s2')] }
            );
            harness.alerts.push(
                priceAlert(),
                priceAlert({
                    id: 'alert-2',
                    subscriberId: 's2',
                    symbol: 'MSFT',
                    referenceClose: 410,
                    condition: { kind: 'close_below', level: 405 },
                })
            );
            harness.sources.loadDailyBars = vi.fn(async (symbol: string) => {
                if (symbol === 'AAPL') throw new Error('bars down');
                return dailyBars(['2026-11-24', 400]);
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts).toMatchObject({
                priceAlertBarErrors: 1,
                priceAlertsFired: 1,
                sent: 1,
            });
            expect(sentTo(harness, 's1@example.com')).toHaveLength(0);
            expect(sentTo(harness, 's2@example.com')).toHaveLength(1);
            expect(harness.alerts[0]?.status).toBe('active');
        });

        it('담은 종목의 신호 판정과 알림 판정은 일봉을 한 번만 읽는다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [target('s1', { topics: [symbolTopic('PLTR')] })],
                }
            );
            harness.alerts.push(priceAlert({ symbol: 'PLTR' }));
            harness.sources.loadDailyBars = vi.fn(async () =>
                dailyBars(['2026-11-24', 179.5])
            );

            await runMailAlertBatch(harness.deps, FIRST);

            expect(harness.sources.loadDailyBars).toHaveBeenCalledTimes(1);
        });

        it('진행 중인 알림을 읽지 못하면 로그만 남기고 신호 메일은 그대로 보낸다', async () => {
            const harness = makeHarness(
                {},
                {
                    targets: [
                        target('s1', { topics: [signalTopic('golden_cross')] }),
                    ],
                }
            );
            withEpisodes(harness, { us: [usEpisode('AAPL')] });
            harness.priceAlerts.listActiveForDelivery.mockRejectedValue(
                plantedDbError()
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.sent).toBe(1);
            expect(counts.priceAlertsActive).toBe(0);
            expect(console.error).toHaveBeenCalledWith(
                '[mail-alert] price alert evaluation failed',
                expect.not.stringContaining(PLANTED_TOKEN)
            );
        });

        it('알림 테이블이 없으면(42P01) 실행 전체가 disabled로 끝난다', async () => {
            const harness = withAlert(HIT);
            harness.priceAlerts.listActiveForDelivery.mockRejectedValue(
                new Error('Failed query', {
                    cause: Object.assign(new Error('relation missing'), {
                        code: '42P01',
                    }),
                })
            );

            const result = await runMailAlertBatch(harness.deps, FIRST);

            expect(result).toEqual({
                status: 'disabled',
                reason: 'missing_table',
            });
        });

        it('실행 끝에 알림 날짜로 만료·보존 기간이 지난 알림을 정리하고 개수를 센다', async () => {
            const harness = makeHarness();
            harness.priceAlerts.pruneExpiredAndFired.mockResolvedValue({
                alertsDeleted: 3,
                subscribersDeleted: 1,
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(
                harness.priceAlerts.pruneExpiredAndFired
            ).toHaveBeenCalledWith(ALERT_DATE, {
                us: US_SESSION,
                kr: KR_SESSION,
            });
            expect(counts).toMatchObject({
                priceAlertsPruned: 3,
                priceAlertSubscribersPruned: 1,
            });
        });

        it('알림 정리가 실패해도 발송 기록 정리와 실행 결과는 그대로다', async () => {
            const harness = makeHarness();
            harness.priceAlerts.pruneExpiredAndFired.mockRejectedValue(
                plantedDbError()
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.pruned).toBe(2);
            expect(counts.priceAlertsPruned).toBe(0);
            expect(console.error).toHaveBeenCalledWith(
                '[mail-alert] price alert prune failed',
                expect.not.stringContaining(PLANTED_TOKEN)
            );
        });
    });
    describe('달라진 점', () => {
        const CLOSES = [
            ...Array.from({ length: 60 }, (_, i) => 100 + (i % 2 ? 0.5 : -0.5)),
            ...Array.from({ length: 25 }, (_, i) => 100 + (i + 1) * 3),
        ];

        /** 마지막 봉이 `session`인 일봉. 종가열은 64봉째에서 중립 → 강세로 바뀌고 어제 109, 오늘 112다. */
        function barsOf(closes: readonly number[], session: string): Bar[] {
            const last = Date.parse(`${session}T00:00:00Z`) / MS_PER_SECOND;
            return closes.map((close, i) => ({
                time: last - (closes.length - 1 - i) * SECONDS_PER_DAY,
                open: close,
                high: close + 1,
                low: close - 1,
                close,
                volume: 1000,
            }));
        }

        const TREND_BARS = barsOf(CLOSES.slice(0, 64), US_SESSION);
        const ANALYZED_AT = new Date(
            (TREND_BARS[60]?.time ?? 0) * MS_PER_SECOND
        );
        const STORED = {
            keyLevels: {
                support: [{ price: 110 }],
                resistance: [{ price: 140 }],
            },
            actionRecommendation: {
                entryPrices: [111, 113],
                stopLoss: 100,
                takeProfitPrices: [140],
            },
        };

        function trendHarness(
            overrides: Partial<MailAlertBatchDeps> = {},
            targets: MailAlertDeliveryTarget[] = [
                target('s1', { topics: [symbolTopic('AAPL')] }),
            ]
        ): Harness {
            const harness = makeHarness(overrides, { targets });
            harness.sources.loadDailyBars = vi.fn(async () => TREND_BARS);
            return harness;
        }

        it('에피소드가 없는 날도 담은 종목의 추세 판정이 바뀌면 그 종목 한 줄로 메일을 보낸다', async () => {
            const harness = trendHarness();

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            const message = sentTo(harness, 's1@example.com')[0];
            expect(counts.sent).toBe(1);
            expect(counts.changeSymbols).toBe(1);
            expect(counts.changeLines).toBe(1);
            expect(message?.text).toContain('[담은 종목에서 달라진 점]');
            expect(message?.text).toContain(
                '추세 판정이 보합에서 강세로 바뀌었어요.'
            );
            expect(message?.text).toContain(
                '기준: 종가와 20일 지수이동평균의 기울기'
            );
        });

        it('스캐너 대상 종목의 일봉도 종목당 한 번만 읽는다(가격대 알림과 같은 읽기를 나눈다)', async () => {
            const harness = trendHarness({}, [
                target('s1', { topics: [symbolTopic('AAPL')] }),
            ]);
            harness.alerts.push({
                id: 'alert-1',
                subscriberId: 's1',
                proposalId: 'proposal-1',
                symbol: 'AAPL',
                market: 'us',
                condition: { kind: 'close_below', level: 50 },
                basis: 'price_level',
                analysisAt: null,
                referenceClose: 100,
                startsAfterSession: '2026-11-20',
                expiresOn: '2026-12-20',
                status: 'active',
                firedSession: null,
                firedClose: null,
                firedAt: null,
                createdAt: new Date('2026-11-20T03:00:00Z'),
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.barLoads).toBe(1);
            const loadedSymbols = vi
                .mocked(harness.sources.loadDailyBars)
                .mock.calls.map(([symbol]) => symbol);
            expect(
                loadedSymbols.filter(symbol => symbol === 'AAPL')
            ).toHaveLength(1);
        });

        it('최근에 이미 보낸 추세 줄은 방향이 달라도 다시 보내지 않는다(종목당 7일에 한 줄)', async () => {
            const harness = trendHarness();
            harness.deliveries.recentItemKeys.mockResolvedValue(
                new Map([['s1', new Set(['t:us:AAPL'])]])
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FIRST)
            );

            expect(counts.quiet).toBe(1);
            expect(counts.suppressedItems).toBe(1);
            expect(harness.sent).toHaveLength(0);
        });

        it('보낸 추세 줄의 키는 종목 단위로 기록한다', async () => {
            const harness = trendHarness();

            await runMailAlertBatch(harness.deps, FIRST);

            expect(harness.deliveries.claim).toHaveBeenCalledWith(
                's1',
                ALERT_DATE,
                ['t:us:AAPL'],
                []
            );
        });

        it('최종 슬롯은 일봉을 못 읽은 종목만 세고 다른 종목의 줄은 계속 보낸다(첫 슬롯은 미룬다)', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const harness = trendHarness({}, [
                target('s1', {
                    topics: [symbolTopic('BAD'), symbolTopic('AAPL')],
                }),
            ]);
            harness.sources.loadDailyBars = vi.fn(async (symbol: string) => {
                if (symbol === 'BAD') throw new Error('fmp down');
                return TREND_BARS;
            });

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(counts.changeBarErrors).toBe(1);
            expect(counts.sent).toBe(1);
        });

        it('최종 슬롯에서 마지막 봉이 기대 세션이 아니면 달라진 점도 없다', async () => {
            const harness = trendHarness();
            harness.sources.loadDailyBars = vi.fn(async () =>
                barsOf(CLOSES.slice(0, 64), '2026-11-20')
            );

            const counts = countsOf(
                await runMailAlertBatch(harness.deps, FINAL)
            );

            expect(counts.noFreshBar).toBe(1);
            expect(counts.changeLines).toBe(0);
            expect(counts.quiet).toBe(1);
        });

        it('종목 항목 하나만 가진 구독자도 달라진 점 메일을 받는다(구독 종류는 그대로다, 삭제 규칙은 DB 테스트가 본다)', async () => {
            const harness = trendHarness({}, [
                target('s1', { topics: [symbolTopic('AAPL')] }),
            ]);

            await runMailAlertBatch(harness.deps, FIRST);

            expect(
                harness.deps.subscribers.findAllForDelivery
            ).toHaveBeenCalledTimes(1);
            expect(sentTo(harness, 's1@example.com')).toHaveLength(1);
        });

        describe('가격대와 진입 구간(저장된 분석)', () => {
            const reference = {
                generatedAt: ANALYZED_AT,
                result: STORED,
            };

            function withReferences(
                tierOf: (userId: string) => Tier,
                rows = new Map([['AAPL', reference]])
            ) {
                const load = vi.fn<
                    NonNullable<AlertSourceDeps['loadChangeReferences']>
                >(async () => rows);
                const deps: Partial<MailAlertBatchDeps> = {
                    resolveTier: vi.fn(async (userId: string) =>
                        tierOf(userId)
                    ),
                };
                return { load, deps };
            }

            it('회원은 같은 종목의 분석에서 읽은 진입 구간과 지지선 줄을, 비회원은 추세 줄만 받는다', async () => {
                const { deps, load } = withReferences(() => 'member');
                const harness = trendHarness(deps, [
                    target('guest', { topics: [symbolTopic('AAPL')] }),
                    target('member', {
                        userId: 'user-1',
                        topics: [symbolTopic('AAPL')],
                    }),
                ]);
                harness.sources.loadChangeReferences = load;

                const counts = countsOf(
                    await runMailAlertBatch(harness.deps, FIRST)
                );

                const guestText = sentTo(harness, 'guest@example.com')[0]?.text;
                const memberText = sentTo(harness, 'member@example.com')[0]
                    ?.text;
                expect(guestText).toContain('추세 판정이');
                expect(guestText).not.toContain('지지선');
                expect(guestText).not.toContain('진입 구간');
                expect(memberText).toContain(
                    '지지선 $110.00 위로 올라와 마감했어요.'
                );
                expect(memberText).toContain(
                    '진입 구간 $111.00~$113.00 안에서 마감했어요.'
                );
                expect(memberText).toContain(
                    '기준: 11월 21일 AI 분석의 진입 구간'
                );
                expect(counts.changeReferences).toBe(1);
                expect(counts.changeLines).toBe(1 + 3);
            });

            it('가격대를 보지 못하는 구독자만 있으면 분석을 읽지 않는다', async () => {
                const { deps, load } = withReferences(() => 'free');
                const harness = trendHarness(deps, [
                    target('guest', { topics: [symbolTopic('AAPL')] }),
                    target('free', {
                        userId: 'user-1',
                        topics: [symbolTopic('AAPL')],
                    }),
                ]);
                harness.sources.loadChangeReferences = load;

                await runMailAlertBatch(harness.deps, FIRST);

                expect(load).not.toHaveBeenCalled();
                expect(harness.sent).toHaveLength(2);
            });

            it('분석은 알림 날짜에서 30일 전 자정(KST)부터 읽는다', async () => {
                const { deps, load } = withReferences(() => 'member');
                const harness = trendHarness(deps, [
                    target('member', {
                        userId: 'user-1',
                        topics: [symbolTopic('AAPL')],
                    }),
                ]);
                harness.sources.loadChangeReferences = load;

                await runMailAlertBatch(harness.deps, FIRST);

                expect(load).toHaveBeenCalledWith(
                    ['AAPL'],
                    new Date('2026-10-26T00:00:00+09:00')
                );
            });

            it('분석을 읽지 못해도 추세 줄은 그대로 나간다', async () => {
                vi.spyOn(console, 'error').mockImplementation(() => {});
                const { deps } = withReferences(() => 'member');
                const harness = trendHarness(deps, [
                    target('member', {
                        userId: 'user-1',
                        topics: [symbolTopic('AAPL')],
                    }),
                ]);
                harness.sources.loadChangeReferences = vi.fn(async () => {
                    throw new Error('db down');
                });

                const counts = countsOf(
                    await runMailAlertBatch(harness.deps, FIRST)
                );

                expect(counts.sent).toBe(1);
                expect(counts.changeReferences).toBe(0);
                expect(
                    sentTo(harness, 'member@example.com')[0]?.text
                ).toContain('추세 판정이');
            });

            it('등급을 읽지 못한 회원은 비회원처럼 추세 줄만 받는다', async () => {
                vi.spyOn(console, 'error').mockImplementation(() => {});
                const { load } = withReferences(() => 'member');
                const harness = trendHarness(
                    {
                        resolveTier: vi.fn(async () => {
                            throw new Error('tier down');
                        }),
                    },
                    [
                        target('member', {
                            userId: 'user-1',
                            topics: [symbolTopic('AAPL')],
                        }),
                    ]
                );
                harness.sources.loadChangeReferences = load;

                await runMailAlertBatch(harness.deps, FIRST);

                expect(load).not.toHaveBeenCalled();
                expect(
                    sentTo(harness, 'member@example.com')[0]?.text
                ).not.toContain('지지선');
            });

            it('등급을 읽는 수단이 없으면 모든 구독자를 비회원으로 본다', async () => {
                const harness = trendHarness({}, [
                    target('member', {
                        userId: 'user-1',
                        topics: [symbolTopic('AAPL')],
                    }),
                ]);
                harness.sources.loadChangeReferences = vi.fn(
                    async () => new Map([['AAPL', reference]])
                );

                await runMailAlertBatch(harness.deps, FIRST);

                expect(
                    harness.sources.loadChangeReferences
                ).not.toHaveBeenCalled();
            });
        });
    });
});
