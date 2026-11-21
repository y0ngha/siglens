import { readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import {
    DrizzleMailAlertDeliveryRepository,
    DrizzleMailAlertSubscriberRepository,
} from '../api';

vi.mock('server-only', () => ({}));

/**
 * 알림 메일 구독자·항목·발송 기록의 규칙을 진짜 Postgres에서 본다(TESTING.md#TE-55): 주소 유니크
 * upsert, 구독자 행 잠금 아래의 상한(동시 추가), 마지막 항목 제거 시 구독자 삭제, 하루 한 통 선점,
 * FK 연쇄, CHECK. 모킹된 DB로는 잠금 직렬화·`xmax`·연쇄 삭제가 보이지 않는다.
 * `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --name <unique> -e POSTGRES_PASSWORD=x -e POSTGRES_USER=siglens -e POSTGRES_DB=siglens_test \
 *     -p 127.0.0.1:55432:5432 --pull never postgres:17-alpine
 *   TEST_DATABASE_URL=postgres://siglens:x@127.0.0.1:55432/siglens_test yarn test mailAlert.db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션(`0063_mail_alerts.sql`)을
 * 적용한 뒤 끝나면 스키마를 지운다. `users`는 FK에 필요한 열만 둔 최소 테이블이다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `mail_alert_test_${process.pid}`;
const POOL_SIZE = 12;

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.replaceAll('"public".', ''));

const signalTopic = (key: string) => ({ kind: 'signal' as const, key });
const symbolTopic = (key: string) => ({ kind: 'symbol' as const, key });

describe.skipIf(!URL)(
    '알림 메일 저장소가 진짜 Postgres에서 규칙대로 동작한다',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: POOL_SIZE,
            connection: { search_path: SCHEMA },
        });
        const db = drizzle(client, { schema });
        const subscribers = new DrizzleMailAlertSubscriberRepository(db);
        const deliveries = new DrizzleMailAlertDeliveryRepository(db);
        const counter = { value: 0 };

        /** 문장들을 순서대로(앞 문장이 끝나야 다음을 보낸다) 실행한다. */
        async function runInOrder(
            statements: readonly string[]
        ): Promise<void> {
            await statements.reduce(
                (previous, statement) =>
                    previous.then(() =>
                        client.unsafe(statement).then(() => {})
                    ),
                Promise.resolve()
            );
        }

        /** 테스트마다 서로 다른 주소를 쓴다 — 주소가 유니크 키라 테스트끼리 섞이지 않게 한다. */
        function nextEmail(): string {
            counter.value += 1;
            return `user${counter.value}@example.com`;
        }

        /** 회원 한 명. 기본은 이메일이 인증된 회원이고, 주소는 테스트마다 다르다. */
        async function createMember(
            options: { email?: string; verified?: boolean } = {}
        ): Promise<{ id: string; email: string }> {
            const email = options.email ?? nextEmail();
            const [row] = await client<{ id: string }[]>`
                INSERT INTO users (email, email_verified)
                VALUES (${email}, ${options.verified ?? true}) RETURNING id`;
            return { id: row.id, email };
        }

        async function subscribe(
            overrides: { email?: string } = {}
        ): Promise<{ id: string; email: string }> {
            const email = overrides.email ?? nextEmail();
            const { id } = await subscribers.upsertVerified({
                email,
                locale: 'ko',
                consentSource: 'symbol',
            });
            return { id, email };
        }

        async function countRows(
            table: string,
            where: string
        ): Promise<number> {
            const [row] = await client.unsafe<{ n: number }[]>(
                `SELECT count(*)::int AS n FROM ${table} WHERE ${where}`
            );
            return row?.n ?? 0;
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
            await runInOrder(migration('0063_mail_alerts.sql'));
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        describe('upsertVerified', () => {
            it('같은 주소를 두 번 확인해도 한 행이고, created는 처음만 참이다', async () => {
                const email = nextEmail();
                const input = {
                    email,
                    locale: 'ko' as const,
                    consentSource: 'symbol' as const,
                };
                const first = await subscribers.upsertVerified(input);
                const second = await subscribers.upsertVerified({
                    ...input,
                    locale: 'en',
                    consentSource: 'settings',
                });

                expect(first.created).toBe(true);
                expect(second).toEqual({ id: first.id, created: false });
                expect(
                    await countRows(
                        'mail_alert_subscribers',
                        `email = '${email}'`
                    )
                ).toBe(1);
                // 처음 동의 화면과 로케일은 두 번째 확인이 옮기지 않는다.
                const record = await subscribers.findById(first.id);
                expect(record?.consentSource).toBe('symbol');
                expect(record?.locale).toBe('ko');
            });

            it('그 주소를 가진 인증된 회원이 있으면 그 회원에게 연결한다', async () => {
                const member = await createMember();

                const { id } = await subscribe({ email: member.email });

                expect((await subscribers.findById(id))?.userId).toBe(
                    member.id
                );
            });

            it('주소를 가진 회원이 없거나 인증 전이면 비회원 행(user_id null)이다', async () => {
                const unverified = await createMember({ verified: false });

                const stranger = await subscribe();
                const notVerified = await subscribe({
                    email: unverified.email,
                });

                expect(
                    (await subscribers.findById(stranger.id))?.userId
                ).toBeNull();
                expect(
                    (await subscribers.findById(notVerified.id))?.userId
                ).toBeNull();
            });

            it('user_id는 비어 있을 때만 채운다: 비회원 행은 회원이 인증된 뒤 다시 확인하면 연결되고, 한 번 연결된 행은 바뀌지 않는다', async () => {
                const member = await createMember({ verified: false });
                const { id } = await subscribe({ email: member.email });
                expect((await subscribers.findById(id))?.userId).toBeNull();

                await client`UPDATE users SET email_verified = true WHERE id = ${member.id}`;
                await subscribe({ email: member.email });
                expect((await subscribers.findById(id))?.userId).toBe(
                    member.id
                );

                await client`UPDATE users SET email_verified = false WHERE id = ${member.id}`;
                await subscribe({ email: member.email });
                expect((await subscribers.findById(id))?.userId).toBe(
                    member.id
                );
            });

            it('연결된 회원이 두 번째 주소를 인증하면 user_id 유니크에 걸리지 않고 새 비회원 행이 생긴다', async () => {
                const member = await createMember();
                const first = await subscribe({ email: member.email });
                const secondAddress = nextEmail();

                const second = await subscribe({ email: secondAddress });

                expect(second.id).not.toBe(first.id);
                expect((await subscribers.findById(first.id))?.userId).toBe(
                    member.id
                );
                expect(
                    (await subscribers.findById(second.id))?.userId
                ).toBeNull();
            });

            it('회원이 주소를 바꿨어도 새 주소 확인이 옛 행과 같은 user_id로 충돌하지 않는다', async () => {
                const member = await createMember();
                await subscribe({ email: member.email });
                const newAddress = nextEmail();
                await client`UPDATE users SET email = ${newAddress} WHERE id = ${member.id}`;

                const renewed = await subscribe({ email: newAddress });

                expect(
                    (await subscribers.findById(renewed.id))?.userId
                ).toBeNull();
            });
        });

        describe('findForMember', () => {
            it('user_id로 연결된 행을 먼저 찾는다', async () => {
                const member = await createMember();
                const { id } = await subscribe({ email: member.email });

                const found = await subscribers.findForMember(member.id);

                expect(found?.id).toBe(id);
            });

            it('연결 안 된 회원 본인 주소의 행은 인증된 회원이면 연결해 돌려준다', async () => {
                const member = await createMember({ verified: false });
                const { id } = await subscribe({ email: member.email });
                await client`UPDATE users SET email_verified = true WHERE id = ${member.id}`;

                const found = await subscribers.findForMember(member.id);

                expect(found?.id).toBe(id);
                expect(found?.userId).toBe(member.id);
                expect((await subscribers.findById(id))?.userId).toBe(
                    member.id
                );
            });

            it('인증 전 계정은 같은 주소의 비회원 행을 가져오지 못한다', async () => {
                const member = await createMember({ verified: false });
                const { id } = await subscribe({ email: member.email });

                await expect(
                    subscribers.findForMember(member.id)
                ).resolves.toBeNull();
                expect((await subscribers.findById(id))?.userId).toBeNull();
            });

            it('다른 주소의 행은 가져오지 않는다', async () => {
                const member = await createMember();
                await client`DELETE FROM mail_alert_subscribers WHERE user_id = ${member.id}`;
                const { id } = await subscribe();

                await expect(
                    subscribers.findForMember(member.id)
                ).resolves.toBeNull();
                expect((await subscribers.findById(id))?.userId).toBeNull();
            });

            it('다른 회원에게 이미 연결된 행은 가져오지 않는다', async () => {
                const owner = await createMember();
                const { id } = await subscribe({ email: owner.email });
                const other = await createMember();

                await expect(
                    subscribers.findForMember(other.id)
                ).resolves.toBeNull();
                expect((await subscribers.findById(id))?.userId).toBe(owner.id);
            });
        });

        describe('addTopic', () => {
            it('상한까지 담고, 넘으면 limit_reached이며, 이미 담은 항목은 상한과 무관하게 exists다', async () => {
                const { id } = await subscribe();
                const outcomes = await ['a', 'b', 'c'].reduce<
                    Promise<string[]>
                >(
                    async (previous, key) => [
                        ...(await previous),
                        await subscribers.addTopic(id, signalTopic(key), 3),
                    ],
                    Promise.resolve([])
                );

                expect(outcomes).toEqual(['added', 'added', 'added']);
                await expect(
                    subscribers.addTopic(id, signalTopic('d'), 3)
                ).resolves.toBe('limit_reached');
                await expect(
                    subscribers.addTopic(id, signalTopic('a'), 3)
                ).resolves.toBe('exists');
                expect(await subscribers.listTopics(id)).toHaveLength(3);
            });

            it('같은 key라도 종류가 다르면 다른 항목이다', async () => {
                const { id } = await subscribe();
                await subscribers.addTopic(id, symbolTopic('us'), 5);
                await expect(
                    subscribers.addTopic(
                        id,
                        { kind: 'fear_greed', key: 'us' },
                        5
                    )
                ).resolves.toBe('added');
            });

            it('삭제된 구독자에는 subscriber_missing이다', async () => {
                const { id } = await subscribe();
                await subscribers.deleteById(id);
                await expect(
                    subscribers.addTopic(id, signalTopic('a'), 5)
                ).resolves.toBe('subscriber_missing');
            });

            it('같은 구독자에 동시에 추가해도 상한을 넘지 않는다', async () => {
                const max = 5;
                const { id } = await subscribe();
                await ['p0', 'p1', 'p2'].reduce(
                    (previous, key) =>
                        previous.then(() =>
                            subscribers
                                .addTopic(id, symbolTopic(key), max)
                                .then(() => {})
                        ),
                    Promise.resolve()
                );

                const outcomes = await Promise.all(
                    Array.from({ length: 8 }, (_, index) =>
                        subscribers.addTopic(id, symbolTopic(`c${index}`), max)
                    )
                );

                expect(outcomes.filter(o => o === 'added')).toHaveLength(2);
                expect(
                    outcomes.filter(o => o === 'limit_reached')
                ).toHaveLength(6);
                expect(await subscribers.listTopics(id)).toHaveLength(max);
            });

            it('같은 항목을 동시에 추가하면 한 번만 담긴다', async () => {
                const { id } = await subscribe();
                const outcomes = await Promise.all(
                    Array.from({ length: 6 }, () =>
                        subscribers.addTopic(
                            id,
                            signalTopic('golden_cross'),
                            30
                        )
                    )
                );

                expect(outcomes.filter(o => o === 'added')).toHaveLength(1);
                expect(outcomes.filter(o => o === 'exists')).toHaveLength(5);
            });
        });

        describe('removeTopic', () => {
            it('마지막 항목을 지우면 구독자도 지운다', async () => {
                const { id } = await subscribe();
                await subscribers.addTopic(id, signalTopic('a'), 30);

                await expect(
                    subscribers.removeTopic(id, signalTopic('a'))
                ).resolves.toEqual({ deleted: true, subscriberDeleted: true });
                expect(await subscribers.findById(id)).toBeNull();
            });

            it('항목이 남아 있으면 구독자를 지키고, 보유·관심종목 함께 받기가 켜져 있으면 마지막 항목을 지워도 지킨다', async () => {
                const kept = await subscribe();
                await subscribers.addTopic(kept.id, signalTopic('a'), 30);
                await subscribers.addTopic(kept.id, signalTopic('b'), 30);
                await expect(
                    subscribers.removeTopic(kept.id, signalTopic('a'))
                ).resolves.toEqual({ deleted: true, subscriberDeleted: false });

                await subscribers.setIncludePortfolio(kept.id, true);
                await expect(
                    subscribers.removeTopic(kept.id, signalTopic('b'))
                ).resolves.toEqual({ deleted: true, subscriberDeleted: false });
                expect(await subscribers.findById(kept.id)).not.toBeNull();
                expect(await subscribers.listTopics(kept.id)).toEqual([]);
            });

            it('담지 않은 항목을 지우려 하면 아무것도 바꾸지 않는다', async () => {
                const { id } = await subscribe();
                await subscribers.addTopic(id, signalTopic('a'), 30);

                await expect(
                    subscribers.removeTopic(id, signalTopic('zzz'))
                ).resolves.toEqual({
                    deleted: false,
                    subscriberDeleted: false,
                });
                expect(await subscribers.listTopics(id)).toHaveLength(1);
            });

            it('없는 구독자는 아무것도 지우지 않는다', async () => {
                await expect(
                    subscribers.removeTopic(
                        '00000000-0000-4000-8000-000000000000',
                        signalTopic('a')
                    )
                ).resolves.toEqual({
                    deleted: false,
                    subscriberDeleted: false,
                });
            });
        });

        describe('setIncludePortfolio', () => {
            it('끄면서 받을 항목이 없으면 구독자를 지우고, 항목이 있으면 지킨다', async () => {
                const empty = await subscribe();
                await subscribers.setIncludePortfolio(empty.id, true);
                expect(
                    (await subscribers.findById(empty.id))?.includePortfolio
                ).toBe(true);
                await expect(
                    subscribers.setIncludePortfolio(empty.id, false)
                ).resolves.toEqual({ found: true, subscriberDeleted: true });
                expect(await subscribers.findById(empty.id)).toBeNull();

                const withTopic = await subscribe();
                await subscribers.addTopic(withTopic.id, signalTopic('a'), 30);
                await subscribers.setIncludePortfolio(withTopic.id, true);
                await expect(
                    subscribers.setIncludePortfolio(withTopic.id, false)
                ).resolves.toEqual({ found: true, subscriberDeleted: false });
            });

            it('없는 구독자는 found=false다', async () => {
                await expect(
                    subscribers.setIncludePortfolio(
                        '00000000-0000-4000-8000-000000000000',
                        true
                    )
                ).resolves.toEqual({ found: false, subscriberDeleted: false });
            });
        });

        describe('findAllForDelivery', () => {
            it('항목이 있거나 함께 받기가 켜진 구독자만, 항목을 모아서 돌려준다', async () => {
                const withTopics = await subscribe();
                await subscribers.addTopic(
                    withTopics.id,
                    symbolTopic('AAPL'),
                    30
                );
                await subscribers.addTopic(
                    withTopics.id,
                    { kind: 'fear_greed', key: 'us' },
                    30
                );
                const portfolioOnly = await subscribe();
                await subscribers.setIncludePortfolio(portfolioOnly.id, true);
                const nothing = await subscribe();

                const targets = await subscribers.findAllForDelivery();
                const byId = new Map(
                    targets.map(target => [target.id, target])
                );

                expect(byId.has(nothing.id)).toBe(false);
                expect(byId.get(portfolioOnly.id)).toMatchObject({
                    email: portfolioOnly.email,
                    includePortfolio: true,
                    topics: [],
                });
                const target = byId.get(withTopics.id);
                expect(target?.includePortfolio).toBe(false);
                expect(target?.locale).toBe('ko');
                expect(
                    [...(target?.topics ?? [])].sort((a, b) =>
                        a.kind.localeCompare(b.kind)
                    )
                ).toEqual([
                    { kind: 'fear_greed', key: 'us' },
                    { kind: 'symbol', key: 'AAPL' },
                ]);
            });
        });

        describe('삭제와 연쇄', () => {
            it('구독자를 지우면 항목과 발송 기록도 지워진다', async () => {
                const { id } = await subscribe();
                await subscribers.addTopic(id, signalTopic('a'), 30);
                await deliveries.claim(id, '2026-11-24');

                await expect(subscribers.deleteById(id)).resolves.toBe(true);
                await expect(subscribers.deleteById(id)).resolves.toBe(false);

                expect(
                    await countRows(
                        'mail_alert_topics',
                        `subscriber_id = '${id}'`
                    )
                ).toBe(0);
                expect(
                    await countRows(
                        'mail_alert_deliveries',
                        `subscriber_id = '${id}'`
                    )
                ).toBe(0);
            });

            it('회원 행을 지우면 연결된 구독자가 연쇄로 지워진다', async () => {
                const member = await createMember();
                const { id } = await subscribe({ email: member.email });
                const guest = await subscribe();

                await client`DELETE FROM users WHERE id = ${member.id}`;

                expect(await subscribers.findById(id)).toBeNull();
                expect(await subscribers.findById(guest.id)).not.toBeNull();
            });

            it('deleteForAccount는 연결된 행과, 인증된 본인 주소의 연결 안 된 행을 지우고 남의 행은 건드리지 않는다', async () => {
                const member = await createMember({ verified: false });
                const unlinked = await subscribe({ email: member.email });
                await client`UPDATE users SET email_verified = true WHERE id = ${member.id}`;
                const secondAddress = await subscribe();
                const bystander = await subscribe();
                await client`UPDATE mail_alert_subscribers SET user_id = ${member.id} WHERE id = ${secondAddress.id}`;

                await expect(
                    subscribers.deleteForAccount(member.id)
                ).resolves.toBe(2);

                expect(await subscribers.findById(secondAddress.id)).toBeNull();
                expect(await subscribers.findById(unlinked.id)).toBeNull();
                expect(await subscribers.findById(bystander.id)).not.toBeNull();
            });

            it('deleteForAccount: 인증 전 계정은 같은 주소의 비회원 행을 지우지 못한다', async () => {
                const member = await createMember({ verified: false });
                const guest = await subscribe({ email: member.email });

                await expect(
                    subscribers.deleteForAccount(member.id)
                ).resolves.toBe(0);

                expect(await subscribers.findById(guest.id)).not.toBeNull();
            });

            it('deleteForAccount는 지울 것이 없으면 0이다', async () => {
                const member = await createMember();
                await client`DELETE FROM mail_alert_subscribers WHERE user_id = ${member.id}`;
                await expect(
                    subscribers.deleteForAccount(member.id)
                ).resolves.toBe(0);
            });
        });

        describe('CHECK', () => {
            it('허용 값 밖의 동의 화면·항목 종류·발송 상태를 거부한다', async () => {
                await expect(
                    client`INSERT INTO mail_alert_subscribers (email, consent_source)
                       VALUES (${nextEmail()}, 'other')`
                ).rejects.toThrow(
                    /mail_alert_subscribers_consent_source_check/
                );

                const { id } = await subscribe();
                await expect(
                    client`INSERT INTO mail_alert_topics (subscriber_id, kind, key)
                       VALUES (${id}, 'news', 'x')`
                ).rejects.toThrow(/mail_alert_topics_kind_check/);
                await expect(
                    client`INSERT INTO mail_alert_deliveries (subscriber_id, alert_date, status)
                       VALUES (${id}, '2026-11-24', 'skipped')`
                ).rejects.toThrow(/mail_alert_deliveries_status_check/);
            });
        });

        describe('발송 기록', () => {
            it('같은 날을 두 번 선점하면 두 번째는 null이고, 다른 날은 선점된다', async () => {
                const { id } = await subscribe();

                const first = await deliveries.claim(id, '2026-11-24');
                const second = await deliveries.claim(id, '2026-11-24');
                const nextDay = await deliveries.claim(id, '2026-11-25');

                expect(first).not.toBeNull();
                expect(second).toBeNull();
                expect(nextDay).not.toBeNull();
            });

            it('동시에 선점해도 정확히 하나만 이긴다', async () => {
                const { id } = await subscribe();

                const results = await Promise.all(
                    Array.from({ length: 8 }, () =>
                        deliveries.claim(id, '2026-12-01')
                    )
                );

                expect(results.filter(result => result !== null)).toHaveLength(
                    1
                );
            });

            it('finish는 결과·실린 항목·오류를 기록한다', async () => {
                const { id } = await subscribe();
                const claimed = await deliveries.claim(id, '2026-11-24');

                await deliveries.finish(
                    claimed as string,
                    'failed',
                    ['s:us:NVDA:golden_cross'],
                    'boom'
                );

                const [row] = await client<
                    {
                        status: string;
                        item_keys: string[];
                        error: string | null;
                    }[]
                >`SELECT status, item_keys, error FROM mail_alert_deliveries
              WHERE id = ${claimed as string}`;
                expect(row).toEqual({
                    status: 'failed',
                    item_keys: ['s:us:NVDA:golden_cross'],
                    error: 'boom',
                });
            });

            it('recentItemKeys는 sent이고 알림 날짜가 하한 이상인 행만 구독자별로 모은다', async () => {
                const { id } = await subscribe();
                const other = await subscribe();
                const finishWith = async (
                    subscriberId: string,
                    date: string,
                    outcome: 'sent' | 'failed',
                    keys: string[]
                ) => {
                    const claimed = await deliveries.claim(subscriberId, date);
                    await deliveries.finish(
                        claimed as string,
                        outcome,
                        keys,
                        null
                    );
                };
                await finishWith(id, '2026-11-16', 'sent', ['too-old']);
                await finishWith(id, '2026-11-17', 'sent', ['edge', 'shared']);
                await finishWith(id, '2026-11-20', 'sent', [
                    'shared',
                    'recent',
                ]);
                await finishWith(id, '2026-11-21', 'failed', [
                    'never-delivered',
                ]);
                await finishWith(other.id, '2026-11-22', 'sent', ['theirs']);

                const keys = await deliveries.recentItemKeys('2026-11-17');

                expect(keys.get(id)).toEqual(
                    new Set(['edge', 'shared', 'recent'])
                );
                expect(keys.get(other.id)).toEqual(new Set(['theirs']));
            });

            it('pruneBefore는 기준일보다 이른 알림 날짜만 지운다(기준일 당일은 남긴다)', async () => {
                const { id } = await subscribe();
                await deliveries.claim(id, '2026-01-01');
                await deliveries.claim(id, '2026-01-02');
                await deliveries.claim(id, '2026-01-03');

                const deleted = await deliveries.pruneBefore('2026-01-03');

                expect(deleted).toBeGreaterThanOrEqual(2);
                expect(
                    await countRows(
                        'mail_alert_deliveries',
                        `subscriber_id = '${id}'`
                    )
                ).toBe(1);
            });
        });
    }
);
