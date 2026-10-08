import {
    BATCH_DEADLINE_MS,
    DELIVERY_RETENTION_MS,
    runEmailReportBatch,
    selectDueRecipients,
    type EmailReportBatchDeps,
} from '@/app/api/cron/email-report/runEmailReportBatch';
import { weekdaysToMask } from '@/entities/email-report/lib/weekdayMask';
import type { SymbolReport } from '@/entities/email-report/reportModel';
import type { EmailReportRecipient } from '@/shared/db/types';
import type { EmailMessage } from '@/shared/email/types';

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

function makeDeps(overrides: Partial<EmailReportBatchDeps> = {}) {
    let claimSeq = 0;
    const sent: EmailMessage[] = [];
    const deps: EmailReportBatchDeps = {
        subscriptions: {
            findEnabledRecipients: vi.fn().mockResolvedValue([recipient()]),
        },
        deliveries: {
            claim: vi.fn(async () => `claim-${++claimSeq}`),
            finish: vi.fn().mockResolvedValue(undefined),
            pruneOlderThan: vi.fn().mockResolvedValue(3),
        },
        findHoldings: vi.fn().mockResolvedValue([
            { symbol: 'AAPL', quantity: '1', averagePrice: '100' },
            { symbol: 'MSFT', quantity: '1', averagePrice: '300' },
        ]),
        loadReport: vi.fn(async (symbol: string) => report(symbol)),
        getTranslator: vi.fn().mockResolvedValue((key: string) => key),
        dispatcher: {
            sendEmail: vi.fn(async (message: EmailMessage) => {
                sent.push(message);
                return true;
            }),
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
        expect(counts).toMatchObject({ due: 1, sent: 1, failed: 0, pruned: 3 });
    });

    it('이미 선점된 회원은 보내지 않는다', async () => {
        const { deps, sent } = makeDeps();
        vi.mocked(deps.deliveries.claim).mockResolvedValue(null);

        const counts = await runEmailReportBatch(deps, NOW);

        expect(sent).toHaveLength(0);
        expect(deps.findHoldings).not.toHaveBeenCalled();
        expect(counts.alreadyClaimed).toBe(1);
    });

    it('보유 종목이 없으면 보내지 않고 skipped로 기록한다', async () => {
        const { deps, sent } = makeDeps({
            findHoldings: vi.fn().mockResolvedValue([]),
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
});
