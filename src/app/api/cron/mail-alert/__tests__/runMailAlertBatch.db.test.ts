import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Bar } from '@y0ngha/siglens-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../../../db/scripts/lib/dbTarget';
import {
    DrizzleMailAlertDeliveryRepository,
    DrizzleMailAlertSubscriberRepository,
    DrizzlePriceAlertRepository,
} from '@/entities/mail-alert/api';
import * as schema from '@/shared/db/schema';
import type { CreatePriceAlertInput } from '@/shared/db/types';
import type { EmailMessage } from '@/shared/email/types';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import {
    runMailAlertBatch,
    type MailAlertBatchCounts,
    type MailAlertBatchDeps,
    type MailAlertBatchResult,
} from '../runMailAlertBatch';

vi.mock('server-only', () => ({}));

/**
 * 알림 메일 발송기를 진짜 Postgres의 저장소와 함께 돌려, 하루 한 통 선점(유니크 인덱스)이 슬롯과 실행의 겹침
 * 앞에서 실제로 지켜지는지 본다: 07시와 08시 슬롯, 같은 시각에 겹친 두 실행, 선점만 하고 죽어 `pending`으로 남은
 * 행, 반복 방지 창, 발송 기록 정리. 소스(신호 기록·공포탐욕·일봉)와 발송기는 가짜다 — 외부로 나가는 것이 없다.
 * `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --name <unique> -e POSTGRES_PASSWORD=x -e POSTGRES_USER=siglens -e POSTGRES_DB=siglens_test \
 *     -p 127.0.0.1:55433:5432 --pull never postgres:17-alpine
 *   TEST_DATABASE_URL=postgres://siglens:x@127.0.0.1:55433/siglens_test yarn test runMailAlertBatch.db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션을 적용한 뒤 끝나면 스키마를 지운다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `mail_alert_batch_test_${process.pid}`;
const SECRET = 'db-secret-db-secret-db-secret-db-secret';

/** 2026-11-25(수) 07:05 KST와 08:05 KST. */
const FIRST = new Date('2026-11-24T22:05:00Z');
const FINAL = new Date('2026-11-24T23:05:00Z');
const NEXT_DAY_FIRST = new Date('2026-11-25T22:05:00Z');
const ALERT_DATE = '2026-11-25';

const tKo = catalogTranslator('entities.mail-alert.email', 'ko');
const labelKo = catalogTranslator('shared.enumLabel', 'ko');

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.replaceAll('"public".', ''));

function countsOf(result: MailAlertBatchResult): MailAlertBatchCounts {
    if (result.status !== 'done') {
        throw new Error(`expected a finished run, got ${result.status}`);
    }
    return result.counts;
}

describe.skipIf(!URL)(
    '알림 메일 발송기가 진짜 Postgres에서 하루 한 통 규칙을 지킨다',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: 8,
            connection: { search_path: SCHEMA },
        });
        const db = drizzle(client, { schema });
        const subscribers = new DrizzleMailAlertSubscriberRepository(db);
        const deliveries = new DrizzleMailAlertDeliveryRepository(db);
        const priceAlerts = new DrizzlePriceAlertRepository(db);
        const counter = { value: 0 };

        function nextEmail(): string {
            counter.value += 1;
            return `batch${counter.value}@example.com`;
        }

        /** 골든크로스 신호 주제 하나를 가진 게스트 구독자. */
        async function subscribeToGoldenCross(): Promise<{
            id: string;
            email: string;
        }> {
            const email = nextEmail();
            const { id } = await subscribers.upsertVerified({
                email,
                locale: 'ko',
                consentSource: 'signal_hub',
            });
            await subscribers.addTopic(
                { kind: 'guest', subscriberId: id },
                { kind: 'signal', key: 'golden_cross' },
                30
            );
            return { id, email };
        }

        /** 시나리오마다 새 발송기 기록과 의존성을 만든다. 신호 소스는 미국 골든크로스 한 건을 항상 돌려준다. */
        function makeDeps(
            sent: EmailMessage[],
            options: {
                claimOnly?: boolean;
                episodeCount?: number;
                bars?: readonly Bar[];
                /** 발송기가 거절(`rejected`)하거나 던진다. 기본은 받아 준다. */
                dispatch?: 'reject' | 'throw';
            } = {}
        ): MailAlertBatchDeps {
            return {
                launched: true,
                secret: SECRET,
                siteUrl: 'https://siglens.io',
                subscribers,
                priceAlerts,
                // `claimOnly`: 반복 방지 창을 비워 두 번째 시도를 막는 것이 선점 행뿐이게 한다. 창이 켜져 있으면
                // 이미 보낸 항목이 먼저 걸러져 선점 규칙이 가려진다.
                deliveries: options.claimOnly
                    ? {
                          claim: (subscriberId, alertDate, itemKeys, fired) =>
                              deliveries.claim(
                                  subscriberId,
                                  alertDate,
                                  itemKeys,
                                  fired
                              ),
                          finish: (id, outcome, itemKeys, error, mailNotSent) =>
                              deliveries.finish(
                                  id,
                                  outcome,
                                  itemKeys,
                                  error,
                                  mailNotSent
                              ),
                          recentItemKeys: async () => new Map(),
                          pruneBefore: alertDate =>
                              deliveries.pruneBefore(alertDate),
                      }
                    : deliveries,
                sources: {
                    signalHistory: {
                        latestRecordedSession: vi
                            .fn()
                            .mockResolvedValue('2099-01-01'),
                        findEpisodesStartedOn: vi.fn(async market =>
                            market === 'us'
                                ? Array.from(
                                      { length: options.episodeCount ?? 1 },
                                      (_, i) => ({
                                          symbol:
                                              i === 0
                                                  ? 'AAPL'
                                                  : `H${String(i).padStart(2, '0')}`,
                                          signalType: 'golden_cross',
                                          changePercent: 2,
                                          koreanName: null,
                                      })
                                  )
                                : []
                        ),
                    },
                    loadFearGreedHistory: vi.fn().mockResolvedValue([]),
                    loadDailyBars: vi
                        .fn()
                        .mockResolvedValue(options.bars ?? []),
                },
                getSymbolNames: async () => null,
                findHoldings: vi.fn().mockResolvedValue([]),
                findWatchlist: vi.fn().mockResolvedValue([]),
                resolveMarket: vi.fn().mockResolvedValue('us'),
                getTranslator: async () => tKo,
                getSignalLabel: async () => type =>
                    labelKo.has(`signalType.${type}`)
                        ? labelKo(`signalType.${type}`)
                        : null,
                getDisclaimer: async () => '투자 참고용이에요.',
                // 알림 패스는 멱등 키 발송(`sendKeyedEmail`)만 부른다.
                dispatcher: {
                    sendEmail: async () => {
                        throw new Error('the alert pass sends keyed only');
                    },
                    sendKeyedEmail: async message => {
                        if (options.dispatch === 'throw') {
                            throw new Error('provider down');
                        }
                        if (options.dispatch === 'reject') return 'rejected';
                        sent.push(message);
                        return 'accepted';
                    },
                },
            };
        }

        const sentTo = (sent: readonly EmailMessage[], email: string) =>
            sent.filter(message => message.to === email);

        async function deliveryRows(
            subscriberId: string
        ): Promise<
            { alertDate: string; status: string; itemKeys: string[] }[]
        > {
            const rows = await client<
                { alert_date: string; status: string; item_keys: string[] }[]
            >`SELECT alert_date::text AS alert_date, status, item_keys
              FROM mail_alert_deliveries WHERE subscriber_id = ${subscriberId}
              ORDER BY alert_date`;
            return rows.map(row => ({
                alertDate: row.alert_date,
                status: row.status,
                itemKeys: row.item_keys,
            }));
        }

        beforeAll(async () => {
            const target = describeTarget(URL as string);
            if (!target.isLocal || target.viaTunnel) {
                throw new Error(
                    `refusing to run against a non-local database: ${target.host}`
                );
            }
            await admin.unsafe(`CREATE SCHEMA "${SCHEMA}"`);
            await client.unsafe(
                `CREATE TYPE "content_locale" AS ENUM ('ko','en','ja','zh')`
            );
            await client.unsafe(
                'CREATE TABLE "users" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "email" varchar(320) NOT NULL UNIQUE, "email_verified" boolean DEFAULT false NOT NULL)'
            );
            for (const file of [
                '0063_mail_alerts.sql',
                '0065_price_alerts.sql',
            ]) {
                await migration(file).reduce(
                    (previous, statement) =>
                        previous.then(() =>
                            client.unsafe(statement).then(() => {})
                        ),
                    Promise.resolve()
                );
            }
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        it('07시에 보낸 구독자는 08시 최종 슬롯에서 다시 받지 않고 기록은 한 행이다', async () => {
            const sent: EmailMessage[] = [];
            const subscriber = await subscribeToGoldenCross();

            const first = countsOf(
                await runMailAlertBatch(
                    makeDeps(sent, { claimOnly: true }),
                    FIRST
                )
            );
            const final = countsOf(
                await runMailAlertBatch(
                    makeDeps(sent, { claimOnly: true }),
                    FINAL
                )
            );

            expect(first.sent).toBeGreaterThanOrEqual(1);
            expect(final.slot).toBe('final');
            expect(sentTo(sent, subscriber.email)).toHaveLength(1);
            expect(await deliveryRows(subscriber.id)).toEqual([
                {
                    alertDate: ALERT_DATE,
                    status: 'sent',
                    itemKeys: ['s:us:AAPL:golden_cross'],
                },
            ]);
            expect(sentTo(sent, subscriber.email)[0]?.idempotencyKey).toBe(
                `mail-alert/${subscriber.id}/${ALERT_DATE}`
            );
        });

        it('같은 시각에 겹친 두 실행도 구독자마다 한 통만 나간다', async () => {
            const sent: EmailMessage[] = [];
            const subscriber = await subscribeToGoldenCross();

            await Promise.all([
                runMailAlertBatch(makeDeps(sent, { claimOnly: true }), FIRST),
                runMailAlertBatch(makeDeps(sent, { claimOnly: true }), FIRST),
            ]);

            expect(sentTo(sent, subscriber.email)).toHaveLength(1);
            expect(await deliveryRows(subscriber.id)).toHaveLength(1);
        });

        it('선점만 하고 죽어 pending으로 남은 행은 두 슬롯 모두 건너뛰어 그날 메일이 없고 다음 날은 정상이다', async () => {
            const sent: EmailMessage[] = [];
            const stuck = await subscribeToGoldenCross();
            await deliveries.claim(stuck.id, ALERT_DATE);

            const first = countsOf(
                await runMailAlertBatch(
                    makeDeps(sent, { claimOnly: true }),
                    FIRST
                )
            );
            const final = countsOf(
                await runMailAlertBatch(
                    makeDeps(sent, { claimOnly: true }),
                    FINAL
                )
            );
            const nextDay = countsOf(
                await runMailAlertBatch(
                    makeDeps(sent, { claimOnly: true }),
                    NEXT_DAY_FIRST
                )
            );

            expect(first.alreadyClaimed).toBeGreaterThanOrEqual(1);
            expect(final.alreadyClaimed).toBeGreaterThanOrEqual(1);
            expect(sentTo(sent, stuck.email)).toHaveLength(1);
            expect(await deliveryRows(stuck.id)).toEqual([
                { alertDate: ALERT_DATE, status: 'pending', itemKeys: [] },
                {
                    alertDate: '2026-11-26',
                    status: 'sent',
                    itemKeys: ['s:us:AAPL:golden_cross'],
                },
            ]);
            expect(nextDay.sent).toBeGreaterThanOrEqual(1);
        });

        it('최근에 보낸 항목은 다음 날 같은 항목이 다시 잡혀도 보내지 않는다', async () => {
            const sent: EmailMessage[] = [];
            const subscriber = await subscribeToGoldenCross();

            await runMailAlertBatch(makeDeps(sent), FIRST);
            const nextDay = countsOf(
                await runMailAlertBatch(makeDeps(sent), NEXT_DAY_FIRST)
            );

            expect(nextDay.suppressedItems).toBeGreaterThanOrEqual(1);
            expect(sentTo(sent, subscriber.email)).toHaveLength(1);
            expect(await deliveryRows(subscriber.id)).toHaveLength(1);
        });

        it('같은 세션이 이어지는 이튿날에는 상한으로 못 실은 15건도 다시 올라오지 않는다', async () => {
            const sent: EmailMessage[] = [];
            const subscriber = await subscribeToGoldenCross();

            await runMailAlertBatch(
                makeDeps(sent, { episodeCount: 15 }),
                FIRST
            );
            await runMailAlertBatch(
                makeDeps(sent, { episodeCount: 15 }),
                NEXT_DAY_FIRST
            );

            expect(sentTo(sent, subscriber.email)).toHaveLength(1);
            const rows = await deliveryRows(subscriber.id);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.itemKeys).toHaveLength(15);
        });

        it('선점만 하고 끝나지 않은 행의 항목도 이튿날 반복 방지에 센다(보낸 뒤 기록 전에 죽은 경우)', async () => {
            const sent: EmailMessage[] = [];
            const subscriber = await subscribeToGoldenCross();
            await deliveries.claim(subscriber.id, ALERT_DATE, [
                's:us:AAPL:golden_cross',
            ]);

            await runMailAlertBatch(makeDeps(sent), NEXT_DAY_FIRST);

            expect(sentTo(sent, subscriber.email)).toHaveLength(0);
            expect(await deliveryRows(subscriber.id)).toHaveLength(1);
        });

        it('항목이 없는 구독자는 선점 행도 만들지 않는다', async () => {
            const sent: EmailMessage[] = [];
            const email = nextEmail();
            const { id } = await subscribers.upsertVerified({
                email,
                locale: 'ko',
                consentSource: 'symbol',
            });
            await subscribers.addTopic(
                { kind: 'guest', subscriberId: id },
                { kind: 'signal', key: 'death_cross' },
                30
            );

            await runMailAlertBatch(makeDeps(sent), FIRST);

            expect(sentTo(sent, email)).toHaveLength(0);
            expect(await deliveryRows(id)).toEqual([]);
        });

        it('90일이 지난 발송 기록은 실행 끝에 지운다', async () => {
            const sent: EmailMessage[] = [];
            const subscriber = await subscribeToGoldenCross();
            await client`INSERT INTO mail_alert_deliveries (subscriber_id, alert_date, status)
              VALUES (${subscriber.id}, '2026-08-01', 'sent')`;

            const counts = countsOf(
                await runMailAlertBatch(makeDeps(sent), FIRST)
            );

            expect(counts.pruned).toBeGreaterThanOrEqual(1);
            expect(
                (await deliveryRows(subscriber.id)).map(row => row.alertDate)
            ).toEqual([ALERT_DATE]);
        });
        describe('가격대 알림', () => {
            const dailyBars = (...closes: Array<[string, number]>): Bar[] =>
                closes.map(([session, close]) => ({
                    time: Date.parse(`${session}T00:00:00Z`) / 1000,
                    open: close,
                    high: close,
                    low: close,
                    close,
                    volume: 1000,
                }));
            /** 만든 세션 11-20 뒤 11-23(185)과 11-24(179.5): 180 아래는 11-24 종가가 처음 충족한다. */
            const HIT = dailyBars(['2026-11-23', 185], ['2026-11-24', 179.5]);
            /**
             * 다음 날 실행이 읽는 일봉: 그날의 기대 세션(11-25) 봉까지 있다. 없으면 첫 슬롯이 알림 종목이 준비되지
             * 않았다고 보고 그 구독자를 미룬다.
             */
            const HIT_NEXT_DAY = [...HIT, ...dailyBars(['2026-11-25', 179])];

            /** 알림 하나만 가진 비회원 구독자(받을 항목도 보유 스위치도 없다). */
            async function subscribeWithAlert(
                overrides: Partial<CreatePriceAlertInput> = {}
            ): Promise<{ id: string; email: string; alertId: string }> {
                const email = nextEmail();
                const { id } = await subscribers.upsertVerified({
                    email,
                    locale: 'ko',
                    consentSource: 'agent_chat',
                });
                const outcome = await priceAlerts.createWithinLimit(
                    { kind: 'guest', subscriberId: id },
                    {
                        proposalId: randomUUID(),
                        symbol: 'AAPL',
                        market: 'us',
                        condition: { kind: 'close_below', level: 180 },
                        basis: 'price_level',
                        analysisAt: null,
                        referenceClose: 190,
                        startsAfterSession: '2026-11-20',
                        expiresOn: '2099-01-01',
                        ...overrides,
                    },
                    10
                );
                expect(outcome).toBe('created');
                const [row] = await client<{ id: string }[]>`
                    SELECT id FROM price_alerts WHERE subscriber_id = ${id}`;
                return { id, email, alertId: row?.id ?? '' };
            }

            async function alertRow(alertId: string): Promise<
                | {
                      status: string;
                      firedSession: string | null;
                      firedClose: string | null;
                      firedAt: string | null;
                  }
                | undefined
            > {
                const [row] = await client<
                    {
                        status: string;
                        fired_session: string | null;
                        fired_close: string | null;
                        fired_at: string | null;
                    }[]
                >`SELECT status, fired_session::text AS fired_session,
                    fired_close::text AS fired_close, fired_at::text AS fired_at
                  FROM price_alerts WHERE id = ${alertId}`;
                return row === undefined
                    ? undefined
                    : {
                          status: row.status,
                          firedSession: row.fired_session,
                          firedClose: row.fired_close,
                          firedAt: row.fired_at,
                      };
            }

            it('알림만 가진 구독자가 조건을 충족한 날 아침 메일을 받고, 같은 트랜잭션에서 알림이 fired가 된다', async () => {
                const sent: EmailMessage[] = [];
                const subscriber = await subscribeWithAlert();

                const counts = countsOf(
                    await runMailAlertBatch(
                        makeDeps(sent, { bars: HIT }),
                        FIRST
                    )
                );

                expect(counts.priceAlertsFired).toBeGreaterThanOrEqual(1);
                expect(sentTo(sent, subscriber.email)).toHaveLength(1);
                expect(sentTo(sent, subscriber.email)[0]?.text).toContain(
                    '11월 24일 종가가 알림 가격'
                );
                const row = await alertRow(subscriber.alertId);
                expect(row).toMatchObject({
                    status: 'fired',
                    firedSession: '2026-11-24',
                    firedClose: '179.500000',
                });
                expect(row?.firedAt).not.toBeNull();
                expect(await deliveryRows(subscriber.id)).toEqual([
                    {
                        alertDate: ALERT_DATE,
                        status: 'sent',
                        itemKeys: [`p:${subscriber.alertId}`],
                    },
                ]);
            });

            it('알린 알림은 같은 날 다시 돌아도, 다음 날 돌아도 두 번째 메일이 없고 기록은 그대로다', async () => {
                const sent: EmailMessage[] = [];
                const subscriber = await subscribeWithAlert();

                await runMailAlertBatch(makeDeps(sent, { bars: HIT }), FIRST);
                const before = await alertRow(subscriber.alertId);
                await runMailAlertBatch(makeDeps(sent, { bars: HIT }), FINAL);
                const nextDay = countsOf(
                    await runMailAlertBatch(
                        makeDeps(sent, { bars: HIT }),
                        NEXT_DAY_FIRST
                    )
                );

                expect(sentTo(sent, subscriber.email)).toHaveLength(1);
                expect(nextDay.priceAlertsActive).toBe(0);
                expect(await alertRow(subscriber.alertId)).toEqual(before);
                expect(await deliveryRows(subscriber.id)).toHaveLength(1);
            });

            it('겹쳐 도는 두 실행이 같은 알림을 읽어도 한 번만 알린다(선점이 정한다)', async () => {
                const sent: EmailMessage[] = [];
                const subscriber = await subscribeWithAlert();

                await Promise.all([
                    runMailAlertBatch(makeDeps(sent, { bars: HIT }), FIRST),
                    runMailAlertBatch(makeDeps(sent, { bars: HIT }), FIRST),
                ]);

                expect(sentTo(sent, subscriber.email)).toHaveLength(1);
                expect(await deliveryRows(subscriber.id)).toHaveLength(1);
                expect((await alertRow(subscriber.alertId))?.status).toBe(
                    'fired'
                );
            });

            it('선점에서 진 호출은 알림을 건드리지 않는다(같은 날 이미 선점한 행이 있다)', async () => {
                const subscriber = await subscribeWithAlert();
                await deliveries.claim(subscriber.id, ALERT_DATE);

                const claimId = await deliveries.claim(
                    subscriber.id,
                    ALERT_DATE,
                    [`p:${subscriber.alertId}`],
                    [
                        {
                            id: subscriber.alertId,
                            session: '2026-11-24',
                            close: 179.5,
                        },
                    ]
                );

                expect(claimId).toBeNull();
                expect((await alertRow(subscriber.alertId))?.status).toBe(
                    'active'
                );
            });

            it('알림 표시가 실패하면 선점도 함께 되돌아간다(한 트랜잭션이다)', async () => {
                const subscriber = await subscribeWithAlert();

                await expect(
                    deliveries.claim(
                        subscriber.id,
                        ALERT_DATE,
                        [`p:${subscriber.alertId}`],
                        [
                            {
                                id: subscriber.alertId,
                                session: '2026-11-24',
                                close: Number.NaN,
                            },
                        ]
                    )
                ).rejects.toThrow();

                expect(await deliveryRows(subscriber.id)).toEqual([]);
                expect((await alertRow(subscriber.alertId))?.status).toBe(
                    'active'
                );
            });

            it('선점은 자기 구독자의 알림만 표시한다: 다른 구독자의 알림 id는 fired가 되지 않는다', async () => {
                const owner = await subscribeWithAlert();
                const other = await subscribeWithAlert();

                const claimId = await deliveries.claim(
                    other.id,
                    ALERT_DATE,
                    [],
                    [
                        {
                            id: owner.alertId,
                            session: '2026-11-24',
                            close: 179.5,
                        },
                    ]
                );

                expect(claimId).not.toBeNull();
                expect((await alertRow(owner.alertId))?.status).toBe('active');
            });

            it('이미 fired인 알림은 다시 표시하지 않는다(처음 알린 세션과 종가가 남는다)', async () => {
                const subscriber = await subscribeWithAlert();
                await deliveries.claim(
                    subscriber.id,
                    ALERT_DATE,
                    [],
                    [
                        {
                            id: subscriber.alertId,
                            session: '2026-11-24',
                            close: 179.5,
                        },
                    ]
                );

                await deliveries.claim(
                    subscriber.id,
                    '2026-11-26',
                    [],
                    [
                        {
                            id: subscriber.alertId,
                            session: '2026-11-25',
                            close: 170,
                        },
                    ]
                );

                expect(await alertRow(subscriber.alertId)).toMatchObject({
                    status: 'fired',
                    firedSession: '2026-11-24',
                    firedClose: '179.500000',
                });
            });

            it('조건을 충족하지 않은 날은 선점도 발송도 없고 알림은 진행 중이다', async () => {
                const sent: EmailMessage[] = [];
                const subscriber = await subscribeWithAlert();

                const counts = countsOf(
                    await runMailAlertBatch(
                        makeDeps(sent, {
                            bars: dailyBars(
                                ['2026-11-23', 185],
                                ['2026-11-24', 186]
                            ),
                        }),
                        FIRST
                    )
                );

                expect(counts.priceAlertsActive).toBeGreaterThanOrEqual(1);
                expect(sentTo(sent, subscriber.email)).toHaveLength(0);
                expect(await deliveryRows(subscriber.id)).toEqual([]);
                expect((await alertRow(subscriber.alertId))?.status).toBe(
                    'active'
                );
            });

            // 만든 세션(11-20)의 종가가 190에서 95로 소급 조정돼 있다 — 2:1 분할.
            const SPLIT = dailyBars(['2026-11-20', 95], ['2026-11-24', 94]);
            const SPLIT_NEXT_DAY = [...SPLIT, ...dailyBars(['2026-11-25', 94])];

            it('분할로 척도가 달라진 알림은 메일이 알린 뒤 지워지고, 알림만 가졌던 구독자는 받을 것이 없어 함께 지워진다', async () => {
                const sent: EmailMessage[] = [];
                const subscriber = await subscribeWithAlert({
                    referenceClose: 190,
                });

                const counts = countsOf(
                    await runMailAlertBatch(
                        makeDeps(sent, { bars: SPLIT }),
                        FIRST
                    )
                );

                expect(counts.priceAlertsVoided).toBeGreaterThanOrEqual(1);
                expect(sentTo(sent, subscriber.email)).toHaveLength(1);
                expect(sentTo(sent, subscriber.email)[0]?.text).toContain(
                    'AAPL 가격 기준이 크게 바뀌어(예: 주식 분할) 가격대 알림을 끝냈어요.'
                );
                expect(await alertRow(subscriber.alertId)).toBeUndefined();
                expect(
                    await client`SELECT 1 FROM mail_alert_subscribers WHERE id = ${subscriber.id}`
                ).toHaveLength(0);
            });

            it('다른 항목이 남은 구독자는 지워지지 않고 안내를 보낸 기록이 남는다', async () => {
                const sent: EmailMessage[] = [];
                const subscriber = await subscribeWithAlert({
                    referenceClose: 190,
                });
                await subscribers.addTopic(
                    { kind: 'guest', subscriberId: subscriber.id },
                    { kind: 'signal', key: 'death_cross' },
                    30
                );

                await runMailAlertBatch(makeDeps(sent, { bars: SPLIT }), FIRST);

                expect(await alertRow(subscriber.alertId)).toBeUndefined();
                expect(await deliveryRows(subscriber.id)).toEqual([
                    {
                        alertDate: ALERT_DATE,
                        status: 'sent',
                        itemKeys: [`v:${subscriber.alertId}`],
                    },
                ]);
            });

            it('선점은 끝낼 알림(v: 키)을 지우지 않는다: 삭제는 메일이 나간 뒤 finish가 한다', async () => {
                const subscriber = await subscribeWithAlert();

                const claimId = await deliveries.claim(
                    subscriber.id,
                    ALERT_DATE,
                    [`v:${subscriber.alertId}`]
                );

                expect(claimId).not.toBeNull();
                expect((await alertRow(subscriber.alertId))?.status).toBe(
                    'active'
                );
            });

            it('같은 날 이미 보낸 구독자의 끝낼 알림은 그날 남아 있다가 다음 날 안내와 함께 지워진다', async () => {
                const sent: EmailMessage[] = [];
                const subscriber = await subscribeWithAlert({
                    referenceClose: 190,
                });
                await deliveries.claim(subscriber.id, ALERT_DATE);

                const first = countsOf(
                    await runMailAlertBatch(
                        makeDeps(sent, { bars: SPLIT }),
                        FIRST
                    )
                );
                expect(first.alreadyClaimed).toBeGreaterThanOrEqual(1);
                expect(await alertRow(subscriber.alertId)).toBeDefined();

                await runMailAlertBatch(
                    makeDeps(sent, { bars: SPLIT_NEXT_DAY }),
                    NEXT_DAY_FIRST
                );

                expect(sentTo(sent, subscriber.email)).toHaveLength(1);
                expect(await alertRow(subscriber.alertId)).toBeUndefined();
            });

            describe('끝낸 알림의 삭제는 finish가 메일 결과를 보고 한다', () => {
                async function claimedVoid() {
                    const subscriber = await subscribeWithAlert();
                    const claimId = await deliveries.claim(
                        subscriber.id,
                        ALERT_DATE,
                        [`v:${subscriber.alertId}`]
                    );
                    return { subscriber, claimId: claimId?.id ?? '' };
                }

                it('받아 준 메일이면 끝낸 알림을 지운다', async () => {
                    const { subscriber, claimId } = await claimedVoid();

                    await deliveries.finish(
                        claimId,
                        'sent',
                        [`v:${subscriber.alertId}`],
                        null,
                        false
                    );

                    expect(await alertRow(subscriber.alertId)).toBeUndefined();
                });

                it('확정적 거절이면 끝낸 알림을 남겨 다음 실행이 다시 알린다', async () => {
                    const { subscriber, claimId } = await claimedVoid();

                    await deliveries.finish(
                        claimId,
                        'failed',
                        [`v:${subscriber.alertId}`],
                        'dispatcher rejected',
                        true
                    );

                    expect((await alertRow(subscriber.alertId))?.status).toBe(
                        'active'
                    );
                });

                it('실행 전체: 거절된 안내 메일은 알림을 남기고 다음 날 받아 준 안내가 지운다', async () => {
                    const sent: EmailMessage[] = [];
                    const subscriber = await subscribeWithAlert({
                        referenceClose: 190,
                    });

                    await runMailAlertBatch(
                        makeDeps(sent, { bars: SPLIT, dispatch: 'reject' }),
                        FIRST
                    );
                    expect(await alertRow(subscriber.alertId)).toBeDefined();
                    expect(
                        await client`SELECT 1 FROM mail_alert_subscribers WHERE id = ${subscriber.id}`
                    ).toHaveLength(1);

                    await runMailAlertBatch(
                        makeDeps(sent, { bars: SPLIT_NEXT_DAY }),
                        NEXT_DAY_FIRST
                    );

                    expect(sentTo(sent, subscriber.email)).toHaveLength(1);
                    expect(await alertRow(subscriber.alertId)).toBeUndefined();
                });

                it('실행 전체: 보내다 던지면 나갔을 수 있어 알림을 지운다', async () => {
                    const sent: EmailMessage[] = [];
                    const subscriber = await subscribeWithAlert({
                        referenceClose: 190,
                    });

                    await runMailAlertBatch(
                        makeDeps(sent, { bars: SPLIT, dispatch: 'throw' }),
                        FIRST
                    );

                    expect(await alertRow(subscriber.alertId)).toBeUndefined();
                });

                it('이 기록의 구독자 알림만 지운다: 다른 구독자의 알림 id와 이미 알린 알림은 남는다', async () => {
                    const owner = await subscribeWithAlert();
                    const other = await subscribeWithAlert();
                    const firedOne = await subscribeWithAlert();
                    await deliveries.claim(
                        firedOne.id,
                        ALERT_DATE,
                        [],
                        [
                            {
                                id: firedOne.alertId,
                                session: '2026-11-24',
                                close: 179.5,
                            },
                        ]
                    );
                    const otherClaim = await deliveries.claim(
                        other.id,
                        ALERT_DATE,
                        [`v:${owner.alertId}`]
                    );
                    const firedClaim = await deliveries.claim(
                        firedOne.id,
                        '2026-11-26',
                        [`v:${firedOne.alertId}`]
                    );

                    await deliveries.finish(
                        otherClaim?.id ?? '',
                        'sent',
                        [`v:${owner.alertId}`],
                        null
                    );
                    await deliveries.finish(
                        firedClaim?.id ?? '',
                        'sent',
                        [`v:${firedOne.alertId}`],
                        null
                    );

                    expect((await alertRow(owner.alertId))?.status).toBe(
                        'active'
                    );
                    expect((await alertRow(firedOne.alertId))?.status).toBe(
                        'fired'
                    );
                });
            });

            it('만료 세션을 판정하는 실행에서 그 세션의 종가가 충족하면 메일로 알리고, 다음 실행은 만료된 알림을 정리한다', async () => {
                const sent: EmailMessage[] = [];
                // 만료 세션(11-24)이 첫 실행의 기대 세션과 같다(알림 날짜 11-25보다 하루 앞선다).
                const onExpiry = await subscribeWithAlert({
                    expiresOn: '2026-11-24',
                });
                const unfired = await subscribeWithAlert({
                    expiresOn: '2026-11-24',
                    condition: { kind: 'close_below', level: 100 },
                });

                await runMailAlertBatch(makeDeps(sent, { bars: HIT }), FIRST);

                expect(sentTo(sent, onExpiry.email)).toHaveLength(1);
                expect(sentTo(sent, onExpiry.email)[0]?.text).toContain(
                    '11월 24일 종가가 알림 가격'
                );
                expect((await alertRow(onExpiry.alertId))?.status).toBe(
                    'fired'
                );
                // 만료 세션을 판정한 실행에서는 아직 지우지 않는다.
                expect((await alertRow(unfired.alertId))?.status).toBe(
                    'active'
                );

                const next = countsOf(
                    await runMailAlertBatch(
                        makeDeps(sent, { bars: HIT }),
                        NEXT_DAY_FIRST
                    )
                );

                expect(next.priceAlertsPruned).toBeGreaterThanOrEqual(1);
                expect(await alertRow(unfired.alertId)).toBeUndefined();
            });

            describe('발송이 거절되면 알림을 되살린다', () => {
                it('확정적 거절(rejected)이면 알림이 다시 active가 되고 다음 날 같은 종가로 다시 알린다', async () => {
                    const sent: EmailMessage[] = [];
                    const subscriber = await subscribeWithAlert();

                    const first = countsOf(
                        await runMailAlertBatch(
                            makeDeps(sent, { bars: HIT, dispatch: 'reject' }),
                            FIRST
                        )
                    );

                    expect(first.failed).toBeGreaterThanOrEqual(1);
                    expect(await alertRow(subscriber.alertId)).toMatchObject({
                        status: 'active',
                        firedSession: null,
                        firedClose: null,
                        firedAt: null,
                    });
                    expect((await deliveryRows(subscriber.id))[0]?.status).toBe(
                        'failed'
                    );

                    await runMailAlertBatch(
                        makeDeps(sent, { bars: HIT_NEXT_DAY }),
                        NEXT_DAY_FIRST
                    );

                    expect(sentTo(sent, subscriber.email)).toHaveLength(1);
                    expect(sentTo(sent, subscriber.email)[0]?.text).toContain(
                        '11월 24일 종가가 알림 가격'
                    );
                    expect((await alertRow(subscriber.alertId))?.status).toBe(
                        'fired'
                    );
                });

                it('발송기가 던지면 보냈는지 알 수 없어 알림은 fired로 남는다', async () => {
                    const sent: EmailMessage[] = [];
                    const subscriber = await subscribeWithAlert();

                    await runMailAlertBatch(
                        makeDeps(sent, { bars: HIT, dispatch: 'throw' }),
                        FIRST
                    );

                    expect((await alertRow(subscriber.alertId))?.status).toBe(
                        'fired'
                    );
                    expect((await deliveryRows(subscriber.id))[0]?.status).toBe(
                        'failed'
                    );
                });

                it('다시 살리기는 이 기록의 구독자 알림만 건드린다(다른 구독자의 p: 키는 무시)', async () => {
                    const owner = await subscribeWithAlert();
                    const other = await subscribeWithAlert();
                    await deliveries.claim(
                        owner.id,
                        ALERT_DATE,
                        [],
                        [
                            {
                                id: owner.alertId,
                                session: '2026-11-24',
                                close: 179.5,
                            },
                        ]
                    );
                    const otherClaim = await deliveries.claim(
                        other.id,
                        ALERT_DATE,
                        [`p:${owner.alertId}`]
                    );

                    await deliveries.finish(
                        otherClaim?.id ?? '',
                        'failed',
                        [`p:${owner.alertId}`],
                        'dispatcher rejected',
                        true
                    );

                    expect((await alertRow(owner.alertId))?.status).toBe(
                        'fired'
                    );
                });

                it('선점은 실제로 fired로 바꾼 알림 id만 돌려준다(판정 뒤 지워진 알림은 빠진다)', async () => {
                    const kept = await subscribeWithAlert();
                    const gone = await subscribeWithAlert();
                    await client`DELETE FROM price_alerts WHERE id = ${gone.alertId}`;
                    const fired = (id: string) => ({
                        id,
                        session: '2026-11-24',
                        close: 179.5,
                    });

                    const keptClaim = await deliveries.claim(
                        kept.id,
                        ALERT_DATE,
                        [`p:${kept.alertId}`],
                        [fired(kept.alertId)]
                    );
                    const goneClaim = await deliveries.claim(
                        gone.id,
                        ALERT_DATE,
                        [`p:${gone.alertId}`],
                        [fired(gone.alertId)]
                    );

                    expect(keptClaim?.firedAlertIds).toEqual([kept.alertId]);
                    expect(goneClaim?.firedAlertIds).toEqual([]);
                    expect(goneClaim?.id).toEqual(expect.any(String));
                });

                it('이미 sent인 기록에 늦게 온 거절은 기록도 알림도 바꾸지 않는다(DB-11, 메일은 이미 나갔다)', async () => {
                    const subscriber = await subscribeWithAlert();
                    const claimId =
                        (
                            await deliveries.claim(
                                subscriber.id,
                                ALERT_DATE,
                                [`p:${subscriber.alertId}`],
                                [
                                    {
                                        id: subscriber.alertId,
                                        session: '2026-11-24',
                                        close: 179.5,
                                    },
                                ]
                            )
                        )?.id ?? '';
                    await deliveries.finish(
                        claimId,
                        'sent',
                        [`p:${subscriber.alertId}`],
                        null,
                        false
                    );

                    await deliveries.finish(
                        claimId,
                        'failed',
                        [`p:${subscriber.alertId}`],
                        'late',
                        true
                    );

                    expect((await deliveryRows(subscriber.id))[0]?.status).toBe(
                        'sent'
                    );
                    expect(await alertRow(subscriber.alertId)).toMatchObject({
                        status: 'fired',
                        firedSession: '2026-11-24',
                    });
                });

                it('다시 살리기를 켜지 않으면 항목 키에 알림이 있어도 fired를 그대로 둔다', async () => {
                    const subscriber = await subscribeWithAlert();
                    const claimId = await deliveries.claim(
                        subscriber.id,
                        ALERT_DATE,
                        [`p:${subscriber.alertId}`],
                        [
                            {
                                id: subscriber.alertId,
                                session: '2026-11-24',
                                close: 179.5,
                            },
                        ]
                    );

                    await deliveries.finish(
                        claimId?.id ?? '',
                        'failed',
                        [`p:${subscriber.alertId}`],
                        'x'
                    );

                    expect((await alertRow(subscriber.alertId))?.status).toBe(
                        'fired'
                    );
                });
            });

            describe('잠금 순서: 선점은 구독자 행을 먼저 잠근다', () => {
                /**
                 * 잠금을 기다리는 백엔드가 `count`개가 될 때까지 관찰한다(sleep으로 추측하지 않는다, TE-7).
                 * 같은 행을 기다리는 둘째는 첫째 뒤에 줄을 서므로 `pg_blocking_pids`에 홀더가 아니라 첫째가 뜬다 —
                 * 그래서 `holderPid`에 직접 막힌 수가 아니라 잠금 대기 중인 백엔드 수로 센다. 첫 인자는 개수를 셀
                 * 때 홀더가 쥔 연결 자신을 빼는 데 쓴다.
                 */
                async function waitBlockedBy(
                    holderPid: number,
                    count: number
                ): Promise<void> {
                    const deadline = Date.now() + 3_000;
                    for (;;) {
                        const [row] = await client<{ n: number }[]>`
                            SELECT count(*)::int AS n FROM pg_stat_activity
                            WHERE wait_event_type = 'Lock'
                              AND datname = current_database()
                              AND pid <> ${holderPid}`;
                        if ((row?.n ?? 0) >= count) return;
                        if (Date.now() > deadline) {
                            throw new Error(
                                `expected ${count} backends waiting on a lock held by ${holderPid}`
                            );
                        }
                        await new Promise(resolve => setTimeout(resolve, 20));
                    }
                }

                async function twoAlerts() {
                    const subscriber = await subscribeWithAlert();
                    const outcome = await priceAlerts.createWithinLimit(
                        { kind: 'guest', subscriberId: subscriber.id },
                        {
                            proposalId: randomUUID(),
                            symbol: 'AAPL',
                            market: 'us',
                            condition: { kind: 'close_below', level: 150 },
                            basis: 'price_level',
                            analysisAt: null,
                            referenceClose: 190,
                            startsAfterSession: '2026-11-20',
                            expiresOn: '2099-01-01',
                        },
                        10
                    );
                    expect(outcome).toBe('created');
                    const rows = await client<{ id: string }[]>`
                        SELECT id FROM price_alerts WHERE subscriber_id = ${subscriber.id}
                        ORDER BY created_at, id`;
                    return {
                        subscriber,
                        first: rows[0]?.id ?? '',
                        second: rows[1]?.id ?? '',
                    };
                }

                it('구독자를 잠그고 알림을 지우는 경로(cancel·정리)와 겹쳐도 교착하지 않는다', async () => {
                    const { subscriber, first, second } = await twoAlerts();
                    const holder = await client.reserve();
                    try {
                        await holder`BEGIN`;
                        await holder`SELECT id FROM mail_alert_subscribers WHERE id = ${subscriber.id} FOR NO KEY UPDATE`;
                        await holder`DELETE FROM price_alerts WHERE id = ${second}`;
                        const [pidRow] = await holder<
                            { pid: number }[]
                        >`SELECT pg_backend_pid() AS pid`;

                        const claiming = deliveries.claim(
                            subscriber.id,
                            ALERT_DATE,
                            [`p:${first}`, `p:${second}`],
                            [
                                {
                                    id: first,
                                    session: '2026-11-24',
                                    close: 179.5,
                                },
                                {
                                    id: second,
                                    session: '2026-11-24',
                                    close: 179.5,
                                },
                            ]
                        );
                        await waitBlockedBy(pidRow?.pid ?? 0, 1);
                        // 이 문장이 선점이 쥔 알림 행을 기다리면(옛 순서) 서로 기다려 교착한다.
                        await holder`DELETE FROM price_alerts WHERE id = ${first}`;
                        await holder`COMMIT`;

                        // 두 알림 모두 선점 전에 지워졌으므로 선점은 아무것도 알리지 않았다고 돌려준다.
                        await expect(claiming).resolves.toEqual({
                            id: expect.any(String),
                            firedAlertIds: [],
                        });
                    } finally {
                        await holder`ROLLBACK`.catch(() => undefined);
                        holder.release();
                    }
                });

                it('finish가 알림을 지울 때도 구독자를 먼저 잠근다(구독자를 쥔 채 알림을 지우는 경로와 교착하지 않는다)', async () => {
                    const { subscriber, first, second } = await twoAlerts();
                    const claimId = await deliveries.claim(
                        subscriber.id,
                        ALERT_DATE,
                        [`v:${first}`, `v:${second}`]
                    );
                    const holder = await client.reserve();
                    try {
                        await holder`BEGIN`;
                        await holder`SELECT id FROM mail_alert_subscribers WHERE id = ${subscriber.id} FOR NO KEY UPDATE`;
                        await holder`DELETE FROM price_alerts WHERE id = ${second}`;
                        const [pidRow] = await holder<
                            { pid: number }[]
                        >`SELECT pg_backend_pid() AS pid`;

                        const finishing = deliveries.finish(
                            claimId?.id ?? '',
                            'sent',
                            [`v:${first}`, `v:${second}`],
                            null,
                            false
                        );
                        await waitBlockedBy(pidRow?.pid ?? 0, 1);
                        await holder`DELETE FROM price_alerts WHERE id = ${first}`;
                        await holder`COMMIT`;

                        await expect(finishing).resolves.toBeUndefined();
                    } finally {
                        await holder`ROLLBACK`.catch(() => undefined);
                        holder.release();
                    }
                });

                it('removeSubscriberIfNothingToReceive와 같은 구독자에 겹친 선점도 함께 구독자 잠금을 기다렸다 끝난다', async () => {
                    const { subscriber, first, second } = await twoAlerts();
                    await subscribers.addTopic(
                        { kind: 'guest', subscriberId: subscriber.id },
                        { kind: 'signal', key: 'golden_cross' },
                        30
                    );
                    const holder = await client.reserve();
                    try {
                        await holder`BEGIN`;
                        await holder`SELECT id FROM mail_alert_subscribers WHERE id = ${subscriber.id} FOR NO KEY UPDATE`;
                        const [pidRow] = await holder<
                            { pid: number }[]
                        >`SELECT pg_backend_pid() AS pid`;

                        const claiming = deliveries.claim(
                            subscriber.id,
                            ALERT_DATE,
                            [`p:${first}`, `p:${second}`],
                            [
                                {
                                    id: first,
                                    session: '2026-11-24',
                                    close: 179.5,
                                },
                                {
                                    id: second,
                                    session: '2026-11-24',
                                    close: 179.5,
                                },
                            ]
                        );
                        const cleaning =
                            priceAlerts.removeSubscriberIfNothingToReceive(
                                subscriber.id
                            );
                        // 둘 다 구독자 행 잠금에서 기다린다 — 선점이 먼저 발송 기록·알림 행을 잡지 않았다는 관찰이다.
                        await waitBlockedBy(pidRow?.pid ?? 0, 2);
                        await holder`COMMIT`;

                        await expect(claiming).resolves.toEqual({
                            id: expect.any(String),
                            firedAlertIds: expect.arrayContaining([
                                first,
                                second,
                            ]),
                        });
                        await expect(cleaning).resolves.toBe(false);
                        expect((await alertRow(first))?.status).toBe('fired');
                        expect((await alertRow(second))?.status).toBe('fired');
                    } finally {
                        await holder`ROLLBACK`.catch(() => undefined);
                        holder.release();
                    }
                });
            });

            it('실행 끝에 만료된 알림과 보존 기간이 지난 알린 알림을 정리한다', async () => {
                const sent: EmailMessage[] = [];
                // 만료 세션(11-23)이 이번 실행의 기대 세션(11-24)보다 앞선다.
                const expired = await subscribeWithAlert({
                    expiresOn: '2026-11-23',
                });
                const longFired = await subscribeWithAlert();
                await client`UPDATE price_alerts
                    SET status = 'fired', fired_session = '2026-10-01',
                        fired_close = 1, fired_at = '2026-10-02T00:00:00Z'
                    WHERE id = ${longFired.alertId}`;

                const counts = countsOf(
                    await runMailAlertBatch(makeDeps(sent), FIRST)
                );

                expect(counts.priceAlertsPruned).toBeGreaterThanOrEqual(2);
                expect(await alertRow(expired.alertId)).toBeUndefined();
                expect(await alertRow(longFired.alertId)).toBeUndefined();
            });
        });

        it('담은 종목의 추세 변화는 보내고, 이튿날 같은 종목의 추세 줄은 진짜 반복 방지 창이 막는다', async () => {
            const sent: EmailMessage[] = [];
            const email = nextEmail();
            const { id } = await subscribers.upsertVerified({
                email,
                locale: 'ko',
                consentSource: 'symbol',
            });
            await subscribers.addTopic(
                { kind: 'guest', subscriberId: id },
                { kind: 'symbol', key: 'AAPL' },
                30
            );
            // 64봉째에서 추세 판정이 중립 → 강세로 바뀌는 종가열을 기대 세션(11-24, 이튿날 11-25)에 맞춘다.
            const climb = [
                ...Array.from(
                    { length: 60 },
                    (_, i) => 100 + (i % 2 ? 0.5 : -0.5)
                ),
                ...Array.from({ length: 4 }, (_, i) => 100 + (i + 1) * 3),
            ];
            const barsEndingOn = (session: string): Bar[] => {
                const last = Date.parse(`${session}T00:00:00Z`) / 1000;
                return climb.map((close, i) => ({
                    time: last - (climb.length - 1 - i) * 86_400,
                    open: close,
                    high: close + 1,
                    low: close - 1,
                    close,
                    volume: 1000,
                }));
            };

            const first = countsOf(
                await runMailAlertBatch(
                    makeDeps(sent, {
                        episodeCount: 0,
                        bars: barsEndingOn('2026-11-24'),
                    }),
                    FIRST
                )
            );
            const next = countsOf(
                await runMailAlertBatch(
                    makeDeps(sent, {
                        episodeCount: 0,
                        bars: barsEndingOn('2026-11-25'),
                    }),
                    NEXT_DAY_FIRST
                )
            );

            expect(first.changeLines).toBeGreaterThanOrEqual(1);
            expect(sentTo(sent, email)).toHaveLength(1);
            expect(sentTo(sent, email)[0]?.text).toContain(
                '추세 판정이 보합에서 강세로 바뀌었어요.'
            );
            expect(await deliveryRows(id)).toEqual([
                {
                    alertDate: ALERT_DATE,
                    status: 'sent',
                    itemKeys: ['t:us:AAPL'],
                },
            ]);
            expect(next.suppressedItems).toBeGreaterThanOrEqual(1);

            // N-d: 달라진 점은 새 구독 종류가 아니라 종목 항목에 얹혀 있다 — 그 항목을 지우면 구독자도 지워진다.
            expect(
                await subscribers.removeTopic(
                    { kind: 'guest', subscriberId: id },
                    { kind: 'symbol', key: 'AAPL' }
                )
            ).toEqual({ deleted: true, subscriberDeleted: true });
            expect(await deliveryRows(id)).toEqual([]);
        });
    }
);
