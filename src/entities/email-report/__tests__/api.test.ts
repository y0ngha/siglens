// withRetry 내부 sleep을 즉시 resolve로 stubbing해 transient retry 대기를 없앤다.
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { is, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { emailReportSubscriptions } from '@/shared/db/schema';
import { DrizzleEmailReportSubscriptionRepository } from '@/entities/email-report/api';
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
