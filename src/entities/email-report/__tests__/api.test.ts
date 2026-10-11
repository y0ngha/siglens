// withRetry 내부 sleep을 즉시 resolve로 stubbing해 transient retry 대기를 없앤다.
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { is, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
    emailReportDeliveries,
    emailReportSubscriptions,
} from '@/shared/db/schema';
import { createSqlCaptureDb } from '@/__tests__/utils/drizzleSqlCapture';
import {
    DrizzleEmailReportDeliveryRepository,
    DrizzleEmailReportExclusionRepository,
    DrizzleEmailReportSubscriptionRepository,
} from '@/entities/email-report/api';
import type {
    SiglensDatabase,
    UpsertEmailReportSubscriptionInput,
} from '@/shared/db/types';

const subscriptionRow = {
    userId: 'user-1',
    enabled: true,
    daysOfWeek: 0b0000010,
    sendHour: 8,
    timezone: 'Asia/Seoul',
    locale: 'ko',
    consentedAt: new Date('2026-10-01T00:00:00.000Z'),
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:01.000Z'),
};

const UPSERT_INPUT: UpsertEmailReportSubscriptionInput = {
    userId: 'user-1',
    enabled: true,
    daysOfWeek: 0b0100010,
    sendHour: 21,
    timezone: 'America/New_York',
    locale: 'en',
};

const dialect = new PgDialect();
const toSqlText = (value: unknown): string =>
    dialect.sqlToQuery(value as SQL).sql;

function makeUpsertDb(rows: unknown[]) {
    const returning = vi.fn().mockResolvedValue(rows);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        values,
        onConflictDoUpdate,
    };
}

function makeFindDb(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, from, limit };
}

describe('DrizzleEmailReportSubscriptionRepository.findByUser', () => {
    it('행이 있으면 그 행을 돌려준다', async () => {
        const { db, from, limit } = makeFindDb([subscriptionRow]);
        const repo = new DrizzleEmailReportSubscriptionRepository(db);

        await expect(repo.findByUser('user-1')).resolves.toEqual(
            subscriptionRow
        );
        expect(from).toHaveBeenCalledWith(emailReportSubscriptions);
        expect(limit).toHaveBeenCalledWith(1);
    });

    it('행이 없으면 null이다', async () => {
        const { db } = makeFindDb([]);
        const repo = new DrizzleEmailReportSubscriptionRepository(db);

        await expect(repo.findByUser('user-1')).resolves.toBeNull();
    });
});

describe('DrizzleEmailReportSubscriptionRepository.upsert', () => {
    it('user_id 충돌 시 입력 필드를 덮어쓰고 저장된 행을 돌려준다', async () => {
        const { db, values, onConflictDoUpdate } = makeUpsertDb([
            subscriptionRow,
        ]);
        const repo = new DrizzleEmailReportSubscriptionRepository(db);

        await expect(repo.upsert(UPSERT_INPUT)).resolves.toEqual(
            subscriptionRow
        );

        expect(values).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                enabled: true,
                daysOfWeek: 0b0100010,
                sendHour: 21,
                timezone: 'America/New_York',
                locale: 'en',
            })
        );
        const [conflictArgs] = onConflictDoUpdate.mock.calls[0] as unknown as [
            unknown,
        ];
        expect(conflictArgs).toMatchObject({
            target: emailReportSubscriptions.userId,
            set: {
                enabled: true,
                daysOfWeek: 0b0100010,
                sendHour: 21,
                timezone: 'America/New_York',
                locale: 'en',
            },
        });
    });

    it('켜는 저장은 신규 행에 now()를, 기존 행에는 이미 켜져 있을 때만 기존 동의 시각을 유지한다', async () => {
        const { db, values, onConflictDoUpdate } = makeUpsertDb([
            subscriptionRow,
        ]);
        await new DrizzleEmailReportSubscriptionRepository(db).upsert(
            UPSERT_INPUT
        );

        const [inserted] = values.mock.calls[0] as unknown as [
            { consentedAt: unknown },
        ];
        expect(toSqlText(inserted.consentedAt)).toBe('now()');

        const [conflictArgs] = onConflictDoUpdate.mock.calls[0] as unknown as [
            { set: { consentedAt: unknown } },
        ];
        expect(is(conflictArgs.set.consentedAt, SQL)).toBe(true);
        expect(toSqlText(conflictArgs.set.consentedAt)).toBe(
            'case when "email_report_subscriptions"."enabled" then "email_report_subscriptions"."consented_at" else now() end'
        );
    });

    it('끄는 저장은 신규 행에 동의 시각을 남기지 않고, 기존 행의 동의 시각은 보존한다', async () => {
        const { db, values, onConflictDoUpdate } = makeUpsertDb([
            subscriptionRow,
        ]);
        await new DrizzleEmailReportSubscriptionRepository(db).upsert({
            ...UPSERT_INPUT,
            enabled: false,
        });

        const [inserted] = values.mock.calls[0] as unknown as [
            { consentedAt: unknown },
        ];
        expect(inserted.consentedAt).toBeNull();

        const [conflictArgs] = onConflictDoUpdate.mock.calls[0] as unknown as [
            { set: { consentedAt: unknown } },
        ];
        expect(toSqlText(conflictArgs.set.consentedAt)).toBe(
            '"email_report_subscriptions"."consented_at"'
        );
    });

    it('DB가 행을 돌려주지 않으면 던진다', async () => {
        const { db } = makeUpsertDb([]);
        await expect(
            new DrizzleEmailReportSubscriptionRepository(db).upsert(
                UPSERT_INPUT
            )
        ).rejects.toThrow('Failed to upsert email report subscription');
    });

    it('일시적 DB 오류는 한 번 재시도해 성공한다', async () => {
        const transient = Object.assign(
            new Error('write CONNECTION_CLOSED db.example:5432'),
            { code: 'CONNECTION_CLOSED' }
        );
        const returning = vi
            .fn()
            .mockRejectedValueOnce(transient)
            .mockResolvedValueOnce([subscriptionRow]);
        const onConflictDoUpdate = vi.fn(() => ({ returning }));
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        const insert = vi.fn(() => ({ values }));
        const db = { insert } as unknown as SiglensDatabase;

        await expect(
            new DrizzleEmailReportSubscriptionRepository(db).upsert(
                UPSERT_INPUT
            )
        ).resolves.toEqual(subscriptionRow);
        expect(returning).toHaveBeenCalledTimes(2);
    });
});

describe('DrizzleEmailReportSubscriptionRepository.findEnabledRecipients', () => {
    it('구독과 회원을 조인해 켜진·인증된·회원 등급 행만 조회한다', async () => {
        const rows = [{ userId: 'user-1', email: 'a@x.com' }];
        const where = vi.fn().mockResolvedValue(rows);
        const innerJoin = vi.fn(() => ({ where }));
        const from = vi.fn(() => ({ innerJoin }));
        const select = vi.fn(() => ({ from }));
        const db = { select } as unknown as SiglensDatabase;

        await expect(
            new DrizzleEmailReportSubscriptionRepository(
                db
            ).findEnabledRecipients()
        ).resolves.toEqual(rows);

        expect(from).toHaveBeenCalledWith(emailReportSubscriptions);
        const sqlText = dialect.sqlToQuery(
            (where.mock.calls[0] as unknown as [SQL])[0]
        );
        expect(sqlText.sql).toContain(
            '"email_report_subscriptions"."enabled" = $1'
        );
        expect(sqlText.sql).toContain('"users"."email_verified" = $2');
        expect(sqlText.sql).toContain('"users"."tier" in ($3, $4)');
        expect(sqlText.params).toEqual([true, true, 'member', 'pro']);
    });
});

describe('DrizzleEmailReportSubscriptionRepository.disable', () => {
    function makeUpdateDb(rows: unknown[]) {
        const returning = vi.fn().mockResolvedValue(rows);
        const where = vi.fn(() => ({ returning }));
        const set = vi.fn(() => ({ where }));
        const update = vi.fn(() => ({ set }));
        return { db: { update } as unknown as SiglensDatabase, set };
    }

    it('행이 있으면 enabled를 끄고 true', async () => {
        const { db, set } = makeUpdateDb([{ userId: 'user-1' }]);

        await expect(
            new DrizzleEmailReportSubscriptionRepository(db).disable('user-1')
        ).resolves.toBe(true);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false })
        );
    });

    it('행이 없으면 false', async () => {
        const { db } = makeUpdateDb([]);

        await expect(
            new DrizzleEmailReportSubscriptionRepository(db).disable('user-1')
        ).resolves.toBe(false);
    });
});

describe('DrizzleEmailReportDeliveryRepository', () => {
    it('claim: 새 행이면 id를, 충돌이면 null을 돌려준다', async () => {
        const returning = vi
            .fn()
            .mockResolvedValueOnce([{ id: 'd-1' }])
            .mockResolvedValueOnce([]);
        const onConflictDoNothing = vi.fn(() => ({ returning }));
        const values = vi.fn(() => ({ onConflictDoNothing }));
        const insert = vi.fn(() => ({ values }));
        const repo = new DrizzleEmailReportDeliveryRepository({
            insert,
        } as unknown as SiglensDatabase);

        await expect(repo.claim('user-1', '2026-10-08')).resolves.toBe('d-1');
        await expect(repo.claim('user-1', '2026-10-08')).resolves.toBeNull();
        expect(values).toHaveBeenCalledWith({
            userId: 'user-1',
            localDate: '2026-10-08',
            status: 'pending',
        });
        expect(onConflictDoNothing).toHaveBeenCalledWith({
            target: [
                emailReportDeliveries.userId,
                emailReportDeliveries.localDate,
            ],
        });
    });

    it('finish: 결과·종목·오류를 기록한다', async () => {
        const where = vi.fn().mockResolvedValue(undefined);
        const set = vi.fn(() => ({ where }));
        const update = vi.fn(() => ({ set }));
        const repo = new DrizzleEmailReportDeliveryRepository({
            update,
        } as unknown as SiglensDatabase);

        await repo.finish('d-1', 'failed', ['AAPL'], 'boom');

        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'failed',
                symbols: ['AAPL'],
                error: 'boom',
            })
        );
    });

    it('pruneOlderThan: 지운 행 수를 돌려준다', async () => {
        const returning = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
        const where = vi.fn(() => ({ returning }));
        const del = vi.fn(() => ({ where }));
        const repo = new DrizzleEmailReportDeliveryRepository({
            delete: del,
        } as unknown as SiglensDatabase);

        await expect(
            repo.pruneOlderThan(new Date('2026-07-01T00:00:00Z'))
        ).resolves.toBe(2);
        expect(del).toHaveBeenCalledWith(emailReportDeliveries);
    });
});

describe('DrizzleEmailReportExclusionRepository', () => {
    /** 트랜잭션 콜백에 실제 Drizzle SQL 캡처 DB를 넘기고, 쿼리 순서대로 결과를 준다. */
    function txDb(results: unknown[][]) {
        const { db: tx, captured } = createSqlCaptureDb(
            (_query, index) => results[index] ?? []
        );
        const db = {
            transaction: (cb: (t: SiglensDatabase) => Promise<unknown>) =>
                cb(tx),
        } as unknown as SiglensDatabase;
        return { db, captured };
    }

    it('findExcludedSymbols는 회원의 행만 읽어 심볼 배열로 돌려준다', async () => {
        const { db, captured } = createSqlCaptureDb(() => [
            { symbol: 'AAPL' },
            { symbol: 'TSLA' },
        ]);

        const symbols = await new DrizzleEmailReportExclusionRepository(
            db
        ).findExcludedSymbols('user-1');

        expect(symbols).toEqual(['AAPL', 'TSLA']);
        expect(captured).toEqual([
            {
                sql: 'select "symbol" from "email_report_excluded_symbols" where "email_report_excluded_symbols"."user_id" = $1',
                params: ['user-1'],
            },
        ]);
    });

    it('excludeSymbol은 회원 행을 FOR NO KEY UPDATE로 잠근 뒤 개수를 읽고 충돌 무시로 삽입한다', async () => {
        const { db, captured } = txDb([
            [{ id: 'user-1' }],
            [{ symbol: 'MSFT' }],
            [],
        ]);

        const outcome = await new DrizzleEmailReportExclusionRepository(
            db
        ).excludeSymbol('user-1', 'AAPL', 200);

        expect(outcome).toBe('excluded');
        expect(captured).toHaveLength(3);
        // 상한 판정용 개수 조회는 이 회원의 행만 읽는다.
        expect(captured[1]).toEqual({
            sql: expect.stringMatching(
                /^select "symbol" from "email_report_excluded_symbols" where "email_report_excluded_symbols"\."user_id" = \$1/
            ),
            params: ['user-1'],
        });
        expect(captured[0]).toEqual({
            sql: 'select "id" from "users" where "users"."id" = $1 for no key update',
            params: ['user-1'],
        });
        expect(captured[2].sql).toMatch(
            /^insert into "email_report_excluded_symbols" \("user_id", "symbol", "created_at"\) values \(\$1, \$2, default\) on conflict \("user_id","symbol"\) do nothing/
        );
        expect(captured[2].params).toEqual(['user-1', 'AAPL']);
    });

    it('새 심볼이고 이미 상한이면 삽입하지 않고 limit_reached', async () => {
        const { db, captured } = txDb([
            [{ id: 'user-1' }],
            [{ symbol: 'MSFT' }, { symbol: 'NVDA' }],
        ]);

        const outcome = await new DrizzleEmailReportExclusionRepository(
            db
        ).excludeSymbol('user-1', 'AAPL', 2);

        expect(outcome).toBe('limit_reached');
        expect(captured.some(q => q.sql.startsWith('insert'))).toBe(false);
    });

    it('이미 뺀 심볼은 상한이어도 멱등 성공이다', async () => {
        const { db, captured } = txDb([
            [{ id: 'user-1' }],
            [{ symbol: 'MSFT' }, { symbol: 'AAPL' }],
            [],
        ]);

        await expect(
            new DrizzleEmailReportExclusionRepository(db).excludeSymbol(
                'user-1',
                'AAPL',
                2
            )
        ).resolves.toBe('excluded');
        // 삽입은 여전히 나가지만 충돌 무시라 행이 늘지 않는다.
        expect(captured[2].sql).toMatch(
            /^insert into "email_report_excluded_symbols".* on conflict \("user_id","symbol"\) do nothing/
        );
    });

    it('includeSymbol은 (회원, 심볼) 행만 지우고 지웠는지를 돌려준다', async () => {
        const removed = createSqlCaptureDb(() => [{ symbol: 'AAPL' }]);
        await expect(
            new DrizzleEmailReportExclusionRepository(removed.db).includeSymbol(
                'user-1',
                'AAPL'
            )
        ).resolves.toBe(true);
        expect(removed.captured[0]).toEqual({
            sql: expect.stringMatching(
                /^delete from "email_report_excluded_symbols" where \("email_report_excluded_symbols"\."user_id" = \$1 and "email_report_excluded_symbols"\."symbol" = \$2\) returning /
            ),
            params: ['user-1', 'AAPL'],
        });

        const none = createSqlCaptureDb(() => []);
        await expect(
            new DrizzleEmailReportExclusionRepository(none.db).includeSymbol(
                'user-1',
                'AAPL'
            )
        ).resolves.toBe(false);
    });
});
