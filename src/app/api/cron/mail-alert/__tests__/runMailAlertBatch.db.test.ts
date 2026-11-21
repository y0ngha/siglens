import { readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../../../db/scripts/lib/dbTarget';
import {
    DrizzleMailAlertDeliveryRepository,
    DrizzleMailAlertSubscriberRepository,
} from '@/entities/mail-alert/api';
import * as schema from '@/shared/db/schema';
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
            options: { claimOnly?: boolean; episodeCount?: number } = {}
        ): MailAlertBatchDeps {
            return {
                launched: true,
                secret: SECRET,
                siteUrl: 'https://siglens.io',
                subscribers,
                // `claimOnly`: 반복 방지 창을 비워 두 번째 시도를 막는 것이 선점 행뿐이게 한다. 창이 켜져 있으면
                // 이미 보낸 항목이 먼저 걸러져 선점 규칙이 가려진다.
                deliveries: options.claimOnly
                    ? {
                          claim: (subscriberId, alertDate, itemKeys) =>
                              deliveries.claim(
                                  subscriberId,
                                  alertDate,
                                  itemKeys
                              ),
                          finish: (id, outcome, itemKeys, error) =>
                              deliveries.finish(id, outcome, itemKeys, error),
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
                    loadDailyBars: vi.fn().mockResolvedValue([]),
                },
                universe: { us: new Set(['AAPL']), kr: new Set() },
                findHoldings: vi.fn().mockResolvedValue([]),
                findWatchlist: vi.fn().mockResolvedValue([]),
                resolveMarket: vi.fn().mockResolvedValue('us'),
                getTranslator: async () => tKo,
                getSignalLabel: async () => type =>
                    labelKo.has(`signalType.${type}`)
                        ? labelKo(`signalType.${type}`)
                        : null,
                getDisclaimer: async () => '투자 참고용이에요.',
                dispatcher: {
                    sendEmail: async message => {
                        sent.push(message);
                        return true;
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
    }
);
