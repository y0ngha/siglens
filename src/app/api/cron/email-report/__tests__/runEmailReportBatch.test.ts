import {
    BATCH_DEADLINE_MS,
    BRIEF_CONCURRENCY,
    DELIVERY_RETENTION_MS,
    runEmailReportBatch,
    selectDueRecipients,
    type EmailReportBatchDeps,
} from '@/app/api/cron/email-report/runEmailReportBatch';
import { defined } from '@/shared/test-utils/defined';
import type { SymbolDrawings } from '@/app/api/cron/email-report/loadSymbolDrawings';
import { weekdaysToMask } from '@/entities/email-report/lib/weekdayMask';
import type {
    SymbolBrief,
    SymbolReport,
} from '@/entities/email-report/reportModel';
import {
    WELCOME_STALE_SENDING_MS,
    WELCOME_SUPPRESSES_REPORT_MS,
} from '@/entities/email-report/lib/emailReportConstants';
import type {
    EmailReportRecipient,
    EmailReportWelcomeRecipient,
} from '@/shared/db/types';
import type { EmailMessage } from '@/shared/email/types';
import {
    PLANTED_EMAIL,
    PLANTED_TOKEN,
    plantedDbError,
} from '@/shared/test-utils/plantedDbError';

// 2026-10-04(일) 23:00 UTC = 2026-10-05(월) 08:00 KST
const NOW = new Date('2026-10-04T23:00:00.000Z');
const SECRET = 'batch-secret-batch-secret-batch-secret';

function recipient(
    overrides: Partial<EmailReportRecipient> = {}
): EmailReportRecipient {
    return {
        userId: 'u-1',
        email: 'one@example.com',
        daysOfWeek: weekdaysToMask([1]),
        sendHour: 8,
        timezone: 'Asia/Seoul',
        locale: 'ko',
        ...overrides,
    };
}

function welcomeRecipient(
    overrides: Partial<EmailReportWelcomeRecipient> = {}
): EmailReportWelcomeRecipient {
    return {
        ...recipient({ userId: 'w-1', email: 'welcome@example.com' }),
        consentedAt: new Date('2026-10-04T22:30:00.000Z'),
        attempts: 1,
        ...overrides,
    };
}

function report(symbol: string): SymbolReport {
    return {
        symbol,
        technical: null,
        plain: null,
        news: [],
        options: null,
        analyzedAt: null,
    };
}

function brief(symbol: string): SymbolBrief {
    return {
        symbol,
        names: null,
        close: 100,
        changePercent: 1.5,
        trend: 'uptrend',
        signals: {
            score: 60,
            bullish: ['golden_cross'],
            bearish: [],
            fresh: [],
            pullback: null,
        },
    };
}

function makeDeps(overrides: Partial<EmailReportBatchDeps> = {}) {
    let claimSeq = 0;
    const sent: EmailMessage[] = [];
    const sendEmail = vi.fn(async (message: EmailMessage) => {
        sent.push(message);
        return true;
    });
    const deps: EmailReportBatchDeps = {
        subscriptions: {
            findEnabledRecipients: vi.fn().mockResolvedValue([recipient()]),
        },
        deliveries: {
            claim: vi.fn(async () => `claim-${++claimSeq}`),
            finish: vi.fn().mockResolvedValue(undefined),
            pruneOlderThan: vi.fn().mockResolvedValue(3),
        },
        welcomes: {
            claimDue: vi.fn().mockResolvedValue([]),
            finish: vi.fn().mockResolvedValue(undefined),
            findWelcomed: vi.fn().mockResolvedValue(new Set<string>()),
            pruneOlderThan: vi.fn().mockResolvedValue(0),
        },
        findHoldings: vi.fn().mockResolvedValue([
            { symbol: 'AAPL', quantity: '1', averagePrice: '100' },
            { symbol: 'MSFT', quantity: '1', averagePrice: '300' },
        ]),
        findWatchlist: vi.fn().mockResolvedValue([]),
        findExcludedSymbols: vi.fn().mockResolvedValue([]),
        loadReport: vi.fn(async (symbol: string) => report(symbol)),
        loadBrief: vi.fn(async (symbol: string) => brief(symbol)),
        loadMarketPicks: vi.fn().mockResolvedValue([]),
        loadDrawings: vi.fn(async () => new Map()),
        getSkillLabel: vi
            .fn()
            .mockResolvedValue((name: string): string => name),
        getTranslator: vi.fn().mockResolvedValue((key: string) => key),
        getSignalLabel: vi
            .fn()
            .mockResolvedValue((type: string): string | null => type),
        dispatcher: {
            sendEmail,
            sendKeyedEmail: vi.fn(async (message: EmailMessage) =>
                (await sendEmail(message))
                    ? ('accepted' as const)
                    : ('rejected' as const)
            ),
        },
        secret: SECRET,
        siteUrl: 'https://siglens.io',
        ...overrides,
    };
    return { deps, sent };
}

describe('selectDueRecipients', () => {
    it('로컬 요일·시가 맞는 회원만 로컬 날짜와 함께 고른다', () => {
        const due = selectDueRecipients(
            [
                recipient({ userId: 'seoul' }),
                recipient({ userId: 'wrong-hour', sendHour: 9 }),
                recipient({
                    userId: 'ny',
                    timezone: 'America/New_York',
                    daysOfWeek: weekdaysToMask([0]),
                    sendHour: 19,
                }),
                recipient({ userId: 'broken-tz', timezone: 'Mars/Base' }),
            ],
            NOW
        );

        expect(due).toEqual([
            {
                recipient: expect.objectContaining({ userId: 'seoul' }),
                localDate: '2026-10-05',
            },
            {
                recipient: expect.objectContaining({ userId: 'ny' }),
                localDate: '2026-10-04',
            },
        ]);
    });
});

describe('runEmailReportBatch', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('대상 회원의 로컬 날짜를 선점하고, 원가 순 종목으로 메일을 보내고, sent로 기록한다', async () => {
        const { deps, sent } = makeDeps();

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.deliveries.claim).toHaveBeenCalledWith('u-1', '2026-10-05');
        expect(sent).toHaveLength(1);
        expect(sent[0]!.to).toBe('one@example.com');
        expect(sent[0]!.headers?.['List-Unsubscribe']).toContain(
            '/api/email-report/unsubscribe?u=u-1'
        );
        expect(sent[0]!.html.indexOf('MSFT')).toBeLessThan(
            sent[0]!.html.indexOf('AAPL')
        );
        expect(sent[0]!.html).toContain('d=2026-10-05');
        // 하단 "수신 설정 변경"은 메일 리포트 설정 페이지로 간다.
        expect(sent[0]!.text).toContain('https://siglens.io/email-report');
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'sent',
            ['MSFT', 'AAPL'],
            null
        );
        expect(deps.loadBrief).toHaveBeenCalledWith('MSFT');
        expect(deps.loadBrief).toHaveBeenCalledWith('AAPL');
        expect(sent[0]!.html).toContain('golden_cross');
        expect(counts).toMatchObject({ due: 1, sent: 1, failed: 0, pruned: 3 });
    });

    it('이미 선점된 회원은 보내지 않는다', async () => {
        const { deps, sent } = makeDeps();
        vi.mocked(deps.deliveries.claim).mockResolvedValue(null);

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(0);
        expect(deps.findHoldings).not.toHaveBeenCalled();
        expect(deps.findWatchlist).not.toHaveBeenCalled();
        expect(deps.findExcludedSymbols).not.toHaveBeenCalled();
        expect(counts.alreadyClaimed).toBe(1);
    });

    it('보유도 관심종목도 없고 시장 브리핑 종목도 없으면 보내지 않고 skipped로 기록한다', async () => {
        const { deps, sent } = makeDeps({
            findHoldings: vi.fn().mockResolvedValue([]),
            findWatchlist: vi.fn().mockResolvedValue([]),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(0);
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'skipped',
            [],
            null
        );
        expect(counts.skipped).toBe(1);
    });

    it('skipped 기록이 던지면 선점 실패가 아니라 발송 실패로 세고 실패 행을 남긴다', async () => {
        const { deps } = makeDeps({
            findHoldings: vi.fn().mockResolvedValue([]),
            findWatchlist: vi.fn().mockResolvedValue([]),
        });
        vi.mocked(deps.deliveries.finish)
            .mockRejectedValueOnce(new Error('write failed'))
            .mockResolvedValue(undefined);

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'failed',
            [],
            'write failed'
        );
        expect(counts).toMatchObject({ failed: 1, skipped: 0 });
        const claimFailedLogged = vi
            .mocked(console.error)
            .mock.calls.some(call =>
                String(call[0]).startsWith('[email-report] claim failed')
            );
        expect(claimFailedLogged).toBe(false);
    });

    it('보유도 관심종목도 없으면 그날 신호 종목으로 시장 브리핑을 보낸다(요약 표만, AI 리포트 없음)', async () => {
        const { deps, sent } = makeDeps({
            findHoldings: vi.fn().mockResolvedValue([]),
            findWatchlist: vi.fn().mockResolvedValue([]),
            loadMarketPicks: vi.fn().mockResolvedValue(['NVDA', '005930.KS']),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(1);
        expect(sent[0]!.subject).toBe('marketSubject');
        expect(sent[0]!.html).toContain('marketHeading');
        expect(sent[0]!.html).toContain('NVDA');
        expect(sent[0]!.html).toContain('https://siglens.io/market?');
        // 메일 링크는 유입 출처 분류(`email`)가 읽는 UTM을 단다.
        expect(sent[0]!.html).toContain('utm_source=email');
        expect(sent[0]!.html).toContain('utm_medium=email');
        expect(deps.loadReport).not.toHaveBeenCalled();
        expect(deps.loadBrief).toHaveBeenCalledWith('005930.KS');
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'sent',
            ['NVDA', '005930.KS'],
            null
        );
        expect(counts).toMatchObject({
            sent: 1,
            marketBriefings: 1,
            skipped: 0,
        });
    });

    it('시장 브리핑 종목은 회원이 여럿이어도 배치에 한 번만 조회한다', async () => {
        const { deps, sent } = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi
                    .fn()
                    .mockResolvedValue([
                        recipient({ userId: 'a', email: 'a@x.com' }),
                        recipient({ userId: 'b', email: 'b@x.com' }),
                    ]),
            },
            findHoldings: vi.fn().mockResolvedValue([]),
            findWatchlist: vi.fn().mockResolvedValue([]),
            loadMarketPicks: vi.fn().mockResolvedValue(['NVDA']),
        });

        await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(2);
        expect(deps.loadMarketPicks).toHaveBeenCalledTimes(1);
    });

    it('시장 브리핑 종목 조회가 던지면 그 회원은 skipped로 둔다', async () => {
        const { deps, sent } = makeDeps({
            findHoldings: vi.fn().mockResolvedValue([]),
            findWatchlist: vi.fn().mockResolvedValue([]),
            loadMarketPicks: vi
                .fn()
                .mockRejectedValue(new Error('scanner down')),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(0);
        expect(counts).toMatchObject({ skipped: 1, failed: 0 });
    });

    it('회원이 리포트에서 뺀 종목은 메일과 발송 기록에서 빠진다', async () => {
        const { deps, sent } = makeDeps({
            findExcludedSymbols: vi.fn().mockResolvedValue(['MSFT']),
        });

        await runEmailReportBatch(deps, NOW);

        expect(deps.findExcludedSymbols).toHaveBeenCalledWith('u-1');
        expect(sent[0]!.html).toContain('AAPL');
        expect(sent[0]!.html).not.toContain('MSFT');
        expect(deps.loadReport).not.toHaveBeenCalledWith('MSFT', 'ko');
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'sent',
            ['AAPL'],
            null
        );
    });

    it('담긴 종목을 전부 빼면 시장 브리핑도 보내지 않고 skipped로 기록한다', async () => {
        const { deps, sent } = makeDeps({
            findExcludedSymbols: vi.fn().mockResolvedValue(['AAPL', 'MSFT']),
            loadMarketPicks: vi.fn().mockResolvedValue(['NVDA']),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(0);
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'skipped',
            [],
            null
        );
        expect(counts.skipped).toBe(1);
    });

    describe('차트 작도', () => {
        const ANALYSIS_AT = new Date('2026-10-03T21:00:00.123Z');
        const drawingsFor = (symbols: string[]) =>
            Promise.resolve(
                new Map<string, SymbolDrawings>(
                    symbols.includes('AAPL')
                        ? [
                              [
                                  'AAPL',
                                  {
                                      analysisAt: ANALYSIS_AT,
                                      legend: [
                                          {
                                              kind: 'trendUp',
                                              color: '#26a69a',
                                          },
                                      ],
                                  },
                              ],
                          ]
                        : []
                )
            );

        it('작도가 있는 종목의 이미지 URL에만 분석 시각(a)을 싣고, 범례와 근거를 카드에 낸다', async () => {
            const { deps, sent } = makeDeps({
                loadDrawings: vi.fn(drawingsFor),
            });

            const counts = await runEmailReportBatch(deps, NOW);

            const urls = [
                ...defined(sent[0]).html.matchAll(
                    /src="(https:\/\/siglens\.io\/api\/email-report\/chart\?[^"]+)"/g
                ),
            ].map(m => new URL(defined(m[1]).replaceAll('&amp;', '&')));
            const bySymbol = new Map(
                urls.map(u => [u.searchParams.get('s'), u])
            );
            expect(bySymbol.get('AAPL')?.searchParams.get('a')).toBe(
                String(ANALYSIS_AT.getTime())
            );
            expect(bySymbol.get('MSFT')?.searchParams.has('a')).toBe(false);
            expect(defined(sent[0]).html).toContain('legendTrendUp');
            expect(defined(sent[0]).html).toContain('chartAltDrawings');
            expect(counts).toMatchObject({ drawingsCards: 1, drawingsNone: 1 });
        });

        it('같은 종목은 회원·로케일이 달라도 한 번만 읽고, 처음 보는 종목만 묶어 조회한다', async () => {
            const { deps } = makeDeps({
                subscriptions: {
                    findEnabledRecipients: vi.fn().mockResolvedValue([
                        recipient({ userId: 'a', email: 'a@x.com' }),
                        recipient({
                            userId: 'b',
                            email: 'b@x.com',
                            locale: 'en',
                        }),
                    ]),
                },
                loadDrawings: vi.fn(drawingsFor),
            });

            await runEmailReportBatch(deps, NOW);

            const calls = vi.mocked(deps.loadDrawings).mock.calls;
            const symbols = calls.flatMap(([list]) => list).sort();
            expect(symbols).toEqual(['AAPL', 'MSFT']);
        });

        it('수신자 기준일이 다르면(타임존) 같은 종목도 날짜별로 따로 계산한다', async () => {
            const { deps } = makeDeps({
                subscriptions: {
                    findEnabledRecipients: vi.fn().mockResolvedValue([
                        recipient({ userId: 'seoul', email: 's@x.com' }),
                        recipient({
                            userId: 'ny',
                            email: 'n@x.com',
                            timezone: 'America/New_York',
                            daysOfWeek: weekdaysToMask([0]),
                            sendHour: 19,
                        }),
                    ]),
                },
                loadDrawings: vi.fn(drawingsFor),
            });

            await runEmailReportBatch(deps, NOW);

            const calls = vi
                .mocked(deps.loadDrawings)
                .mock.calls.map(
                    ([symbols, date]) => `${date}:${symbols.sort().join()}`
                )
                .sort();
            expect(calls).toEqual([
                '2026-10-04:AAPL,MSFT',
                '2026-10-05:AAPL,MSFT',
            ]);
        });

        it('작도 조회가 던져도 메일은 작도 없는 이미지로 나간다', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { deps, sent } = makeDeps({
                loadDrawings: vi.fn().mockRejectedValue(new Error('db down')),
            });

            const counts = await runEmailReportBatch(deps, NOW);

            expect(sent).toHaveLength(1);
            expect(defined(sent[0]).html).not.toContain('&amp;a=');
            expect(defined(sent[0]).html).toContain('alt="chartAlt"');
            expect(defined(sent[0]).html).not.toContain('chartAltDrawings');
            expect(counts).toMatchObject({ sent: 1, failed: 0 });
        });

        it('시장 브리핑(전체 카드 없음)은 작도를 조회하지 않는다', async () => {
            const { deps } = makeDeps({
                findHoldings: vi.fn().mockResolvedValue([]),
                findWatchlist: vi.fn().mockResolvedValue([]),
                loadMarketPicks: vi.fn().mockResolvedValue(['NVDA']),
            });

            await runEmailReportBatch(deps, NOW);

            expect(deps.loadDrawings).not.toHaveBeenCalled();
        });
    });

    it('같은 (종목, 로케일)은 회원이 여럿이어도 한 번만 모은다', async () => {
        const { deps } = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi.fn().mockResolvedValue([
                    recipient({ userId: 'a', email: 'a@x.com' }),
                    recipient({ userId: 'b', email: 'b@x.com' }),
                    recipient({
                        userId: 'c',
                        email: 'c@x.com',
                        locale: 'en',
                    }),
                ]),
            },
        });

        await runEmailReportBatch(deps, NOW);

        const calls = vi.mocked(deps.loadReport).mock.calls;
        expect(calls).toHaveLength(4);
        expect(calls).toEqual(
            expect.arrayContaining([
                ['MSFT', 'ko'],
                ['AAPL', 'ko'],
                ['MSFT', 'en'],
                ['AAPL', 'en'],
            ])
        );
        expect(deps.getTranslator).toHaveBeenCalledTimes(2);
    });

    it('관심종목만 있는 회원에게도 보낸다', async () => {
        const { deps, sent } = makeDeps({
            findHoldings: vi.fn().mockResolvedValue([]),
            findWatchlist: vi.fn().mockResolvedValue([
                {
                    symbol: 'TSLA',
                    companyName: 'Tesla',
                    createdAt: new Date('2026-10-01T00:00:00Z'),
                },
            ]),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(1);
        expect(deps.loadReport).toHaveBeenCalledWith('TSLA', 'ko');
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'sent',
            ['TSLA'],
            null
        );
        expect(counts).toMatchObject({ sent: 1, skipped: 0 });
    });

    it('6번째부터는 요약 표로 싣고, 발송 기록에는 전체·요약 종목을 모두 남긴다', async () => {
        const watchlist = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].map(
            (symbol, i) => ({
                symbol,
                companyName: symbol,
                createdAt: new Date(`2026-10-0${i + 1}T00:00:00Z`),
            })
        );
        const { deps, sent } = makeDeps({
            findWatchlist: vi.fn().mockResolvedValue(watchlist),
        });

        await runEmailReportBatch(deps, NOW);

        // 보유 MSFT·AAPL + 최근 담은 순 W6·W5·W4 = 전체 5, 나머지 W3·W2·W1 = 요약
        const reportCalls = vi
            .mocked(deps.loadReport)
            .mock.calls.map(([s]) => s);
        expect(reportCalls).toHaveLength(5);
        expect(reportCalls).toEqual(
            expect.arrayContaining(['MSFT', 'AAPL', 'W6', 'W5', 'W4'])
        );
        expect(vi.mocked(deps.loadBrief).mock.calls.map(([s]) => s)).toEqual(
            expect.arrayContaining([
                'MSFT',
                'AAPL',
                'W6',
                'W5',
                'W4',
                'W3',
                'W2',
                'W1',
            ])
        );
        expect(sent[0]!.html).toContain('sectionBrief');
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'sent',
            ['MSFT', 'AAPL', 'W6', 'W5', 'W4', 'W3', 'W2', 'W1'],
            null
        );
    });

    it('요약 데이터는 로케일과 무관하게 종목마다 한 번만 모은다', async () => {
        const { deps } = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi.fn().mockResolvedValue([
                    recipient({ userId: 'a', email: 'a@x.com' }),
                    recipient({
                        userId: 'b',
                        email: 'b@x.com',
                        locale: 'en',
                    }),
                ]),
            },
        });

        await runEmailReportBatch(deps, NOW);

        const briefCalls = vi.mocked(deps.loadBrief).mock.calls.map(([s]) => s);
        expect([...briefCalls].sort()).toEqual(['AAPL', 'MSFT']);
        expect(deps.getSignalLabel).toHaveBeenCalledTimes(2);
        expect(deps.getSignalLabel).toHaveBeenCalledWith('ko');
        expect(deps.getSignalLabel).toHaveBeenCalledWith('en');
    });

    it('한 회원의 요약 조회는 BRIEF_CONCURRENCY를 넘겨 동시에 뜨지 않는다', async () => {
        const watchlist = Array.from({ length: 18 }, (_, i) => ({
            symbol: `W${i}`,
            companyName: `W${i}`,
            createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)),
        }));
        let inFlight = 0;
        let maxInFlight = 0;
        const { deps } = makeDeps({
            findWatchlist: vi.fn().mockResolvedValue(watchlist),
            loadBrief: vi.fn(async (symbol: string) => {
                inFlight += 1;
                maxInFlight = Math.max(maxInFlight, inFlight);
                await new Promise(resolve => setTimeout(resolve, 1));
                inFlight -= 1;
                return brief(symbol);
            }),
        });

        await runEmailReportBatch(deps, NOW);

        // 보유 2 + 관심 18 = 전체 5 + 요약 15
        expect(deps.loadBrief).toHaveBeenCalledTimes(20);
        expect(maxInFlight).toBeGreaterThan(1);
        expect(maxInFlight).toBeLessThanOrEqual(BRIEF_CONCURRENCY);
    });

    it('관심종목 조회가 실패하면 그 회원은 failed로 기록한다', async () => {
        const { deps } = makeDeps({
            findWatchlist: vi
                .fn()
                .mockRejectedValue(new Error('watchlist down')),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(counts.failed).toBe(1);
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'failed',
            [],
            'watchlist down'
        );
    });

    it('제외 종목 조회가 실패하면 아무것도 보내지 않고 그 오류로 failed 기록한다', async () => {
        const { deps, sent } = makeDeps({
            findExcludedSymbols: vi
                .fn()
                .mockRejectedValue(new Error('exclusion down')),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(counts.failed).toBe(1);
        expect(sent).toHaveLength(0);
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'failed',
            [],
            'exclusion down'
        );
    });

    it('발송이 거부되면 failed로 기록하고 다른 회원은 계속 보낸다', async () => {
        const { deps } = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi
                    .fn()
                    .mockResolvedValue([
                        recipient({ userId: 'a', email: 'a@x.com' }),
                        recipient({ userId: 'b', email: 'b@x.com' }),
                    ]),
            },
        });
        vi.mocked(deps.dispatcher.sendEmail)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        const counts = await runEmailReportBatch(deps, NOW);

        expect(counts).toMatchObject({ sent: 1, failed: 1 });
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            expect.any(String),
            'failed',
            ['MSFT', 'AAPL'],
            'dispatcher rejected'
        );
    });

    it('조립 중 예외는 오류 문구와 함께 failed로 기록한다', async () => {
        const { deps } = makeDeps({
            findHoldings: vi.fn().mockRejectedValue(new Error('db down')),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(counts.failed).toBe(1);
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'failed',
            [],
            'db down'
        );
    });

    it('선점 자체가 실패해도 배치는 끝까지 돈다', async () => {
        const { deps } = makeDeps();
        vi.mocked(deps.deliveries.claim).mockRejectedValue(new Error('db'));

        const counts = await runEmailReportBatch(deps, NOW);

        expect(counts.failed).toBe(1);
        expect(deps.deliveries.pruneOlderThan).toHaveBeenCalled();
    });

    it('마감이 지나면 남은 회원을 선점하지 않고 deferred로 센다', async () => {
        // 첫 읽기(시작 시각)만 0이고, 이후 읽기는 전부 마감을 넘긴 시각이다.
        const clock = vi
            .fn()
            .mockReturnValueOnce(0)
            .mockReturnValue(BATCH_DEADLINE_MS + 1);
        const { deps } = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi
                    .fn()
                    .mockResolvedValue([
                        recipient({ userId: 'a' }),
                        recipient({ userId: 'b' }),
                    ]),
            },
            clock,
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.deliveries.claim).not.toHaveBeenCalled();
        expect(counts.deferred).toBe(2);
    });

    it('마감 전에는 계속 처리한다', async () => {
        const { deps } = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi
                    .fn()
                    .mockResolvedValue([
                        recipient({ userId: 'a' }),
                        recipient({ userId: 'b' }),
                    ]),
            },
            clock: () => BATCH_DEADLINE_MS,
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.deliveries.claim).toHaveBeenCalledTimes(2);
        expect(counts.deferred).toBe(0);
    });

    it('보관 기간보다 오래된 발송 기록을 지운다', async () => {
        const { deps } = makeDeps();

        await runEmailReportBatch(deps, NOW);

        expect(deps.deliveries.pruneOlderThan).toHaveBeenCalledWith(
            new Date(NOW.getTime() - DELIVERY_RETENTION_MS)
        );
    });

    it('대상이 없으면 아무것도 선점하지 않는다', async () => {
        const { deps } = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi
                    .fn()
                    .mockResolvedValue([recipient({ sendHour: 3 })]),
            },
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(counts.due).toBe(0);
        expect(deps.deliveries.claim).not.toHaveBeenCalled();
    });

    it('DB 에러는 전달 기록 컬럼에 파라미터 없이 이름과 코드만 저장한다', async () => {
        const { deps } = makeDeps({
            findHoldings: vi.fn().mockRejectedValue(plantedDbError()),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(counts.failed).toBe(1);
        expect(deps.deliveries.finish).toHaveBeenCalledWith(
            'claim-1',
            'failed',
            [],
            'Error code=57014'
        );
        const stored = vi
            .mocked(deps.deliveries.finish)
            .mock.calls.map(call => String(call[3]))
            .join('\n');
        expect(stored).not.toContain(PLANTED_TOKEN);
        expect(stored).not.toContain(PLANTED_EMAIL);
        expect(stored).not.toContain('Failed query');
    });
});

describe('runEmailReportBatch: 가입 첫 리포트', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    /** 정기 대상 없이 첫 리포트 대상만 있는 배치. */
    function makeWelcomeDeps(
        welcomes: EmailReportWelcomeRecipient[],
        overrides: Partial<EmailReportBatchDeps> = {}
    ) {
        const made = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi.fn().mockResolvedValue([]),
            },
            ...overrides,
        });
        vi.mocked(made.deps.welcomes.claimDue).mockResolvedValue(welcomes);
        return made;
    }

    it('선점한 회원에게 환영 제목의 실제 리포트를 멱등 키와 함께 보내고 sent로 기록한다', async () => {
        const { deps, sent } = makeWelcomeDeps([welcomeRecipient()]);

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.welcomes.claimDue).toHaveBeenCalledWith(NOW);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.to).toBe('welcome@example.com');
        expect(sent[0]?.subject).toBe('welcomeSubject');
        expect(sent[0]?.idempotencyKey).toBe('email-report-welcome/w-1');
        expect(sent[0]?.headers?.['List-Unsubscribe']).toContain(
            '/api/email-report/unsubscribe?u=w-1'
        );
        // 실제 리포트: 보유 종목 카드가 실린다.
        expect(sent[0]?.html).toContain('MSFT');
        expect(deps.welcomes.finish).toHaveBeenCalledWith('w-1', 'sent', null);
        // 정기 발송 기록은 건드리지 않는다.
        expect(deps.deliveries.claim).not.toHaveBeenCalled();
        expect(counts).toMatchObject({
            welcomeSent: 1,
            welcomeFailed: 0,
            welcomeFallback: 0,
        });
    });

    it('첫 리포트 카드에도 회원 로컬 날짜의 작도를 싣고 작도 카운터에 센다', async () => {
        const analysisAt = new Date('2026-10-03T21:00:00.000Z');
        const loadDrawings = vi.fn(async (symbols: string[]) =>
            symbols.includes('AAPL')
                ? new Map<string, SymbolDrawings>([
                      [
                          'AAPL',
                          {
                              analysisAt,
                              legend: [{ kind: 'trendUp', color: '#26a69a' }],
                          },
                      ],
                  ])
                : new Map<string, SymbolDrawings>()
        );
        // 뉴욕 회원은 NOW가 아직 2026-10-04다 — 작도와 차트는 그 날짜로 읽는다.
        const { deps, sent } = makeWelcomeDeps(
            [welcomeRecipient({ timezone: 'America/New_York' })],
            { loadDrawings }
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(loadDrawings).toHaveBeenCalledTimes(1);
        expect(loadDrawings).toHaveBeenCalledWith(
            expect.arrayContaining(['AAPL', 'MSFT']),
            '2026-10-04'
        );
        const html = defined(sent[0]).html;
        expect(html).toContain('legendTrendUp');
        expect(html).toContain(`a=${analysisAt.getTime()}`);
        expect(html).toContain('d=2026-10-04');
        expect(counts).toMatchObject({
            welcomeSent: 1,
            drawingsCards: 1,
            drawingsNone: 1,
        });
    });

    it('발송이 거부되면 failed로 기록하고 실패로 센다', async () => {
        const { deps } = makeWelcomeDeps([welcomeRecipient()]);
        vi.mocked(deps.dispatcher.sendKeyedEmail).mockResolvedValue('rejected');

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.welcomes.finish).toHaveBeenCalledWith(
            'w-1',
            'failed',
            'dispatcher rejected'
        );
        expect(counts).toMatchObject({ welcomeSent: 0, welcomeFailed: 1 });
    });

    it('같은 멱등 키의 첫 요청이 이미 수락됐다는 응답은 실패가 아니라 sent로 기록한다', async () => {
        const { deps } = makeWelcomeDeps([welcomeRecipient()]);
        vi.mocked(deps.dispatcher.sendKeyedEmail).mockResolvedValue(
            'already_accepted'
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.welcomes.finish).toHaveBeenCalledWith('w-1', 'sent', null);
        expect(counts).toMatchObject({ welcomeSent: 1, welcomeFailed: 0 });
    });

    it('같은 키의 요청이 처리 중이면 시도를 쓰지 않는 retry로 돌려놓고 실패로 세지 않는다', async () => {
        const { deps } = makeWelcomeDeps([welcomeRecipient()]);
        vi.mocked(deps.dispatcher.sendKeyedEmail).mockResolvedValue(
            'in_flight'
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.welcomes.finish).toHaveBeenCalledWith(
            'w-1',
            'retry',
            'request in flight'
        );
        expect(counts).toMatchObject({
            welcomeSent: 0,
            welcomeFailed: 0,
            welcomeRetryLater: 1,
        });
    });

    it('조립 중 예외는 가려진 오류 문구로 failed 기록하고 다른 회원은 계속 보낸다', async () => {
        const { deps, sent } = makeWelcomeDeps(
            [
                welcomeRecipient({ userId: 'w-bad', email: 'bad@example.com' }),
                welcomeRecipient({ userId: 'w-ok', email: 'ok@example.com' }),
            ],
            {
                findHoldings: vi.fn(async (userId: string) => {
                    if (userId === 'w-bad') throw plantedDbError();
                    return [
                        { symbol: 'AAPL', quantity: '1', averagePrice: '1' },
                    ];
                }),
            }
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.welcomes.finish).toHaveBeenCalledWith(
            'w-bad',
            'failed',
            'Error code=57014'
        );
        expect(deps.welcomes.finish).toHaveBeenCalledWith('w-ok', 'sent', null);
        expect(sent.map(m => m.to)).toEqual(['ok@example.com']);
        expect(counts).toMatchObject({ welcomeSent: 1, welcomeFailed: 1 });
        const stored = vi
            .mocked(deps.welcomes.finish)
            .mock.calls.map(call => String(call[2]))
            .join('\n');
        expect(stored).not.toContain(PLANTED_TOKEN);
        expect(stored).not.toContain(PLANTED_EMAIL);
    });

    it('실패 기록마저 던져도 배치는 끝까지 돈다', async () => {
        const { deps } = makeWelcomeDeps([welcomeRecipient()], {
            findHoldings: vi.fn().mockRejectedValue(new Error('db down')),
        });
        vi.mocked(deps.welcomes.finish).mockRejectedValue(new Error('db down'));

        const counts = await runEmailReportBatch(deps, NOW);

        expect(counts.welcomeFailed).toBe(1);
        expect(deps.deliveries.pruneOlderThan).toHaveBeenCalled();
    });

    it('메일이 나간 뒤 sent 기록이 던지면 실패가 아니라 보냄으로 세고 기록 실패를 따로 센다', async () => {
        const { deps, sent } = makeWelcomeDeps([welcomeRecipient()]);
        vi.mocked(deps.welcomes.finish).mockRejectedValue(
            new Error('write failed')
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(1);
        expect(deps.welcomes.finish).toHaveBeenCalledTimes(1);
        expect(deps.welcomes.finish).toHaveBeenCalledWith('w-1', 'sent', null);
        expect(counts).toMatchObject({
            welcomeSent: 1,
            welcomeFailed: 0,
            welcomeFinishFailed: 1,
        });
    });

    it('보유도 관심종목도 없고 시장 브리핑 종목도 없으면 안내와 샘플 링크만 담아 보낸다', async () => {
        const { deps, sent } = makeWelcomeDeps([welcomeRecipient()], {
            findHoldings: vi.fn().mockResolvedValue([]),
            findWatchlist: vi.fn().mockResolvedValue([]),
            loadMarketPicks: vi.fn().mockResolvedValue([]),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(1);
        expect(sent[0]?.html).toContain('welcomeNoData');
        expect(sent[0]?.html).toContain(
            'https://siglens.io/email-report/sample'
        );
        expect(sent[0]?.html).not.toContain('briefColSymbol');
        expect(sent[0]?.html).not.toContain('marketHint');
        expect(deps.loadReport).not.toHaveBeenCalled();
        expect(deps.welcomes.finish).toHaveBeenCalledWith('w-1', 'sent', null);
        expect(counts).toMatchObject({ welcomeSent: 1, welcomeFallback: 1 });
    });

    it('종목이 없어도 로케일에 맞는 샘플 링크를 쓴다', async () => {
        const { deps, sent } = makeWelcomeDeps(
            [welcomeRecipient({ locale: 'en' })],
            {
                findHoldings: vi.fn().mockResolvedValue([]),
                findWatchlist: vi.fn().mockResolvedValue([]),
            }
        );

        await runEmailReportBatch(deps, NOW);

        expect(sent[0]?.html).toContain(
            'https://siglens.io/en/email-report/sample'
        );
    });

    it('담은 종목이 없어도 시장 브리핑 종목이 있으면 그것으로 첫 리포트를 만든다', async () => {
        const { deps, sent } = makeWelcomeDeps([welcomeRecipient()], {
            findHoldings: vi.fn().mockResolvedValue([]),
            findWatchlist: vi.fn().mockResolvedValue([]),
            loadMarketPicks: vi.fn().mockResolvedValue(['NVDA']),
        });

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent[0]?.html).toContain('NVDA');
        expect(sent[0]?.html).not.toContain('welcomeNoData');
        expect(counts).toMatchObject({ welcomeSent: 1, welcomeFallback: 0 });
    });

    it('시간대가 깨진 회원은 서울 날짜로 만들어 보낸다', async () => {
        const { deps, sent } = makeWelcomeDeps([
            welcomeRecipient({ timezone: 'Mars/Base' }),
        ]);

        await runEmailReportBatch(deps, NOW);

        expect(sent[0]?.html).toContain('d=2026-10-05');
    });

    it('첫 리포트를 최근 12시간 안에 받은 회원은 정기 회차를 건너뛰고 다른 회원은 보낸다', async () => {
        const { deps, sent } = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi
                    .fn()
                    .mockResolvedValue([
                        recipient({ userId: 'u-1', email: 'one@example.com' }),
                        recipient({ userId: 'u-2', email: 'two@example.com' }),
                    ]),
            },
        });
        vi.mocked(deps.welcomes.findWelcomed).mockResolvedValue(
            new Set(['u-1'])
        );

        const counts = await runEmailReportBatch(deps, NOW);

        // 최근 12시간 안에 보낸 회원과, 30분 안에 갱신된 처리 중 행(겹친 실행)을 함께 건너뛴다.
        expect(deps.welcomes.findWelcomed).toHaveBeenCalledWith(
            new Date(NOW.getTime() - WELCOME_SUPPRESSES_REPORT_MS),
            new Date(NOW.getTime() - WELCOME_STALE_SENDING_MS)
        );
        expect(deps.deliveries.claim).toHaveBeenCalledTimes(1);
        expect(deps.deliveries.claim).toHaveBeenCalledWith('u-2', '2026-10-05');
        expect(sent.map(m => m.to)).toEqual(['two@example.com']);
        expect(counts).toMatchObject({
            due: 2,
            sent: 1,
            suppressedByWelcome: 1,
            alreadyClaimed: 0,
        });
    });

    it('첫 리포트를 방금 보낸 같은 실행에서 그 회원의 정기 회차를 건너뛴다', async () => {
        const { deps, sent } = makeDeps({
            subscriptions: {
                findEnabledRecipients: vi
                    .fn()
                    .mockResolvedValue([recipient({ userId: 'w-1' })]),
            },
        });
        vi.mocked(deps.welcomes.claimDue).mockResolvedValue([
            welcomeRecipient(),
        ]);
        const sentUsers = new Set<string>();
        vi.mocked(deps.welcomes.finish).mockImplementation(async userId => {
            sentUsers.add(userId);
        });
        // 호출 시점의 스냅샷을 돌려준다 — 첫 리포트 처리보다 먼저 조회하면 비어 있어 이 테스트가 깨진다.
        vi.mocked(deps.welcomes.findWelcomed).mockImplementation(
            async () => new Set(sentUsers)
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(1);
        expect(sent[0]?.subject).toBe('welcomeSubject');
        expect(deps.deliveries.claim).not.toHaveBeenCalled();
        expect(counts).toMatchObject({
            welcomeSent: 1,
            suppressedByWelcome: 1,
            sent: 0,
        });
    });

    it('첫 리포트 선점이 실패해도 정기 회차는 그대로 돈다', async () => {
        const { deps, sent } = makeDeps();
        vi.mocked(deps.welcomes.claimDue).mockRejectedValue(
            new Error('claim down')
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(1);
        expect(sent[0]?.subject).not.toBe('welcomeSubject');
        expect(counts).toMatchObject({ sent: 1, welcomeSent: 0 });
    });

    it('최근 첫 리포트 조회가 실패하면 건너뛰기 없이 정기 회차를 보낸다', async () => {
        const { deps, sent } = makeDeps();
        vi.mocked(deps.welcomes.findWelcomed).mockRejectedValue(
            new Error('lookup down')
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(1);
        expect(counts).toMatchObject({ sent: 1, suppressedByWelcome: 0 });
    });

    it('마감이 지나면 첫 리포트도 더 처리하지 않고 deferred로 센다', async () => {
        const clock = vi
            .fn()
            .mockReturnValueOnce(0)
            .mockReturnValue(BATCH_DEADLINE_MS + 1);
        const { deps, sent } = makeWelcomeDeps(
            [
                welcomeRecipient({ userId: 'a' }),
                welcomeRecipient({ userId: 'b' }),
            ],
            { clock }
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(0);
        // 손대지 못한 행은 `sending`에 묶어 두지 않고 시도를 쓰지 않은 채 돌려놓는다.
        expect(deps.welcomes.finish).toHaveBeenCalledTimes(2);
        expect(deps.welcomes.finish).toHaveBeenCalledWith(
            'a',
            'retry',
            'deadline deferred'
        );
        expect(deps.welcomes.finish).toHaveBeenCalledWith(
            'b',
            'retry',
            'deadline deferred'
        );
        expect(counts.deferred).toBe(2);
    });

    it('마감이 중간에 지나면 처리한 행은 sent만, 남은 행만 retry로 돌려놓는다', async () => {
        const clock = vi
            .fn()
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0)
            .mockReturnValue(BATCH_DEADLINE_MS + 1);
        const { deps, sent } = makeWelcomeDeps([
            welcomeRecipient({ userId: 'a' }),
            welcomeRecipient({ userId: 'b' }),
            welcomeRecipient({ userId: 'c' }),
        ]);
        const counts = await runEmailReportBatch({ ...deps, clock }, NOW);

        expect(sent.map(email => email.idempotencyKey)).toEqual([
            'email-report-welcome/a',
        ]);
        const calls = vi
            .mocked(deps.welcomes.finish)
            .mock.calls.map(([userId, outcome]) => `${userId}:${outcome}`);
        expect(calls).toHaveLength(3);
        expect(calls).toEqual(
            expect.arrayContaining(['a:sent', 'b:retry', 'c:retry'])
        );
        expect(counts).toMatchObject({ welcomeSent: 1, deferred: 2 });
    });

    it('돌려놓는 기록이 던져도 로그만 남기고 배치는 끝까지 돈다', async () => {
        const clock = vi
            .fn()
            .mockReturnValueOnce(0)
            .mockReturnValue(BATCH_DEADLINE_MS + 1);
        const { deps } = makeWelcomeDeps(
            [
                welcomeRecipient({ userId: 'a' }),
                welcomeRecipient({ userId: 'b' }),
            ],
            { clock }
        );
        vi.mocked(deps.welcomes.finish).mockRejectedValue(new Error('db down'));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const logged: unknown[][] = [];
        const counts = await runEmailReportBatch(deps, NOW).finally(() => {
            logged.push(...errorSpy.mock.calls);
            errorSpy.mockRestore();
        });

        expect(counts.deferred).toBe(2);
        expect(
            logged.filter(args =>
                String(args[0]).includes('could not release deferred welcome')
            )
        ).toHaveLength(2);
        expect(deps.deliveries.pruneOlderThan).toHaveBeenCalled();
    });

    it('첫 리포트 기록도 보관 기간이 지나면 지운다', async () => {
        const { deps } = makeDeps();
        vi.mocked(deps.welcomes.pruneOlderThan).mockResolvedValue(2);

        const counts = await runEmailReportBatch(deps, NOW);

        expect(deps.welcomes.pruneOlderThan).toHaveBeenCalledWith(
            new Date(NOW.getTime() - DELIVERY_RETENTION_MS)
        );
        expect(counts.welcomePruned).toBe(2);
    });

    it('첫 리포트 기록 정리가 실패해도 배치는 끝난다', async () => {
        const { deps } = makeDeps();
        vi.mocked(deps.welcomes.pruneOlderThan).mockRejectedValue(
            new Error('prune down')
        );

        const counts = await runEmailReportBatch(deps, NOW);

        expect(counts.welcomePruned).toBe(0);
        expect(counts.pruned).toBe(3);
    });
});
