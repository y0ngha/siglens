import { drizzle } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/shared/db/schema';
import type {
    CreatePriceAlertInput,
    PriceAlertConditionRecord,
} from '@/shared/db/types';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import {
    DrizzleMailAlertSubscriberRepository,
    DrizzlePriceAlertRepository,
} from '../api';
import { PRICE_ALERT_FIRED_RETENTION_DAYS } from '../lib/priceAlertConstants';

vi.mock('server-only', () => ({}));

/**
 * 가격대 알림 저장소의 규칙을 진짜 Postgres에서 본다(TESTING.md#TE-55): 같은 제안 id 멱등, 같은 가격 중복,
 * 구독자 행 잠금 아래의 동시 상한, 남의 알림 취소 거절(DB-12), CHECK, FK 연쇄, 발송 대상과 마지막 항목
 * 제거에서 "알림만 가진 구독자"를 지키는 WP-21 규칙 변경, 정리 경계. 모킹된 DB로는 잠금 직렬화·CHECK·연쇄
 * 삭제가 보이지 않는다. `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행은 `mailAlert.db.test.ts`와 같다.
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션 두 개(0063, 0065)를 적용한 뒤 끝나면
 * 스키마를 지운다. `users`는 FK에 필요한 열만 둔 최소 테이블이다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `price_alert_test_${process.pid}`;
const POOL_SIZE = 12;

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.replaceAll('"public".', ''));

const zone = (
    low: number,
    high: number,
    approach: 'from_above' | 'from_below' = 'from_above'
): PriceAlertConditionRecord => ({ kind: 'enter_zone', low, high, approach });
const asGuest = (subscriberId: string) =>
    ({ kind: 'guest', subscriberId }) as const;
const asMember = (userId: string) => ({ kind: 'member', userId }) as const;
const below = (level: number): PriceAlertConditionRecord => ({
    kind: 'close_below',
    level,
});

describe.skipIf(!URL)(
    '가격대 알림 저장소가 진짜 Postgres에서 규칙대로 동작한다',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: POOL_SIZE,
            connection: { search_path: SCHEMA },
        });
        const db = drizzle(client, { schema });
        const subscribers = new DrizzleMailAlertSubscriberRepository(db);
        const alerts = new DrizzlePriceAlertRepository(db);
        const counter = { value: 0 };

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

        /** DB가 보는 한국 오늘 + `offsetDays`(음수 가능). 발송 날짜와 같은 시간대다. */
        async function kstDate(offsetDays: number): Promise<string> {
            const [row] = await client<{ d: string }[]>`
                SELECT to_char((now() AT TIME ZONE 'Asia/Seoul')::date + ${offsetDays}::int, 'YYYY-MM-DD') AS d`;
            return row?.d ?? '';
        }

        /** 두 시장의 기대 세션을 같은 날짜로 준다(만료 정의는 시장별 비교라 한 날짜로 양쪽을 본다). */
        const sessions = (date: string) => ({ us: date, kr: date });

        async function pruneAsOfToday() {
            const today = await kstDate(0);
            return alerts.pruneExpiredAndFired(today, sessions(today));
        }

        /** 조건이 참이 될 때까지 20ms 간격으로 확인한다. 시간 안에 안 되면 테스트를 실패시킨다. */
        async function waitUntil(
            condition: () => Promise<boolean>,
            timeoutMs = 5_000
        ): Promise<void> {
            const deadline = Date.now() + timeoutMs;
            while (!(await condition())) {
                if (Date.now() > deadline) {
                    throw new Error(`condition not met within ${timeoutMs}ms`);
                }
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }

        async function subscribe(): Promise<string> {
            counter.value += 1;
            const { id } = await subscribers.upsertVerified({
                email: `alert${counter.value}@example.com`,
                locale: 'ko',
                consentSource: 'agent_chat',
            });
            return id;
        }

        async function input(
            overrides: Partial<CreatePriceAlertInput> = {}
        ): Promise<CreatePriceAlertInput> {
            return {
                proposalId: randomUUID(),
                symbol: 'AAPL',
                market: 'us',
                condition: below(180),
                basis: 'price_level',
                analysisAt: null,
                referenceClose: 190.5,
                startsAfterSession: await kstDate(-1),
                expiresOn: await kstDate(30),
                ...overrides,
            };
        }

        async function countAlerts(subscriberId: string): Promise<number> {
            const [row] = await client<{ n: number }[]>`
                SELECT count(*)::int AS n FROM price_alerts WHERE subscriber_id = ${subscriberId}`;
            return row?.n ?? 0;
        }

        async function create(
            subscriberId: string,
            overrides: Partial<CreatePriceAlertInput> = {},
            max = 10
        ) {
            return alerts.createWithinLimit(
                asGuest(subscriberId),
                await input(overrides),
                max
            );
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
            await runInOrder(migration('0065_price_alerts.sql'));
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        describe('createWithinLimit', () => {
            it('만들고 읽으면 조건·가격이 그대로 돌아온다(구간과 단일 가격)', async () => {
                const id = await subscribe();
                const zoneProposal = randomUUID();
                const levelProposal = randomUUID();
                const analysisAt = new Date('2026-11-20T08:30:00Z');

                await create(id, {
                    proposalId: zoneProposal,
                    condition: zone(178, 181.5, 'from_below'),
                    basis: 'analysis_entry_zone',
                    analysisAt,
                });
                await create(id, {
                    proposalId: levelProposal,
                    condition: below(180.25),
                });

                const asZone = await alerts.findByProposal(
                    asGuest(id),
                    zoneProposal
                );
                expect(asZone).toMatchObject({
                    subscriberId: id,
                    symbol: 'AAPL',
                    market: 'us',
                    condition: {
                        kind: 'enter_zone',
                        low: 178,
                        high: 181.5,
                        approach: 'from_below',
                    },
                    basis: 'analysis_entry_zone',
                    referenceClose: 190.5,
                    status: 'active',
                    firedSession: null,
                    firedClose: null,
                });
                expect(asZone?.analysisAt?.toISOString()).toBe(
                    analysisAt.toISOString()
                );
                expect(
                    (await alerts.findByProposal(asGuest(id), levelProposal))
                        ?.condition
                ).toEqual({ kind: 'close_below', level: 180.25 });
            });

            it('같은 제안 id를 두 번 만들면 한 행이고 두 번째는 exists다', async () => {
                const id = await subscribe();
                const base = await input();

                const first = await alerts.createWithinLimit(
                    asGuest(id),
                    base,
                    10
                );
                const second = await alerts.createWithinLimit(
                    asGuest(id),
                    base,
                    10
                );

                expect([first, second]).toEqual(['created', 'exists']);
                expect(await countAlerts(id)).toBe(1);
            });

            it('같은 제안 id를 동시에 눌러도 한 행만 생긴다', async () => {
                const id = await subscribe();
                const base = await input();

                const outcomes = await Promise.all(
                    Array.from({ length: 6 }, () =>
                        alerts.createWithinLimit(asGuest(id), base, 10)
                    )
                );

                expect(outcomes.filter(o => o === 'created')).toHaveLength(1);
                expect(outcomes.filter(o => o === 'exists')).toHaveLength(5);
                expect(await countAlerts(id)).toBe(1);
            });

            it('같은 종목·조건·가격의 살아 있는 알림이 있으면 duplicate다', async () => {
                const id = await subscribe();
                await create(id, { condition: zone(178, 181.5) });

                const again = await create(id, { condition: zone(178, 181.5) });

                expect(again).toBe('duplicate');
                expect(await countAlerts(id)).toBe(1);
            });

            it('종목, 조건, 가격, 접근 방향이 하나라도 다르면 duplicate가 아니다', async () => {
                const id = await subscribe();
                await create(id, { condition: zone(178, 181.5) });

                const outcomes = await Promise.all([
                    create(id, { symbol: 'MSFT', condition: zone(178, 181.5) }),
                    create(id, { condition: zone(178, 182) }),
                    create(id, { condition: zone(178, 181.5, 'from_below') }),
                    create(id, { condition: below(178) }),
                ]);

                expect(outcomes).toEqual([
                    'created',
                    'created',
                    'created',
                    'created',
                ]);
            });

            it('같은 가격이 이미 알린 알림이거나 만료된 알림이면 duplicate가 아니다', async () => {
                const id = await subscribe();
                await create(id, { condition: below(150) });
                await client`UPDATE price_alerts SET status = 'fired', fired_session = ${await kstDate(-1)}, fired_close = 149, fired_at = now() WHERE subscriber_id = ${id}`;
                await create(id, {
                    condition: below(140),
                    expiresOn: await kstDate(-10),
                });

                expect(await create(id, { condition: below(150) })).toBe(
                    'created'
                );
                expect(await create(id, { condition: below(140) })).toBe(
                    'created'
                );
            });

            it('상한에 닿으면 limit_reached이고, 알리거나 만료된 알림은 세지 않는다', async () => {
                const id = await subscribe();
                await create(id, { condition: below(100) }, 2);
                await create(id, { condition: below(101) }, 2);
                expect(await create(id, { condition: below(102) }, 2)).toBe(
                    'limit_reached'
                );

                await client`UPDATE price_alerts SET status = 'fired', fired_session = ${await kstDate(-1)}, fired_close = 99, fired_at = now() WHERE subscriber_id = ${id} AND level = 100`;
                await client`UPDATE price_alerts SET expires_on = ${await kstDate(-10)} WHERE subscriber_id = ${id} AND level = 101`;

                expect(await create(id, { condition: below(102) }, 2)).toBe(
                    'created'
                );
            });

            it('동시에 만들어도 상한을 넘지 않는다(구독자 행 잠금)', async () => {
                const id = await subscribe();
                const max = 3;

                const outcomes = await Promise.all(
                    Array.from({ length: 10 }, (_, i) =>
                        create(id, { condition: below(200 + i) }, max)
                    )
                );

                expect(outcomes.filter(o => o === 'created')).toHaveLength(max);
                expect(
                    outcomes.filter(o => o === 'limit_reached')
                ).toHaveLength(10 - max);
                expect(await countAlerts(id)).toBe(max);
            });

            it('상한은 구독자마다 따로 센다', async () => {
                const first = await subscribe();
                const second = await subscribe();
                await create(first, { condition: below(100) }, 1);

                expect(await create(second, { condition: below(100) }, 1)).toBe(
                    'created'
                );
            });

            it('없는 구독자는 subscriber_missing이다', async () => {
                const outcome = await alerts.createWithinLimit(
                    asGuest(randomUUID()),
                    await input(),
                    10
                );

                expect(outcome).toBe('subscriber_missing');
            });
        });

        describe('CHECK', () => {
            async function insertRaw(
                subscriberId: string,
                columns: {
                    condition: string;
                    approach: string | null;
                    zoneLow: number | null;
                    zoneHigh: number | null;
                    level: number | null;
                    referenceClose?: number;
                }
            ): Promise<void> {
                await client`
                    INSERT INTO price_alerts
                        (subscriber_id, proposal_id, symbol, market, condition, approach, zone_low, zone_high, level,
                         basis, reference_close, starts_after_session, expires_on)
                    VALUES (${subscriberId}, ${randomUUID()}, 'AAPL', 'us', ${columns.condition}, ${columns.approach},
                         ${columns.zoneLow}, ${columns.zoneHigh}, ${columns.level}, 'price_level',
                         ${columns.referenceClose ?? 100}, '2026-11-20', '2026-12-20')`;
            }

            it('구간 알림에 approach가 없으면 거절한다', async () => {
                const id = await subscribe();
                await expect(
                    insertRaw(id, {
                        condition: 'enter_zone',
                        approach: null,
                        zoneLow: 1,
                        zoneHigh: 2,
                        level: null,
                    })
                ).rejects.toThrow(/price_alerts_shape_check/);
            });

            it('구간 알림에서 low가 high보다 크면 거절한다', async () => {
                const id = await subscribe();
                await expect(
                    insertRaw(id, {
                        condition: 'enter_zone',
                        approach: 'from_above',
                        zoneLow: 3,
                        zoneHigh: 2,
                        level: null,
                    })
                ).rejects.toThrow(/price_alerts_shape_check/);
            });

            it('low와 high가 같은 구간(단일 가격 진입)은 받는다', async () => {
                const id = await subscribe();
                await expect(
                    insertRaw(id, {
                        condition: 'enter_zone',
                        approach: 'from_above',
                        zoneLow: 2,
                        zoneHigh: 2,
                        level: null,
                    })
                ).resolves.toBeUndefined();
            });

            it.each([0, -1])('level이 %i이면 거절한다', async level => {
                const id = await subscribe();
                await expect(
                    insertRaw(id, {
                        condition: 'close_below',
                        approach: null,
                        zoneLow: null,
                        zoneHigh: null,
                        level,
                    })
                ).rejects.toThrow(/price_alerts_shape_check/);
            });

            it('구간이 0 이하이면 거절한다', async () => {
                const id = await subscribe();
                await expect(
                    insertRaw(id, {
                        condition: 'enter_zone',
                        approach: 'from_above',
                        zoneLow: 0,
                        zoneHigh: 2,
                        level: null,
                    })
                ).rejects.toThrow(/price_alerts_shape_check/);
            });

            it('단일 가격 알림에 구간 열이나 approach가 섞이면 거절한다', async () => {
                const id = await subscribe();
                await expect(
                    insertRaw(id, {
                        condition: 'close_above',
                        approach: 'from_below',
                        zoneLow: null,
                        zoneHigh: null,
                        level: 5,
                    })
                ).rejects.toThrow(/price_alerts_shape_check/);
                await expect(
                    insertRaw(id, {
                        condition: 'close_above',
                        approach: null,
                        zoneLow: 1,
                        zoneHigh: null,
                        level: 5,
                    })
                ).rejects.toThrow(/price_alerts_shape_check/);
            });

            it('기준 종가가 0 이하이면 거절한다', async () => {
                const id = await subscribe();
                await expect(
                    insertRaw(id, {
                        condition: 'close_below',
                        approach: null,
                        zoneLow: null,
                        zoneHigh: null,
                        level: 5,
                        referenceClose: 0,
                    })
                ).rejects.toThrow(/price_alerts_reference_close_check/);
            });

            it('시장·기준·상태가 허용 값이 아니면 거절한다', async () => {
                const id = await subscribe();
                const row = (column: string, value: string) =>
                    client.unsafe(
                        `INSERT INTO price_alerts (subscriber_id, proposal_id, symbol, market, condition, level, basis, reference_close, starts_after_session, expires_on${column === 'status' ? ', status' : ''})
                         VALUES ('${id}', '${randomUUID()}', 'AAPL', '${column === 'market' ? value : 'us'}', 'close_below', 5, '${column === 'basis' ? value : 'price_level'}', 1, '2026-11-20', '2026-12-20'${column === 'status' ? `, '${value}'` : ''})`
                    );
                await expect(row('market', 'jp')).rejects.toThrow(
                    /price_alerts_market_check/
                );
                await expect(row('basis', 'guess')).rejects.toThrow(
                    /price_alerts_basis_check/
                );
                await expect(row('status', 'done')).rejects.toThrow(
                    /price_alerts_(status|fired_state)_check/
                );
            });

            it('구독자 신청 화면에 agent_chat을 받는다', async () => {
                const id = await subscribe();
                const [row] = await client<{ consent_source: string }[]>`
                    SELECT consent_source FROM mail_alert_subscribers WHERE id = ${id}`;
                expect(row?.consent_source).toBe('agent_chat');
            });
        });

        /** 인증된 회원과 그 주소로 연결된 구독자 행(회원 소유). */
        async function subscribeMember(): Promise<{
            userId: string;
            id: string;
        }> {
            counter.value += 1;
            const email = `member${counter.value}@example.com`;
            const [user] = await client<{ id: string }[]>`
                INSERT INTO users (email, email_verified) VALUES (${email}, true) RETURNING id`;
            const { id } = await subscribers.upsertVerified({
                email,
                locale: 'ko',
                consentSource: 'agent_chat',
            });
            return { userId: user?.id ?? '', id };
        }

        describe('removeSubscriberIfNothingToReceive', () => {
            async function subscriberExists(id: string): Promise<boolean> {
                const rows =
                    await client`SELECT 1 FROM mail_alert_subscribers WHERE id = ${id}`;
                return rows.length > 0;
            }

            it('받을 것이 없으면(항목 0, 스위치 꺼짐, 살아 있는 알림 0) 구독자를 지운다', async () => {
                const id = await subscribe();

                expect(
                    await alerts.removeSubscriberIfNothingToReceive(id)
                ).toBe(true);
                expect(await subscriberExists(id)).toBe(false);
            });

            it('살아 있는 알림이 남아 있으면 지우지 않는다', async () => {
                const id = await subscribe();
                await create(id);

                expect(
                    await alerts.removeSubscriberIfNothingToReceive(id)
                ).toBe(false);
                expect(await subscriberExists(id)).toBe(true);
            });

            it('항목이 남아 있으면 지우지 않는다', async () => {
                const id = await subscribe();
                await subscribers.addTopic(
                    asGuest(id),
                    { kind: 'signal', key: 'golden_cross' },
                    30
                );

                expect(
                    await alerts.removeSubscriberIfNothingToReceive(id)
                ).toBe(false);
                expect(await subscriberExists(id)).toBe(true);
            });

            it('없는 구독자는 false다', async () => {
                expect(
                    await alerts.removeSubscriberIfNothingToReceive(
                        randomUUID()
                    )
                ).toBe(false);
            });
        });

        describe('cancel', () => {
            it('자기 알림은 지우고 deleted를 돌려준다(다른 알림이 남으면 구독자도 남는다)', async () => {
                const id = await subscribe();
                const proposalId = randomUUID();
                await create(id, { proposalId });
                await create(id, { condition: below(150) });
                const stored = await alerts.findByProposal(
                    asGuest(id),
                    proposalId
                );

                expect(
                    await alerts.cancel(asGuest(id), stored?.id ?? '')
                ).toEqual({ deleted: true, subscriberDeleted: false });
                expect(await countAlerts(id)).toBe(1);
            });

            it('알림만 가진 구독자가 마지막 알림을 지우면 구독자도 지운다', async () => {
                const id = await subscribe();
                const proposalId = randomUUID();
                await create(id, { proposalId });
                const stored = await alerts.findByProposal(
                    asGuest(id),
                    proposalId
                );

                const outcome = await alerts.cancel(
                    asGuest(id),
                    stored?.id ?? ''
                );

                expect(outcome).toEqual({
                    deleted: true,
                    subscriberDeleted: true,
                });
                expect(await subscribers.findByOwner(asGuest(id))).toBeNull();
            });

            it('항목이 남은 구독자는 마지막 알림을 지워도 남는다', async () => {
                const id = await subscribe();
                await subscribers.addTopic(
                    asGuest(id),
                    { kind: 'signal', key: 'golden_cross' },
                    30
                );
                const proposalId = randomUUID();
                await create(id, { proposalId });
                const stored = await alerts.findByProposal(
                    asGuest(id),
                    proposalId
                );

                expect(
                    await alerts.cancel(asGuest(id), stored?.id ?? '')
                ).toEqual({ deleted: true, subscriberDeleted: false });
                expect((await subscribers.findByOwner(asGuest(id)))?.id).toBe(
                    id
                );
            });

            it('다른 구독자의 알림 id는 아무것도 지우지 않는다(DB-12)', async () => {
                const owner = await subscribe();
                const other = await subscribe();
                const proposalId = randomUUID();
                await create(owner, { proposalId });
                const stored = await alerts.findByProposal(
                    asGuest(owner),
                    proposalId
                );

                expect(
                    await alerts.cancel(asGuest(other), stored?.id ?? '')
                ).toEqual({ deleted: false, subscriberDeleted: false });
                expect(await countAlerts(owner)).toBe(1);
            });

            it('없는 id는 아무것도 지우지 않는다', async () => {
                const id = await subscribe();
                await create(id, { condition: below(150) });

                expect(await alerts.cancel(asGuest(id), randomUUID())).toEqual({
                    deleted: false,
                    subscriberDeleted: false,
                });
                expect((await subscribers.findByOwner(asGuest(id)))?.id).toBe(
                    id
                );
            });
        });

        describe('소유자 (DB-12)', () => {
            it('비회원 소유자는 회원에게 연결된 구독자의 알림을 만들거나 읽거나 지울 수 없다', async () => {
                const member = await subscribeMember();
                const proposalId = randomUUID();
                await alerts.createWithinLimit(
                    asMember(member.userId),
                    await input({ proposalId }),
                    10
                );
                const stored = await alerts.findByProposal(
                    asMember(member.userId),
                    proposalId
                );

                expect(
                    await alerts.createWithinLimit(
                        asGuest(member.id),
                        await input(),
                        10
                    )
                ).toBe('subscriber_missing');
                expect(
                    await alerts.listForSubscriber(asGuest(member.id))
                ).toEqual([]);
                expect(
                    await alerts.findByProposal(asGuest(member.id), proposalId)
                ).toBeNull();
                expect(await alerts.countActive(asGuest(member.id))).toBe(0);
                expect(
                    await alerts.cancel(asGuest(member.id), stored?.id ?? '')
                ).toEqual({ deleted: false, subscriberDeleted: false });
                expect(await countAlerts(member.id)).toBe(1);
            });

            it('회원은 자기 구독자의 알림만 만들고 읽고 지운다', async () => {
                const mine = await subscribeMember();
                const theirs = await subscribeMember();
                const proposalId = randomUUID();
                await alerts.createWithinLimit(
                    asMember(mine.userId),
                    await input({ proposalId }),
                    10
                );

                expect(await alerts.countActive(asMember(theirs.userId))).toBe(
                    0
                );
                expect(await countAlerts(theirs.id)).toBe(0);
                const stored = await alerts.findByProposal(
                    asMember(mine.userId),
                    proposalId
                );
                expect(stored?.subscriberId).toBe(mine.id);
                expect(
                    await alerts.cancel(
                        asMember(theirs.userId),
                        stored?.id ?? ''
                    )
                ).toEqual({ deleted: false, subscriberDeleted: false });
                expect(
                    await alerts.cancel(asMember(mine.userId), stored?.id ?? '')
                ).toEqual({ deleted: true, subscriberDeleted: true });
            });

            it('메일 링크 소유자는 비회원·회원 행 모두 id로 가리킨다', async () => {
                const member = await subscribeMember();
                await alerts.createWithinLimit(
                    { kind: 'link', subscriberId: member.id },
                    await input(),
                    10
                );

                expect(
                    await alerts.countActive({
                        kind: 'link',
                        subscriberId: member.id,
                    })
                ).toBe(1);
            });
        });

        describe('읽기', () => {
            it('다른 구독자의 알림은 목록·제안 조회·개수에 나타나지 않는다', async () => {
                const owner = await subscribe();
                const other = await subscribe();
                const proposalId = randomUUID();
                await create(owner, { proposalId });

                expect(await alerts.listForSubscriber(asGuest(other))).toEqual(
                    []
                );
                expect(
                    await alerts.findByProposal(asGuest(other), proposalId)
                ).toBe(null);
                expect(await alerts.countActive(asGuest(other))).toBe(0);
                expect(await alerts.countActive(asGuest(owner))).toBe(1);
            });

            it('목록은 알린 알림과 진행 중 알림을 만든 순서로 모두 준다', async () => {
                const id = await subscribe();
                await create(id, { condition: below(100) });
                await create(id, { condition: below(101) });
                await client`UPDATE price_alerts SET status = 'fired', fired_session = ${await kstDate(-1)}, fired_close = 99.5, fired_at = now() WHERE subscriber_id = ${id} AND level = 100`;

                const list = await alerts.listForSubscriber(asGuest(id));

                expect(list.map(a => [a.condition, a.status])).toEqual([
                    [{ kind: 'close_below', level: 100 }, 'fired'],
                    [{ kind: 'close_below', level: 101 }, 'active'],
                ]);
                expect(list[0]?.firedClose).toBe(99.5);
                expect(await alerts.countActive(asGuest(id))).toBe(1);
            });
        });

        describe('listActiveForDelivery', () => {
            it('만료일 당일은 포함하고 다음 날부터 빠지며, 구독자별로 묶는다', async () => {
                const first = await subscribe();
                const second = await subscribe();
                const today = await kstDate(0);
                await create(first, {
                    condition: below(100),
                    expiresOn: today,
                });
                await create(first, {
                    condition: below(101),
                    expiresOn: await kstDate(-1),
                });
                await create(second, { condition: below(102) });

                const byAlertDate = await alerts.listActiveForDelivery(
                    sessions(today)
                );

                expect(byAlertDate.get(first)?.map(a => a.condition)).toEqual([
                    { kind: 'close_below', level: 100 },
                ]);
                expect(byAlertDate.get(second)).toHaveLength(1);
                const tomorrow = await kstDate(1);
                const next = await alerts.listActiveForDelivery(
                    sessions(tomorrow)
                );
                expect(next.get(first)).toBeUndefined();
            });

            it('알린 알림은 판정 대상이 아니다', async () => {
                const id = await subscribe();
                await create(id, { condition: below(100) });
                await client`UPDATE price_alerts SET status = 'fired', fired_session = ${await kstDate(-1)}, fired_close = 99, fired_at = now() WHERE subscriber_id = ${id}`;

                const byAlertDate = await alerts.listActiveForDelivery(
                    sessions(await kstDate(0))
                );

                expect(byAlertDate.get(id)).toBeUndefined();
            });
        });

        describe('pruneExpiredAndFired', () => {
            it('만료일 당일은 남기고 다음 날 지우며, 알린 알림은 보존 기간 경계까지 남긴다', async () => {
                const id = await subscribe();
                const today = await kstDate(0);
                await create(id, {
                    condition: below(100),
                    expiresOn: today,
                });
                await create(id, {
                    condition: below(101),
                    expiresOn: await kstDate(-1),
                });
                await create(id, { condition: below(102) });
                await create(id, { condition: below(103) });
                await create(id, { condition: below(104) });
                const retention = PRICE_ALERT_FIRED_RETENTION_DAYS;
                // 103: 보존 기간 정확히 N일 전에 알림(남는다), 104: N+1일 전(지워진다).
                await client`UPDATE price_alerts SET status = 'fired', fired_session = ${await kstDate(-retention)}, fired_close = 1, fired_at = (((now() AT TIME ZONE 'Asia/Seoul')::date - ${retention}::int)::timestamp AT TIME ZONE 'Asia/Seoul') + interval '7 hours' WHERE subscriber_id = ${id} AND level = 103`;
                await client`UPDATE price_alerts SET status = 'fired', fired_session = ${await kstDate(-retention - 1)}, fired_close = 1, fired_at = (((now() AT TIME ZONE 'Asia/Seoul')::date - ${retention + 1}::int)::timestamp AT TIME ZONE 'Asia/Seoul') + interval '7 hours' WHERE subscriber_id = ${id} AND level = 104`;

                const result = await alerts.pruneExpiredAndFired(
                    today,
                    sessions(today)
                );

                // 시스템 전체를 정리하므로 다른 테스트가 남긴 만료 행도 센다 — 이 구독자의 결과는 남은 행으로 본다.
                expect(result.alertsDeleted).toBeGreaterThanOrEqual(2);
                const left = await client<{ level: string }[]>`
                    SELECT level::text FROM price_alerts WHERE subscriber_id = ${id} ORDER BY level`;
                expect(left.map(r => Number(r.level))).toEqual([100, 102, 103]);
            });
        });

        describe('pruneExpiredAndFired 구독자 정리', () => {
            async function expire(
                id: string,
                overrides: Partial<CreatePriceAlertInput> = {}
            ) {
                await create(id, {
                    expiresOn: await kstDate(-1),
                    ...overrides,
                });
            }

            it('알림이 모두 만료돼 받을 것이 없어진 구독자는 같은 실행에서 지운다', async () => {
                const id = await subscribe();
                await expire(id, { condition: below(100) });
                await expire(id, { condition: below(101) });

                const result = await pruneAsOfToday();

                expect(result.subscribersDeleted).toBeGreaterThanOrEqual(1);
                expect(await subscribers.findByOwner(asGuest(id))).toBeNull();
            });

            it('항목이 있는 구독자는 알림을 잃어도 남는다', async () => {
                const id = await subscribe();
                await subscribers.addTopic(
                    asGuest(id),
                    { kind: 'signal', key: 'golden_cross' },
                    30
                );
                await expire(id, { condition: below(100) });

                await pruneAsOfToday();

                expect((await subscribers.findByOwner(asGuest(id)))?.id).toBe(
                    id
                );
                expect(await countAlerts(id)).toBe(0);
            });

            it('살아 있는 알림이 남은 구독자는 만료 알림만 지우고 남는다', async () => {
                const id = await subscribe();
                await expire(id, { condition: below(100) });
                await create(id, { condition: below(101) });

                await pruneAsOfToday();

                expect((await subscribers.findByOwner(asGuest(id)))?.id).toBe(
                    id
                );
                expect(await countAlerts(id)).toBe(1);
            });

            it('구독자 행을 쥔 사용자 경로(알림 삭제)와 동시에 돌아도 교착 없이 끝난다(잠금 순서: 구독자 먼저)', async () => {
                const id = await subscribe();
                await expire(id, { condition: below(100) });
                const [row] = await client<{ id: string }[]>`
                    SELECT id FROM price_alerts WHERE subscriber_id = ${id}`;
                const alertId = row?.id ?? '';
                const lockedSignal = Promise.withResolvers<number>();
                const release = Promise.withResolvers<void>();

                // 사용자 경로(cancel)와 같은 순서: 구독자 행을 잠그고 → 알림을 지운다.
                const holder = client.begin(async tx => {
                    await tx`SELECT id FROM mail_alert_subscribers WHERE id = ${id} FOR NO KEY UPDATE`;
                    const [backend] = await tx<{ pid: number }[]>`
                        SELECT pg_backend_pid() AS pid`;
                    lockedSignal.resolve(backend?.pid ?? 0);
                    await release.promise;
                    await tx`DELETE FROM price_alerts WHERE id = ${alertId} AND subscriber_id = ${id}`;
                });
                const holderPid = await lockedSignal.promise;
                const prune = pruneAsOfToday();
                // 끝난 시각은 성공·실패 모두에서 기록하고, 실패(40P01)가 처리되지 않은 거부로 남아 단언을
                // 가리지 않게 두 약속 모두에 처리기를 미리 붙인다.
                const finishedAt = new Map<string, number>();
                const track = (name: string, run: Promise<unknown>) =>
                    run.then(
                        () => finishedAt.set(name, performance.now()),
                        () => finishedAt.set(name, performance.now())
                    );
                const tracked = [
                    track('holder', holder),
                    track('prune', prune),
                ];

                try {
                    // 정리가 사용자 경로의 잠금 앞에서 실제로 막힐 때까지 기다린다(고정 대기 없이 관찰).
                    await waitUntil(async () => {
                        const [blocked] = await client<{ n: number }[]>`
                            SELECT count(*)::int AS n FROM pg_stat_activity
                            WHERE ${holderPid} = ANY(pg_blocking_pids(pid))`;
                        return (blocked?.n ?? 0) > 0;
                    });
                    expect(finishedAt.has('prune')).toBe(false);
                } finally {
                    // 기다림이 시간 초과로 끝나도 사용자 경로 트랜잭션을 열어 두지 않는다.
                    release.resolve();
                }

                // 알림부터 지우는 순서였다면 서로의 행을 기다려 40P01로 한쪽이 죽는다.
                const settled = await Promise.allSettled([holder, prune]);
                await Promise.all(tracked);

                expect(settled.map(result => result.status)).toEqual([
                    'fulfilled',
                    'fulfilled',
                ]);
                // 사용자 경로가 먼저 끝나야 정리가 이어 간다.
                expect(finishedAt.get('holder')).toBeLessThan(
                    finishedAt.get('prune') ?? Number.NEGATIVE_INFINITY
                );
                expect(await countAlerts(id)).toBe(0);
                expect(await subscribers.findByOwner(asGuest(id))).toBeNull();
            });

            it('이번 정리에서 알림을 잃지 않은 구독자(막 확인을 마치고 항목을 담기 전)는 건드리지 않는다', async () => {
                const fresh = await subscribe();
                const other = await subscribe();
                await expire(other, { condition: below(100) });

                await pruneAsOfToday();

                expect(
                    (await subscribers.findByOwner(asGuest(fresh)))?.id
                ).toBe(fresh);
            });

            it('보유 종목 스위치가 켜진 회원은 알림을 잃어도 남는다', async () => {
                const member = await subscribeMember();
                await subscribers.setIncludePortfolio(
                    asMember(member.userId),
                    true
                );
                await alerts.createWithinLimit(
                    asMember(member.userId),
                    await input({ expiresOn: await kstDate(-1) }),
                    10
                );

                await pruneAsOfToday();

                expect(
                    (await subscribers.findByOwner(asMember(member.userId)))?.id
                ).toBe(member.id);
            });
        });

        describe('유효하지 않은 값', () => {
            it.each([
                ['NaN 가격', below(Number.NaN)],
                ['Infinity 가격', below(Number.POSITIVE_INFINITY)],
                ['0 가격', below(0)],
                ['음수 가격', below(-5)],
                ['NaN 구간', zone(Number.NaN, 10)],
                ['low가 high보다 큰 구간', zone(12, 10)],
            ])(
                '%s는 DB 오류가 아니라 invalid 결과로 거절한다',
                async (_n, condition) => {
                    const id = await subscribe();

                    expect(await create(id, { condition })).toBe('invalid');
                    expect(await countAlerts(id)).toBe(0);
                }
            );

            it('기준 종가가 유한한 양수가 아니면 invalid다', async () => {
                const id = await subscribe();

                expect(await create(id, { referenceClose: Number.NaN })).toBe(
                    'invalid'
                );
                expect(await create(id, { referenceClose: 0 })).toBe('invalid');
            });

            it('DB도 NaN을 CHECK로 거절한다', async () => {
                const id = await subscribe();
                await expect(
                    client.unsafe(
                        `INSERT INTO price_alerts (subscriber_id, proposal_id, symbol, market, condition, level, basis, reference_close, starts_after_session, expires_on)
                         VALUES ('${id}', '${randomUUID()}', 'AAPL', 'us', 'close_below', 'NaN', 'price_level', 1, '2026-11-20', '2026-12-20')`
                    )
                ).rejects.toThrow(/price_alerts_finite_check/);
                await expect(
                    client.unsafe(
                        `INSERT INTO price_alerts (subscriber_id, proposal_id, symbol, market, condition, level, basis, reference_close, starts_after_session, expires_on)
                         VALUES ('${id}', '${randomUUID()}', 'AAPL', 'us', 'close_below', 5, 'price_level', 'NaN', '2026-11-20', '2026-12-20')`
                    )
                ).rejects.toThrow(/price_alerts_finite_check/);
            });
        });

        describe('상태·기준 CHECK', () => {
            async function insertState(columns: string): Promise<void> {
                const id = await subscribe();
                await client.unsafe(
                    `INSERT INTO price_alerts (subscriber_id, proposal_id, symbol, market, condition, level, basis, reference_close, starts_after_session, expires_on, ${columns.split('|')[0]})
                     VALUES ('${id}', '${randomUUID()}', 'AAPL', 'us', 'close_below', 5, 'price_level', 1, '2026-11-20', '2026-12-20', ${columns.split('|')[1]})`
                );
            }

            it('진행 중인데 알린 흔적이 있거나, 알렸는데 값이 빠지면 거절한다', async () => {
                await expect(
                    insertState("status, fired_close|'active', 5")
                ).rejects.toThrow(/price_alerts_fired_state_check/);
                await expect(
                    insertState("status, fired_session|'fired', '2026-11-21'")
                ).rejects.toThrow(/price_alerts_fired_state_check/);
                await expect(
                    insertState(
                        "status, fired_session, fired_close, fired_at|'fired', '2026-11-21', 5, now()"
                    )
                ).resolves.toBeUndefined();
            });

            async function insertBasis(
                basis: string,
                condition: string,
                analysisAt: string | null
            ): Promise<void> {
                const id = await subscribe();
                const zoneColumns =
                    condition === 'enter_zone'
                        ? "'from_above', 1, 2, NULL"
                        : 'NULL, NULL, NULL, 5';
                await client.unsafe(
                    `INSERT INTO price_alerts (subscriber_id, proposal_id, symbol, market, condition, approach, zone_low, zone_high, level, basis, analysis_at, reference_close, starts_after_session, expires_on)
                     VALUES ('${id}', '${randomUUID()}', 'AAPL', 'us', '${condition}', ${zoneColumns}, '${basis}', ${analysisAt === null ? 'NULL' : `'${analysisAt}'`}, 1, '2026-11-20', '2026-12-20')`
                );
            }

            it('분석에서 읽은 기준은 분석 시각이 있어야 하고, 가격을 말한 알림은 없어야 한다', async () => {
                await expect(
                    insertBasis('analysis_entry_zone', 'enter_zone', null)
                ).rejects.toThrow(/price_alerts_basis_shape_check/);
                await expect(
                    insertBasis(
                        'price_level',
                        'close_below',
                        '2026-11-20T00:00:00Z'
                    )
                ).rejects.toThrow(/price_alerts_basis_shape_check/);
            });

            it('진입 구간 기준은 구간 조건과, 무효화 기준은 close_below와만 짝이다', async () => {
                await expect(
                    insertBasis(
                        'analysis_entry_zone',
                        'close_below',
                        '2026-11-20T00:00:00Z'
                    )
                ).rejects.toThrow(/price_alerts_basis_shape_check/);
                await expect(
                    insertBasis(
                        'analysis_invalidation',
                        'close_above',
                        '2026-11-20T00:00:00Z'
                    )
                ).rejects.toThrow(/price_alerts_basis_shape_check/);
                await expect(
                    insertBasis(
                        'analysis_invalidation',
                        'enter_zone',
                        '2026-11-20T00:00:00Z'
                    )
                ).rejects.toThrow(/price_alerts_basis_shape_check/);
                await expect(
                    insertBasis(
                        'analysis_entry_zone',
                        'enter_zone',
                        '2026-11-20T00:00:00Z'
                    )
                ).resolves.toBeUndefined();
                await expect(
                    insertBasis(
                        'analysis_invalidation',
                        'close_below',
                        '2026-11-20T00:00:00Z'
                    )
                ).resolves.toBeUndefined();
                await expect(
                    insertBasis('price_level', 'close_above', null)
                ).resolves.toBeUndefined();
            });
        });

        describe('연쇄 삭제', () => {
            it('구독자를 지우면 알림도 함께 사라진다', async () => {
                const id = await subscribe();
                await create(id, { condition: below(100) });
                await create(id, { condition: below(101) });

                await subscribers.deleteByOwner({
                    kind: 'guest',
                    subscriberId: id,
                });

                expect(await countAlerts(id)).toBe(0);
            });

            it('회원을 지우면 구독자와 알림이 연쇄로 사라진다', async () => {
                counter.value += 1;
                const email = `member${counter.value}@example.com`;
                const [user] = await client<{ id: string }[]>`
                    INSERT INTO users (email, email_verified) VALUES (${email}, true) RETURNING id`;
                const { id } = await subscribers.upsertVerified({
                    email,
                    locale: 'ko',
                    consentSource: 'agent_chat',
                });
                await create(id, { condition: below(100) });

                await client`DELETE FROM users WHERE id = ${user?.id ?? null}`;

                expect(await countAlerts(id)).toBe(0);
            });
        });

        describe('WP-21 규칙: 알림만 가진 구독자', () => {
            it('findAllForDelivery가 항목도 보유 스위치도 없는 가격대 알림 구독자를 돌려준다', async () => {
                const onlyAlert = await subscribe();
                const nothing = await subscribe();
                await create(onlyAlert, { condition: below(100) });

                const targets = await subscribers.findAllForDelivery();
                const ids = targets.map(t => t.id);

                expect(ids).toContain(onlyAlert);
                expect(ids).not.toContain(nothing);
                expect(targets.find(t => t.id === onlyAlert)?.topics).toEqual(
                    []
                );
            });

            it('만료됐거나 이미 알린 알림만 있으면 발송 대상이 아니다', async () => {
                const expired = await subscribe();
                const fired = await subscribe();
                await create(expired, {
                    condition: below(100),
                    expiresOn: await kstDate(-10),
                });
                await create(fired, { condition: below(100) });
                await client`UPDATE price_alerts SET status = 'fired', fired_session = ${await kstDate(-1)}, fired_close = 99, fired_at = now() WHERE subscriber_id = ${fired}`;

                const ids = (await subscribers.findAllForDelivery()).map(
                    t => t.id
                );

                expect(ids).not.toContain(expired);
                expect(ids).not.toContain(fired);
            });

            it('시장별 기대 세션을 주면 그 기준으로 만료를 판정한다(만료 세션이 기대 세션이면 대상, 기대 세션이 하루 지나면 아니다)', async () => {
                const id = await subscribe();
                const today = await kstDate(0);
                await create(id, { condition: below(100), expiresOn: today });

                const onExpiry = await subscribers.findAllForDelivery(
                    sessions(today)
                );
                const dayAfter = await subscribers.findAllForDelivery(
                    sessions(await kstDate(1))
                );

                expect(onExpiry.map(t => t.id)).toContain(id);
                expect(dayAfter.map(t => t.id)).not.toContain(id);
            });

            it('항목과 알림이 함께 있어도 구독자는 한 행이고 항목이 그대로 실린다', async () => {
                const id = await subscribe();
                await subscribers.addTopic(
                    { kind: 'guest', subscriberId: id },
                    { kind: 'signal', key: 'golden_cross' },
                    30
                );
                await create(id, { condition: below(100) });
                await create(id, { condition: below(101) });

                const targets = (await subscribers.findAllForDelivery()).filter(
                    t => t.id === id
                );

                expect(targets).toHaveLength(1);
                expect(targets[0]?.topics).toEqual([
                    { kind: 'signal', key: 'golden_cross' },
                ]);
            });

            it('마지막 항목을 지워도 살아 있는 알림이 있으면 구독자를 지우지 않는다', async () => {
                const id = await subscribe();
                const owner = { kind: 'guest', subscriberId: id } as const;
                await subscribers.addTopic(
                    owner,
                    { kind: 'signal', key: 'golden_cross' },
                    30
                );
                await create(id, { condition: below(100) });

                const outcome = await subscribers.removeTopic(owner, {
                    kind: 'signal',
                    key: 'golden_cross',
                });

                expect(outcome).toEqual({
                    deleted: true,
                    subscriberDeleted: false,
                });
                expect(await countAlerts(id)).toBe(1);
                expect((await subscribers.findByOwner(owner))?.id).toBe(id);
            });

            it('알림이 없으면 마지막 항목을 지울 때 구독자도 지운다', async () => {
                const id = await subscribe();
                const owner = { kind: 'guest', subscriberId: id } as const;
                await subscribers.addTopic(
                    owner,
                    { kind: 'signal', key: 'golden_cross' },
                    30
                );

                const outcome = await subscribers.removeTopic(owner, {
                    kind: 'signal',
                    key: 'golden_cross',
                });

                expect(outcome.subscriberDeleted).toBe(true);
                expect(await subscribers.findByOwner(owner)).toBeNull();
            });

            it('알림이 이미 만료됐거나 알렸다면 마지막 항목을 지울 때 구독자도 지운다', async () => {
                const id = await subscribe();
                const owner = { kind: 'guest', subscriberId: id } as const;
                await subscribers.addTopic(
                    owner,
                    { kind: 'signal', key: 'golden_cross' },
                    30
                );
                await create(id, {
                    condition: below(100),
                    expiresOn: await kstDate(-10),
                });
                await create(id, { condition: below(101) });
                await client`UPDATE price_alerts SET status = 'fired', fired_session = ${await kstDate(-1)}, fired_close = 99, fired_at = now() WHERE subscriber_id = ${id} AND level = 101`;

                const outcome = await subscribers.removeTopic(owner, {
                    kind: 'signal',
                    key: 'golden_cross',
                });

                expect(outcome.subscriberDeleted).toBe(true);
            });

            it('보유 종목 스위치를 꺼도 살아 있는 알림이 있으면 회원 구독자를 지우지 않는다', async () => {
                counter.value += 1;
                const email = `switch${counter.value}@example.com`;
                const [user] = await client<{ id: string }[]>`
                    INSERT INTO users (email, email_verified) VALUES (${email}, true) RETURNING id`;
                const { id } = await subscribers.upsertVerified({
                    email,
                    locale: 'ko',
                    consentSource: 'agent_chat',
                });
                const owner = {
                    kind: 'member',
                    userId: user?.id ?? '',
                } as const;
                await subscribers.setIncludePortfolio(owner, true);
                await alerts.createWithinLimit(
                    owner,
                    await input({ condition: below(100) }),
                    10
                );

                const result = await subscribers.setIncludePortfolio(
                    owner,
                    false
                );

                expect(result).toEqual({
                    found: true,
                    subscriberDeleted: false,
                });
                expect(await countAlerts(id)).toBe(1);
            });

            it('보유 종목 스위치를 꺼서 받을 것이 없어지면 구독자를 지운다', async () => {
                counter.value += 1;
                const email = `switchoff${counter.value}@example.com`;
                const [user] = await client<{ id: string }[]>`
                    INSERT INTO users (email, email_verified) VALUES (${email}, true) RETURNING id`;
                await subscribers.upsertVerified({
                    email,
                    locale: 'ko',
                    consentSource: 'settings',
                });
                const owner = {
                    kind: 'member',
                    userId: user?.id ?? '',
                } as const;
                await subscribers.setIncludePortfolio(owner, true);

                const result = await subscribers.setIncludePortfolio(
                    owner,
                    false
                );

                expect(result).toEqual({
                    found: true,
                    subscriberDeleted: true,
                });
            });
        });
    }
);
