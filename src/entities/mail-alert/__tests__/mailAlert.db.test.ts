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
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션(`0063_mail_alerts.sql`, `0065_price_alerts.sql`)을
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

        /** 인증된 회원과 그 주소로 연결된 구독자 행. 보유·관심종목 스위치는 회원 행에만 있다. */
        async function subscribeMember(): Promise<{
            userId: string;
            id: string;
        }> {
            const member = await createMember();
            const { id } = await subscribe({ email: member.email });
            return { userId: member.id, id };
        }

        /** 소유자 조건 없이 행을 그대로 읽는다 — 저장소가 소유자를 지키는지 밖에서 확인하는 용도. */
        async function findRow(id: string): Promise<{
            userId: string | null;
            consentSource: string;
            locale: string;
            includePortfolio: boolean;
        } | null> {
            const [row] = await client<
                {
                    user_id: string | null;
                    consent_source: string;
                    locale: string;
                    include_portfolio: boolean;
                }[]
            >`SELECT user_id, consent_source, locale, include_portfolio
              FROM mail_alert_subscribers WHERE id = ${id}`;
            return row === undefined
                ? null
                : {
                      userId: row.user_id,
                      consentSource: row.consent_source,
                      locale: row.locale,
                      includePortfolio: row.include_portfolio,
                  };
        }

        const asGuest = (subscriberId: string) =>
            ({ kind: 'guest', subscriberId }) as const;
        const asMember = (userId: string) =>
            ({ kind: 'member', userId }) as const;
        const asLink = (subscriberId: string) =>
            ({ kind: 'link', subscriberId }) as const;

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
            // 발송 대상 조회와 마지막 항목 제거가 price_alerts를 읽는다 — 0065가 그 테이블을 만든다.
            await runInOrder(migration('0065_price_alerts.sql'));
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
                const record = await findRow(first.id);
                expect(record?.consentSource).toBe('symbol');
                expect(record?.locale).toBe('ko');
            });

            it('그 주소를 가진 인증된 회원이 있으면 그 회원에게 연결한다', async () => {
                const member = await createMember();

                const { id } = await subscribe({ email: member.email });

                expect((await findRow(id))?.userId).toBe(member.id);
            });

            it('주소를 가진 회원이 없거나 인증 전이면 비회원 행(user_id null)이다', async () => {
                const unverified = await createMember({ verified: false });

                const stranger = await subscribe();
                const notVerified = await subscribe({
                    email: unverified.email,
                });

                expect((await findRow(stranger.id))?.userId).toBeNull();
                expect((await findRow(notVerified.id))?.userId).toBeNull();
            });

            it('user_id는 비어 있을 때만 채운다: 비회원 행은 회원이 인증된 뒤 다시 확인하면 연결되고, 한 번 연결된 행은 바뀌지 않는다', async () => {
                const member = await createMember({ verified: false });
                const { id } = await subscribe({ email: member.email });
                expect((await findRow(id))?.userId).toBeNull();

                await client`UPDATE users SET email_verified = true WHERE id = ${member.id}`;
                await subscribe({ email: member.email });
                expect((await findRow(id))?.userId).toBe(member.id);

                await client`UPDATE users SET email_verified = false WHERE id = ${member.id}`;
                await subscribe({ email: member.email });
                expect((await findRow(id))?.userId).toBe(member.id);
            });

            it('연결된 회원이 두 번째 주소를 인증하면 user_id 유니크에 걸리지 않고 새 비회원 행이 생긴다', async () => {
                const member = await createMember();
                const first = await subscribe({ email: member.email });
                const secondAddress = nextEmail();

                const second = await subscribe({ email: secondAddress });

                expect(second.id).not.toBe(first.id);
                expect((await findRow(first.id))?.userId).toBe(member.id);
                expect((await findRow(second.id))?.userId).toBeNull();
            });

            it('회원이 주소를 바꿨어도 새 주소 확인이 옛 행과 같은 user_id로 충돌하지 않는다', async () => {
                const member = await createMember();
                await subscribe({ email: member.email });
                const newAddress = nextEmail();
                await client`UPDATE users SET email = ${newAddress} WHERE id = ${member.id}`;

                const renewed = await subscribe({ email: newAddress });

                expect((await findRow(renewed.id))?.userId).toBeNull();
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
                expect((await findRow(id))?.userId).toBe(member.id);
            });

            it('인증 전 계정은 같은 주소의 비회원 행을 가져오지 못한다', async () => {
                const member = await createMember({ verified: false });
                const { id } = await subscribe({ email: member.email });

                await expect(
                    subscribers.findForMember(member.id)
                ).resolves.toBeNull();
                expect((await findRow(id))?.userId).toBeNull();
            });

            it('다른 주소의 행은 가져오지 않는다', async () => {
                const member = await createMember();
                await client`DELETE FROM mail_alert_subscribers WHERE user_id = ${member.id}`;
                const { id } = await subscribe();

                await expect(
                    subscribers.findForMember(member.id)
                ).resolves.toBeNull();
                expect((await findRow(id))?.userId).toBeNull();
            });

            it('다른 회원에게 이미 연결된 행은 가져오지 않는다', async () => {
                const owner = await createMember();
                const { id } = await subscribe({ email: owner.email });
                const other = await createMember();

                await expect(
                    subscribers.findForMember(other.id)
                ).resolves.toBeNull();
                expect((await findRow(id))?.userId).toBe(owner.id);
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
                        await subscribers.addTopic(
                            asGuest(id),
                            signalTopic(key),
                            3
                        ),
                    ],
                    Promise.resolve([])
                );

                expect(outcomes).toEqual(['added', 'added', 'added']);
                await expect(
                    subscribers.addTopic(asGuest(id), signalTopic('d'), 3)
                ).resolves.toBe('limit_reached');
                await expect(
                    subscribers.addTopic(asGuest(id), signalTopic('a'), 3)
                ).resolves.toBe('exists');
                expect(await subscribers.listTopics(asGuest(id))).toHaveLength(
                    3
                );
            });

            it('같은 key라도 종류가 다르면 다른 항목이다', async () => {
                const { id } = await subscribe();
                await subscribers.addTopic(asGuest(id), symbolTopic('us'), 5);
                await expect(
                    subscribers.addTopic(
                        asGuest(id),
                        { kind: 'fear_greed', key: 'us' },
                        5
                    )
                ).resolves.toBe('added');
            });

            it('삭제된 구독자에는 subscriber_missing이다', async () => {
                const { id } = await subscribe();
                await subscribers.deleteByOwner(asGuest(id));
                await expect(
                    subscribers.addTopic(asGuest(id), signalTopic('a'), 5)
                ).resolves.toBe('subscriber_missing');
            });

            it('같은 구독자에 동시에 추가해도 상한을 넘지 않는다', async () => {
                const max = 5;
                const { id } = await subscribe();
                await ['p0', 'p1', 'p2'].reduce(
                    (previous, key) =>
                        previous.then(() =>
                            subscribers
                                .addTopic(asGuest(id), symbolTopic(key), max)
                                .then(() => {})
                        ),
                    Promise.resolve()
                );

                const outcomes = await Promise.all(
                    Array.from({ length: 8 }, (_, index) =>
                        subscribers.addTopic(
                            asGuest(id),
                            symbolTopic(`c${index}`),
                            max
                        )
                    )
                );

                expect(outcomes.filter(o => o === 'added')).toHaveLength(2);
                expect(
                    outcomes.filter(o => o === 'limit_reached')
                ).toHaveLength(6);
                expect(await subscribers.listTopics(asGuest(id))).toHaveLength(
                    max
                );
            });

            it('같은 항목을 동시에 추가하면 한 번만 담긴다', async () => {
                const { id } = await subscribe();
                const outcomes = await Promise.all(
                    Array.from({ length: 6 }, () =>
                        subscribers.addTopic(
                            asGuest(id),
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
                await subscribers.addTopic(asGuest(id), signalTopic('a'), 30);

                await expect(
                    subscribers.removeTopic(asGuest(id), signalTopic('a'))
                ).resolves.toEqual({ deleted: true, subscriberDeleted: true });
                expect(await findRow(id)).toBeNull();
            });

            it('항목이 남아 있으면 구독자를 지키고, 보유·관심종목 함께 받기가 켜져 있으면 마지막 항목을 지워도 지킨다', async () => {
                const kept = await subscribeMember();
                const owner = asMember(kept.userId);
                await subscribers.addTopic(owner, signalTopic('a'), 30);
                await subscribers.addTopic(owner, signalTopic('b'), 30);
                await expect(
                    subscribers.removeTopic(owner, signalTopic('a'))
                ).resolves.toEqual({ deleted: true, subscriberDeleted: false });

                await subscribers.setIncludePortfolio(owner, true);
                await expect(
                    subscribers.removeTopic(owner, signalTopic('b'))
                ).resolves.toEqual({ deleted: true, subscriberDeleted: false });
                expect(await findRow(kept.id)).not.toBeNull();
                expect(await subscribers.listTopics(owner)).toEqual([]);
            });

            it('담지 않은 항목을 지우려 하면 아무것도 바꾸지 않는다', async () => {
                const { id } = await subscribe();
                await subscribers.addTopic(asGuest(id), signalTopic('a'), 30);

                await expect(
                    subscribers.removeTopic(asGuest(id), signalTopic('zzz'))
                ).resolves.toEqual({
                    deleted: false,
                    subscriberDeleted: false,
                });
                expect(await subscribers.listTopics(asGuest(id))).toHaveLength(
                    1
                );
            });

            it('없는 구독자는 아무것도 지우지 않는다', async () => {
                await expect(
                    subscribers.removeTopic(
                        asGuest('00000000-0000-4000-8000-000000000000'),
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
                const empty = await subscribeMember();
                await subscribers.setIncludePortfolio(
                    asMember(empty.userId),
                    true
                );
                expect((await findRow(empty.id))?.includePortfolio).toBe(true);
                await expect(
                    subscribers.setIncludePortfolio(
                        asMember(empty.userId),
                        false
                    )
                ).resolves.toEqual({ found: true, subscriberDeleted: true });
                expect(await findRow(empty.id)).toBeNull();

                const withTopic = await subscribeMember();
                const owner = asMember(withTopic.userId);
                await subscribers.addTopic(owner, signalTopic('a'), 30);
                await subscribers.setIncludePortfolio(owner, true);
                await expect(
                    subscribers.setIncludePortfolio(owner, false)
                ).resolves.toEqual({ found: true, subscriberDeleted: false });
            });

            it('비회원 소유자는 거절하고 아무것도 쓰지 않는다(비회원에게는 포트폴리오가 없다)', async () => {
                const guest = await subscribe();
                await subscribers.addTopic(
                    asGuest(guest.id),
                    signalTopic('a'),
                    30
                );

                await expect(
                    subscribers.setIncludePortfolio(asGuest(guest.id), true)
                ).resolves.toEqual({ found: false, subscriberDeleted: false });
                expect((await findRow(guest.id))?.includePortfolio).toBe(false);
            });

            it('행이 없는 회원은 found=false다', async () => {
                const lonely = await createMember();
                await expect(
                    subscribers.setIncludePortfolio(asMember(lonely.id), true)
                ).resolves.toEqual({ found: false, subscriberDeleted: false });
            });
        });

        describe('findAllForDelivery', () => {
            it('항목이 있거나 함께 받기가 켜진 구독자만, 항목을 모아서 돌려준다', async () => {
                const withTopics = await subscribe();
                await subscribers.addTopic(
                    asGuest(withTopics.id),
                    symbolTopic('AAPL'),
                    30
                );
                await subscribers.addTopic(
                    asGuest(withTopics.id),
                    { kind: 'fear_greed', key: 'us' },
                    30
                );
                const portfolioOnly = await subscribeMember();
                await subscribers.setIncludePortfolio(
                    asMember(portfolioOnly.userId),
                    true
                );
                const nothing = await subscribe();

                const targets = await subscribers.findAllForDelivery();
                const byId = new Map(
                    targets.map(target => [target.id, target])
                );

                expect(byId.has(nothing.id)).toBe(false);
                expect(byId.get(portfolioOnly.id)).toMatchObject({
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
                await subscribers.addTopic(asGuest(id), signalTopic('a'), 30);
                await deliveries.claim(id, '2026-11-24');

                await expect(
                    subscribers.deleteByOwner(asGuest(id))
                ).resolves.toBe(true);
                await expect(
                    subscribers.deleteByOwner(asGuest(id))
                ).resolves.toBe(false);

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

                expect(await findRow(id)).toBeNull();
                expect(await findRow(guest.id)).not.toBeNull();
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

                expect(await findRow(secondAddress.id)).toBeNull();
                expect(await findRow(unlinked.id)).toBeNull();
                expect(await findRow(bystander.id)).not.toBeNull();
            });

            it('deleteForAccount: 인증 전 계정은 같은 주소의 비회원 행을 지우지 못한다', async () => {
                const member = await createMember({ verified: false });
                const guest = await subscribe({ email: member.email });

                await expect(
                    subscribers.deleteForAccount(member.id)
                ).resolves.toBe(0);

                expect(await findRow(guest.id)).not.toBeNull();
            });

            it('deleteForAccount는 지울 것이 없으면 0이다', async () => {
                const member = await createMember();
                await client`DELETE FROM mail_alert_subscribers WHERE user_id = ${member.id}`;
                await expect(
                    subscribers.deleteForAccount(member.id)
                ).resolves.toBe(0);
            });
        });

        describe('소유자 바인딩 (DB-12)', () => {
            it('비회원 id로는 연결된(회원) 행을 읽지도 바꾸지도 지우지도 못한다', async () => {
                const member = await createMember();
                const { id } = await subscribe({ email: member.email });
                await subscribers.addTopic(
                    asMember(member.id),
                    signalTopic('a'),
                    30
                );

                expect(await subscribers.findByOwner(asGuest(id))).toBeNull();
                expect(await subscribers.listTopics(asGuest(id))).toEqual([]);
                await expect(
                    subscribers.addTopic(asGuest(id), signalTopic('b'), 30)
                ).resolves.toBe('subscriber_missing');
                await expect(
                    subscribers.removeTopic(asGuest(id), signalTopic('a'))
                ).resolves.toEqual({
                    deleted: false,
                    subscriberDeleted: false,
                });
                await expect(
                    subscribers.setIncludePortfolio(asGuest(id), true)
                ).resolves.toEqual({ found: false, subscriberDeleted: false });
                await expect(
                    subscribers.deleteByOwner(asGuest(id))
                ).resolves.toBe(false);

                expect((await findRow(id))?.includePortfolio).toBe(false);
                expect(
                    await subscribers.listTopics(asMember(member.id))
                ).toEqual([signalTopic('a')]);
            });

            it('회원은 자기 행만 가리킨다: 비회원 행과 다른 회원의 행은 id를 알아도 그대로다', async () => {
                const member = await createMember();
                const mine = await subscribe({ email: member.email });
                const other = await createMember();
                const theirs = await subscribe({ email: other.email });
                const guest = await subscribe();
                await subscribers.addTopic(
                    asGuest(guest.id),
                    signalTopic('g'),
                    30
                );
                await subscribers.addTopic(
                    asMember(other.id),
                    signalTopic('o'),
                    30
                );

                // 회원 소유자는 자기 user_id의 행만 본다.
                expect(
                    (await subscribers.findByOwner(asMember(member.id)))?.id
                ).toBe(mine.id);
                expect(
                    await subscribers.listTopics(asMember(member.id))
                ).toEqual([]);
                await expect(
                    subscribers.removeTopic(
                        asMember(member.id),
                        signalTopic('g')
                    )
                ).resolves.toEqual({
                    deleted: false,
                    subscriberDeleted: false,
                });
                await expect(
                    subscribers.removeTopic(
                        asMember(member.id),
                        signalTopic('o')
                    )
                ).resolves.toEqual({
                    deleted: false,
                    subscriberDeleted: false,
                });

                expect(await subscribers.listTopics(asGuest(guest.id))).toEqual(
                    [signalTopic('g')]
                );
                expect(
                    await subscribers.listTopics(asMember(other.id))
                ).toEqual([signalTopic('o')]);
                expect(await findRow(theirs.id)).not.toBeNull();
            });

            it('회원 소유자의 삭제는 자기 행만 지우고 다른 행은 남긴다', async () => {
                const member = await createMember();
                const mine = await subscribe({ email: member.email });
                const guest = await subscribe();

                await expect(
                    subscribers.deleteByOwner(asMember(member.id))
                ).resolves.toBe(true);

                expect(await findRow(mine.id)).toBeNull();
                expect(await findRow(guest.id)).not.toBeNull();
            });

            it('항목이 없는 회원은 addTopic이 subscriber_missing이다(남의 행에 붙지 않는다)', async () => {
                const lonely = await createMember();
                const guest = await subscribe();

                await expect(
                    subscribers.addTopic(
                        asMember(lonely.id),
                        signalTopic('a'),
                        30
                    )
                ).resolves.toBe('subscriber_missing');
                expect(await subscribers.listTopics(asGuest(guest.id))).toEqual(
                    []
                );
            });
        });

        describe('서명된 링크 소유자(link)', () => {
            it('비회원 행과 회원에게 연결된 행을 모두 id로 읽고 바꾸고 지운다', async () => {
                const guest = await subscribe();
                const member = await createMember();
                const linked = await subscribe({ email: member.email });

                await Promise.all(
                    [guest.id, linked.id].map(async id => {
                        await expect(
                            subscribers.addTopic(
                                asLink(id),
                                signalTopic('a'),
                                30
                            )
                        ).resolves.toBe('added');
                        expect(
                            (await subscribers.findByOwner(asLink(id)))?.id
                        ).toBe(id);
                        expect(
                            await subscribers.listTopics(asLink(id))
                        ).toEqual([signalTopic('a')]);
                        await expect(
                            subscribers.removeTopic(
                                asLink(id),
                                signalTopic('a')
                            )
                        ).resolves.toEqual({
                            deleted: true,
                            subscriberDeleted: true,
                        });
                    })
                );
                expect(await findRow(guest.id)).toBeNull();
                expect(await findRow(linked.id)).toBeNull();
            });

            it('다른 행은 건드리지 않고, 보유·관심종목 스위치는 바꾸지 못한다', async () => {
                const member = await createMember();
                const mine = await subscribe({ email: member.email });
                const other = await subscribe();

                await expect(
                    subscribers.setIncludePortfolio(asLink(mine.id), true)
                ).resolves.toEqual({ found: false, subscriberDeleted: false });
                expect((await findRow(mine.id))?.includePortfolio).toBe(false);
                await expect(
                    subscribers.deleteByOwner(asLink(mine.id))
                ).resolves.toBe(true);
                expect(await findRow(other.id)).not.toBeNull();
                await expect(
                    subscribers.deleteByOwner(
                        asLink('00000000-0000-4000-8000-000000000000')
                    )
                ).resolves.toBe(false);
            });
        });

        describe('linkVerifiedMember', () => {
            it('인증 전 회원의 같은 주소 행을 연결한다(주소 일치, 회원에게 행 없음)', async () => {
                const member = await createMember({ verified: false });
                const row = await subscribe({ email: member.email });
                expect((await findRow(row.id))?.userId).toBeNull();

                await expect(
                    subscribers.linkVerifiedMember(member.id, row.id)
                ).resolves.toBe(true);
                expect((await findRow(row.id))?.userId).toBe(member.id);
                await expect(
                    subscribers.deleteForAccount(member.id)
                ).resolves.toBe(1);
            });

            it('다른 주소의 행, 이미 연결된 행, 회원에게 이미 행이 있으면 연결하지 않는다', async () => {
                const member = await createMember({ verified: false });
                const stranger = await subscribe();
                await expect(
                    subscribers.linkVerifiedMember(member.id, stranger.id)
                ).resolves.toBe(false);

                const owner = await createMember();
                const ownRow = await subscribe({ email: owner.email });
                await expect(
                    subscribers.linkVerifiedMember(member.id, ownRow.id)
                ).resolves.toBe(false);

                const mine = await subscribe({ email: member.email });
                await subscribers.linkVerifiedMember(member.id, mine.id);
                const second = await subscribe();
                await expect(
                    subscribers.linkVerifiedMember(member.id, second.id)
                ).resolves.toBe(false);
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

            it('finish는 이미 sent인 기록을 늦은 실패로 덮지 않는다(DB-11)', async () => {
                const { id } = await subscribe();
                const claimed = (await deliveries.claim(
                    id,
                    '2026-11-25'
                )) as string;

                await deliveries.finish(claimed, 'sent', ['k'], null);
                await deliveries.finish(claimed, 'failed', ['k'], 'late');

                const [row] = await client<
                    { status: string; error: string | null }[]
                >`SELECT status, error FROM mail_alert_deliveries
              WHERE id = ${claimed}`;
                expect(row).toEqual({ status: 'sent', error: null });
            });

            it('recentItemKeys는 sent·pending이고 알림 날짜가 하한 이상인 행만 구독자별로 모은다', async () => {
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
                // 선점만 하고 끝나지 않은 행의 키도 센다(보낸 뒤 기록 전에 죽은 경우).
                await deliveries.claim(id, '2026-11-22', ['stuck']);

                const keys = await deliveries.recentItemKeys('2026-11-17');

                expect(keys.get(id)).toEqual(
                    new Set(['edge', 'shared', 'recent', 'stuck'])
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
