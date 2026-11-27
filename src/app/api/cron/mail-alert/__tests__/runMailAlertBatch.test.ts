vi.mock('server-only', () => ({}));

/**
 * 담은 종목의 일봉 판정을 심는 표. 키는 마지막 봉의 거래량(표지)이고 값은 그 봉에서 "새로 켜진" 신호 유형이다.
 * 표지가 없는 봉은 진짜 코어 판정을 그대로 쓴다.
 */
const planted = vi.hoisted(() => ({
    newSignals: new Map<number, readonly string[]>(),
}));

vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        detectNewConfirmedSignals: (bars: Bar[]) => {
            const tag = bars.at(-1)?.volume;
            const types =
                tag === undefined ? undefined : planted.newSignals.get(tag);
            return types === undefined
                ? actual.detectNewConfirmedSignals(bars)
                : types.map(type => ({ type }));
        },
    };
});

import type { Bar, SignalType } from '@y0ngha/siglens-core';
import { MAIL_ALERT_SIGNAL_TYPES } from '@/entities/mail-alert/lib/mailAlertConstants';
import type {
    MailAlertDeliveryRepository,
    MailAlertDeliveryTarget,
} from '@/shared/db/types';
import type {
    EmailMessage,
    KeyedEmailDispatcher,
    KeyedEmailOutcome,
} from '@/shared/email/types';
import {
    PLANTED_EMAIL,
    PLANTED_TOKEN,
    plantedDbError,
} from '@/shared/test-utils/plantedDbError';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
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
    const last = Date.parse(`${session}T00:00:00Z`) / 1000;
    return Array.from({ length: count }, (_, i) => ({
        time: last - (count - 1 - i) * 86_400,
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
        alertDate: string
    ) => Promise<string | null>;
    sent: EmailMessage[];
    claims: Set<string>;
    deliveries: {
        [K in keyof MailAlertDeliveryRepository]: ReturnType<typeof vi.fn>;
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
    const claimOnce = async (subscriberId: string, alertDate: string) => {
        const key = `${subscriberId}|${alertDate}`;
        if (claims.has(key)) return null;
        claims.add(key);
        return `claim-${key}`;
    };
    const deliveries = {
        claim: vi.fn(claimOnce),
        finish: vi.fn().mockResolvedValue(undefined),
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
    return { deps, sources, claimOnce, sent, claims, deliveries };
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

        it('발송 대상을 이번 실행의 알림 날짜로 읽는다(가격대 알림 만료 판정이 같은 시계를 쓴다)', async () => {
            const harness = makeHarness();

            await runMailAlertBatch(harness.deps, FIRST);

            expect(
                harness.deps.subscribers.findAllForDelivery
            ).toHaveBeenCalledWith(ALERT_DATE);
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
                ['s:us:AAPL:golden_cross']
            );
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                `claim-s1|${ALERT_DATE}`,
                'sent',
                ['s:us:AAPL:golden_cross'],
                null
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
                expect.arrayContaining(allKeys)
            );
            expect(sentTo(harness, 's1@example.com')[0]?.subject).toContain(
                '10건'
            );
            expect(harness.deliveries.finish).toHaveBeenCalledWith(
                expect.any(String),
                'sent',
                expect.arrayContaining(allKeys),
                null
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
                'dispatcher rejected'
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
                    null
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
                async (id: string, date: string) => {
                    if (id === 'bad') throw new Error('claim failed');
                    return harness.claimOnce(id, date);
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
                ['s:us:AAPL:rsi_oversold']
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
                ['s:us:AAPL:golden_cross']
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

        it('판정한 대상 밖 종목의 새 신호가 메일에 실린다', async () => {
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
                null
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
});
