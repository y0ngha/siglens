import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
    DrizzleMailAlertDeliveryRepository,
    DrizzleMailAlertSubscriberRepository,
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
        expect(owner.sql).toContain('"users"."email_verified"');
        expect(owner.sql).toContain('not exists');
        expect(owner.params).toEqual(['a@x.io']);
        const config = onlyCallArg(onConflictDoUpdate) as {
            set: Record<string, unknown>;
        };
        // 처음 동의 값은 충돌 갱신 대상이 아니다.
        expect(Object.keys(config.set).sort()).toEqual(['updatedAt', 'userId']);
        expect(render(config.set['userId']).sql).toContain(
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

        const rendered = where.mock.calls.map(call => render(call[0]));
        expect(rendered).toContainEqual({
            sql: '"mail_alert_subscribers"."user_id" = $1',
            params: ['u-1'],
        });
        expect(rendered).toContainEqual({
            sql: '"mail_alert_subscribers"."id" = $1 and "mail_alert_subscribers"."user_id" is null',
            params: ['s-1'],
        });
    });

    it('findAllForDelivery: 항목이 있거나 보유·관심종목 함께 받기가 켜진 구독자만 묶는다', async () => {
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
            '"mail_alert_subscribers"."include_portfolio" or count("mail_alert_topics"."kind") > 0'
        );
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
        });
    });

    it('recentItemKeys: sent 발송만 알림 날짜 하한(이상)으로 읽고 구독자별 집합으로 합친다', async () => {
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
        expect(sql).toContain('"mail_alert_deliveries"."status" = $1');
        expect(sql).toContain('"mail_alert_deliveries"."alert_date" >= $2');
        expect(params).toEqual(['sent', '2026-11-17']);
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
        expect(sql).toContain('"mail_alert_deliveries"."alert_date" < $1');
        expect(params).toEqual(['2026-08-25']);
    });
});
