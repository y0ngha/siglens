import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
    DrizzleMailAlertDeliveryRepository,
    DrizzleMailAlertSubscriberRepository,
    DrizzlePriceAlertRepository,
} from '@/entities/mail-alert/api';
import type { SiglensDatabase } from '@/shared/db/types';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const dialect = new PgDialect();

function render(condition: unknown): { sql: string; params: unknown[] } {
    const query = dialect.sqlToQuery(condition as SQL);
    return { sql: query.sql, params: query.params };
}

/** 이 목이 받은 단 하나의 호출 인자. 호출 수까지 함께 고정한다(인덱스로 집으면 다른 호출이 끼어도 모른다). */
function onlyCallArg(fn: { mock: { calls: unknown[][] } }): unknown {
    expect(fn.mock.calls).toHaveLength(1);
    return fn.mock.calls.find(Boolean)?.[0];
}

describe('DrizzleMailAlertSubscriberRepository', () => {
    it('upsertVerified: 새 행이면 created=true, 주소 충돌 시 user_id는 비어 있을 때만 채운다', async () => {
        const returning = vi
            .fn()
            .mockResolvedValue([{ id: 'sub-1', created: true }]);
        const onConflictDoUpdate = vi.fn((_config: unknown) => ({
            returning,
        }));
        const values = vi.fn((_row: unknown) => ({ onConflictDoUpdate }));
        const db = {
            insert: () => ({ values }),
        } as unknown as SiglensDatabase;

        const result = await new DrizzleMailAlertSubscriberRepository(
            db
        ).upsertVerified({
            email: 'a@x.io',
            locale: 'ko',
            consentSource: 'symbol',
        });

        expect(result).toEqual({ id: 'sub-1', created: true });
        const row = onlyCallArg(values) as Record<string, unknown>;
        // 호출자는 회원을 넘기지 않는다: user_id는 DB가 주소로 정한다(인증된 회원, 구독자 행 없음).
        expect(Object.keys(row).sort()).toEqual([
            'consentSource',
            'email',
            'locale',
            'userId',
        ]);
        expect(row['email']).toBe('a@x.io');
        const owner = render(row['userId']);
        expect(owner.sql).toBe(
            '(select "users"."id" from "users" where "users"."email" = $1 and "users"."email_verified" and not exists (select 1 from "mail_alert_subscribers" where "mail_alert_subscribers"."user_id" = "users"."id"))'
        );
        expect(owner.params).toEqual(['a@x.io']);
        const config = onlyCallArg(onConflictDoUpdate) as {
            set: Record<string, unknown>;
        };
        // 처음 동의 값은 충돌 갱신 대상이 아니다.
        expect(Object.keys(config.set).sort()).toEqual(['updatedAt', 'userId']);
        expect(render(config.set['userId']).sql).toBe(
            'coalesce("mail_alert_subscribers"."user_id", excluded.user_id)'
        );
    });

    it('upsertVerified: 반환 행이 없으면 던진다', async () => {
        const db = {
            insert: () => ({
                values: () => ({
                    onConflictDoUpdate: () => ({
                        returning: vi.fn().mockResolvedValue([]),
                    }),
                }),
            }),
        } as unknown as SiglensDatabase;

        await expect(
            new DrizzleMailAlertSubscriberRepository(db).upsertVerified({
                email: 'a@x.io',
                locale: 'ko',
                consentSource: 'symbol',
            })
        ).rejects.toThrow('Failed to upsert mail alert subscriber');
    });

    it('findByOwner: 회원은 user_id로, 비회원은 id와 user_id null로 행을 가리킨다', async () => {
        const where = vi.fn((_condition: unknown) => ({
            limit: vi.fn().mockResolvedValue([]),
        }));
        const db = {
            select: () => ({ from: () => ({ where }) }),
        } as unknown as SiglensDatabase;
        const repo = new DrizzleMailAlertSubscriberRepository(db);

        await repo.findByOwner({ kind: 'member', userId: 'u-1' });
        await repo.findByOwner({ kind: 'guest', subscriberId: 's-1' });
        await repo.findByOwner({ kind: 'link', subscriberId: 's-2' });

        const rendered = where.mock.calls.map(call => render(call[0]));
        expect(rendered).toContainEqual({
            sql: '"mail_alert_subscribers"."user_id" = $1',
            params: ['u-1'],
        });
        expect(rendered).toContainEqual({
            sql: '"mail_alert_subscribers"."id" = $1 and "mail_alert_subscribers"."user_id" is null',
            params: ['s-1'],
        });
        // 서명된 링크가 증명한 소유자는 id만으로 가리킨다(user_id 조건 없음).
        expect(rendered).toContainEqual({
            sql: '"mail_alert_subscribers"."id" = $1',
            params: ['s-2'],
        });
    });

    it.each([
        { kind: 'guest', subscriberId: 's-1' },
        { kind: 'link', subscriberId: 's-1' },
    ] as const)(
        'setIncludePortfolio: %j 소유자는 DB를 열지 않고 거절한다(포트폴리오는 회원 것)',
        async owner => {
            const transaction = vi.fn();
            const db = { transaction } as unknown as SiglensDatabase;

            await expect(
                new DrizzleMailAlertSubscriberRepository(
                    db
                ).setIncludePortfolio(owner, true)
            ).resolves.toEqual({ found: false, subscriberDeleted: false });
            expect(transaction).not.toHaveBeenCalled();
        }
    );

    it('findAllForDelivery: 항목이 있거나 보유·관심종목 함께 받기가 켜졌거나 살아 있는 가격대 알림이 있는 구독자만 묶는다', async () => {
        const orderBy = vi.fn().mockResolvedValue([]);
        const having = vi.fn((_condition: unknown) => ({ orderBy }));
        const db = {
            select: () => ({
                from: () => ({
                    leftJoin: () => ({
                        groupBy: () => ({ having }),
                    }),
                }),
            }),
        } as unknown as SiglensDatabase;

        await new DrizzleMailAlertSubscriberRepository(db).findAllForDelivery();

        expect(render(onlyCallArg(having)).sql).toBe(
            '"mail_alert_subscribers"."include_portfolio" or count("mail_alert_topics"."kind") > 0 or exists (select 1 from "price_alerts" where "price_alerts"."subscriber_id" = "mail_alert_subscribers"."id" and "price_alerts"."status" = \'active\' and "price_alerts"."expires_on" >= (now() at time zone \'Asia/Seoul\')::date)'
        );
    });
});

describe('findAllForDelivery alertDate', () => {
    it('알림 날짜를 주면 만료 판정에 그 값을 바인딩한다', async () => {
        const orderBy = vi.fn().mockResolvedValue([]);
        const having = vi.fn((_condition: unknown) => ({ orderBy }));
        const db = {
            select: () => ({
                from: () => ({
                    leftJoin: () => ({ groupBy: () => ({ having }) }),
                }),
            }),
        } as unknown as SiglensDatabase;

        await new DrizzleMailAlertSubscriberRepository(db).findAllForDelivery(
            '2026-11-23'
        );

        const { sql, params } = render(onlyCallArg(having));
        expect(sql).toBe(
            '"mail_alert_subscribers"."include_portfolio" or count("mail_alert_topics"."kind") > 0 or exists (select 1 from "price_alerts" where "price_alerts"."subscriber_id" = "mail_alert_subscribers"."id" and "price_alerts"."status" = \'active\' and "price_alerts"."expires_on" >= $1)'
        );
        expect(params).toEqual(['2026-11-23']);
    });
});

describe('DrizzleMailAlertDeliveryRepository', () => {
    it('claim: 유니크 충돌로 진 쪽은 null이다', async () => {
        const returning = vi.fn().mockResolvedValue([]);
        const db = {
            insert: () => ({
                values: () => ({
                    onConflictDoNothing: () => ({ returning }),
                }),
            }),
        } as unknown as SiglensDatabase;

        await expect(
            new DrizzleMailAlertDeliveryRepository(db).claim(
                'sub-1',
                '2026-11-24'
            )
        ).resolves.toBeNull();
    });

    it('claim: 이긴 쪽은 pending 행을 넣고 id를 받는다', async () => {
        const values = vi.fn((_row: unknown) => ({
            onConflictDoNothing: () => ({
                returning: vi.fn().mockResolvedValue([{ id: 'del-1' }]),
            }),
        }));
        const db = {
            insert: () => ({ values }),
        } as unknown as SiglensDatabase;

        await expect(
            new DrizzleMailAlertDeliveryRepository(db).claim(
                'sub-1',
                '2026-11-24'
            )
        ).resolves.toBe('del-1');
        expect(onlyCallArg(values)).toEqual({
            subscriberId: 'sub-1',
            alertDate: '2026-11-24',
            status: 'pending',
            itemKeys: [],
        });
    });

    it('claim: 넘긴 항목 키를 pending 행과 함께 저장한다', async () => {
        const values = vi.fn((_row: unknown) => ({
            onConflictDoNothing: () => ({
                returning: vi.fn().mockResolvedValue([{ id: 'del-1' }]),
            }),
        }));
        const db = {
            insert: () => ({ values }),
        } as unknown as SiglensDatabase;

        await new DrizzleMailAlertDeliveryRepository(db).claim(
            'sub-1',
            '2026-11-24',
            ['a', 'b']
        );

        expect(onlyCallArg(values)).toEqual({
            subscriberId: 'sub-1',
            alertDate: '2026-11-24',
            status: 'pending',
            itemKeys: ['a', 'b'],
        });
    });

    it('recentItemKeys: sent·pending 행만 알림 날짜 하한(이상)으로 읽고 구독자별 집합으로 합친다', async () => {
        const where = vi.fn((_condition: unknown) =>
            Promise.resolve([
                { subscriberId: 's1', itemKeys: ['a', 'b'] },
                { subscriberId: 's1', itemKeys: ['b', 'c'] },
                { subscriberId: 's2', itemKeys: [] },
            ])
        );
        const db = {
            select: () => ({ from: () => ({ where }) }),
        } as unknown as SiglensDatabase;

        const keys = await new DrizzleMailAlertDeliveryRepository(
            db
        ).recentItemKeys('2026-11-17');

        expect(keys.get('s1')).toEqual(new Set(['a', 'b', 'c']));
        expect(keys.get('s2')).toEqual(new Set());
        const { sql, params } = render(onlyCallArg(where));
        expect(sql).toBe(
            '("mail_alert_deliveries"."status" in ($1, $2) and "mail_alert_deliveries"."alert_date" >= $3)'
        );
        expect(params).toEqual(['sent', 'pending', '2026-11-17']);
    });

    it('pruneBefore: 알림 날짜가 기준일보다 이른 행만 지우고 수를 센다', async () => {
        const where = vi.fn((_condition: unknown) => ({
            returning: vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]),
        }));
        const db = {
            delete: () => ({ where }),
        } as unknown as SiglensDatabase;

        await expect(
            new DrizzleMailAlertDeliveryRepository(db).pruneBefore('2026-08-25')
        ).resolves.toBe(2);
        const { sql, params } = render(onlyCallArg(where));
        expect(sql).toBe('"mail_alert_deliveries"."alert_date" < $1');
        expect(params).toEqual(['2026-08-25']);
    });
});

describe('DrizzlePriceAlertRepository', () => {
    const row = {
        id: 'a1',
        subscriberId: 's1',
        proposalId: 'p1',
        symbol: 'AAPL',
        market: 'us',
        condition: 'enter_zone',
        approach: 'from_above',
        zoneLow: '178.000000',
        zoneHigh: '181.500000',
        level: null,
        basis: 'analysis_entry_zone',
        analysisAt: new Date('2026-11-20T08:30:00Z'),
        referenceClose: '190.500000',
        startsAfterSession: '2026-11-20',
        expiresOn: '2026-12-21',
        status: 'active',
        firedSession: null,
        firedClose: null,
        firedAt: null,
        createdAt: new Date('2026-11-21T01:00:00Z'),
    } as const;

    function selectDb(rows: unknown[]) {
        const where = vi.fn((_condition: unknown) => ({
            orderBy: vi.fn().mockResolvedValue(rows),
            limit: vi.fn().mockResolvedValue(rows),
        }));
        const db = {
            select: () => ({ from: () => ({ where }) }),
        } as unknown as SiglensDatabase;
        return { db, where };
    }

    const owner = { kind: 'guest', subscriberId: 's1' } as const;

    it('listForSubscriber: numeric 문자열을 숫자로, 구간 열을 조건 유니온으로 되돌린다', async () => {
        const { db } = selectDb([row]);

        const [record] = await new DrizzlePriceAlertRepository(
            db
        ).listForSubscriber(owner);

        expect(record).toMatchObject({
            condition: {
                kind: 'enter_zone',
                low: 178,
                high: 181.5,
                approach: 'from_above',
            },
            referenceClose: 190.5,
            firedClose: null,
        });
    });

    it('단일 가격 행은 level만 가진 조건이 되고, 알린 종가는 숫자가 된다', async () => {
        const { db } = selectDb([
            {
                ...row,
                condition: 'close_above',
                approach: null,
                zoneLow: null,
                zoneHigh: null,
                level: '200.250000',
                status: 'fired',
                firedClose: '201.000000',
            },
        ]);

        const [record] = await new DrizzlePriceAlertRepository(
            db
        ).listForSubscriber(owner);

        expect(record?.condition).toEqual({
            kind: 'close_above',
            level: 200.25,
        });
        expect(record?.firedClose).toBe(201);
    });

    it('CHECK가 막는 모양이 새어 나오면 조용히 넘기지 않고 던진다', async () => {
        const { db } = selectDb([{ ...row, approach: null }]);

        await expect(
            new DrizzlePriceAlertRepository(db).listForSubscriber(owner)
        ).rejects.toThrow('Malformed enter_zone price alert a1');
    });

    it('findByProposal: 행이 없으면 null이다', async () => {
        const { db } = selectDb([]);

        await expect(
            new DrizzlePriceAlertRepository(db).findByProposal(owner, 'p1')
        ).resolves.toBeNull();
    });

    it('createWithinLimit: 유한한 양수가 아닌 값은 DB를 건드리지 않고 invalid다', async () => {
        const transaction = vi.fn();
        const db = { transaction } as unknown as SiglensDatabase;

        await expect(
            new DrizzlePriceAlertRepository(db).createWithinLimit(
                owner,
                {
                    proposalId: 'p1',
                    symbol: 'AAPL',
                    market: 'us',
                    condition: { kind: 'close_below', level: Number.NaN },
                    basis: 'price_level',
                    analysisAt: null,
                    referenceClose: 100,
                    startsAfterSession: '2026-11-20',
                    expiresOn: '2026-12-20',
                },
                10
            )
        ).resolves.toBe('invalid');
        expect(transaction).not.toHaveBeenCalled();
    });

    it('listActiveForDelivery: 진행 중이고 만료일이 알림 날짜 이상인 알림을 구독자별로 묶는다', async () => {
        const { db, where } = selectDb([
            row,
            { ...row, id: 'a2', proposalId: 'p2' },
            { ...row, id: 'a3', subscriberId: 's2', proposalId: 'p3' },
        ]);

        const byId = await new DrizzlePriceAlertRepository(
            db
        ).listActiveForDelivery('2026-11-23');

        expect(byId.get('s1')?.map(a => a.id)).toEqual(['a1', 'a2']);
        expect(byId.get('s2')?.map(a => a.id)).toEqual(['a3']);
        const { sql, params } = render(onlyCallArg(where));
        expect(sql).toBe(
            '("price_alerts"."status" = $1 and "price_alerts"."expires_on" >= $2)'
        );
        expect(params).toEqual(['active', '2026-11-23']);
    });

    it('pruneExpiredAndFired: 지울 알림을 가진 구독자가 없으면 알림도 구독자도 지우지 않는다', async () => {
        const lock = vi.fn().mockResolvedValue([]);
        const select = vi.fn(() => ({
            from: () => ({ where: () => ({ orderBy: () => ({ for: lock }) }) }),
        }));
        const del = vi.fn();
        const tx = { select, delete: del };
        const db = {
            transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
        } as unknown as SiglensDatabase;

        await expect(
            new DrizzlePriceAlertRepository(db).pruneExpiredAndFired(
                '2026-11-23'
            )
        ).resolves.toEqual({ alertsDeleted: 0, subscribersDeleted: 0 });

        expect(lock).toHaveBeenCalledWith('no key update');
        expect(del).not.toHaveBeenCalled();
    });
});
