import { readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import type { UpsertEmailReportSubscriptionInput } from '@/shared/db/types';
import { DrizzleEmailReportSubscriptionRepository } from '../api';

vi.mock('server-only', () => ({}));

/**
 * 메일 리포트 수신 동의 출처(`consent_source`)의 백필·CHECK·"꺼진 뒤 켤 때만 바뀐다" 규칙을 진짜
 * Postgres에서 본다(TESTING.md#TE-55). 모킹된 DB로는 마이그레이션의 `UPDATE`가 어느 행을 건드리는지,
 * CHECK가 막는지, `case when enabled` 충돌 갱신이 어떻게 평가되는지 보이지 않는다.
 * `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --name <unique> -e POSTGRES_PASSWORD=x -e POSTGRES_USER=siglens -e POSTGRES_DB=siglens_test \
 *     -p 127.0.0.1:55432:5432 --pull never postgres:17-alpine
 *   TEST_DATABASE_URL=postgres://siglens:x@127.0.0.1:55432/siglens_test yarn test emailReportConsent.db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 `0041_email_reports.sql`을 먼저 적용해 옛 행을
 * 심은 뒤 `0062_email_report_consent_and_welcome.sql`(백필 포함)을 적용하고, 끝나면 스키마를 지운다.
 * `users`는 FK에 필요한 열만 둔 최소 테이블이다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `email_report_consent_test_${process.pid}`;

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.replace('"public"."users"', '"users"'));

const INPUT: Omit<UpsertEmailReportSubscriptionInput, 'userId'> = {
    enabled: true,
    daysOfWeek: 0b0000010,
    sendHour: 8,
    timezone: 'Asia/Seoul',
    locale: 'ko',
    consentSource: 'signup_email',
};

describe.skipIf(!URL)(
    '메일 리포트 수신 동의 출처가 진짜 Postgres에서 규칙대로 기록된다',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: 4,
            connection: { search_path: SCHEMA },
        });
        const repo = new DrizzleEmailReportSubscriptionRepository(
            drizzle(client, { schema })
        );
        /** 0062 적용 전에 심은 옛 행의 회원: 설정 화면으로 동의한 회원과 한 번도 동의하지 않은 회원. */
        const legacy = { consentedId: '', neverId: '' };

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

        async function createMember(): Promise<string> {
            const [row] = await client<{ id: string }[]>`
                INSERT INTO users DEFAULT VALUES RETURNING id`;
            return row.id;
        }

        async function sourceRow(userId: string) {
            const [row] = await client<
                {
                    consent_source: string | null;
                    consented_at: Date | null;
                    enabled: boolean;
                }[]
            >`SELECT consent_source, consented_at, enabled
              FROM email_report_subscriptions WHERE user_id = ${userId}`;
            return row;
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
                'CREATE TABLE "users" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL)'
            );
            await runInOrder(migration('0041_email_reports.sql'));

            // 0062 이전의 옛 행: 설정 화면에서 켜 본 회원과 한 번도 켜지 않은 회원.
            legacy.consentedId = await createMember();
            legacy.neverId = await createMember();
            await client`INSERT INTO email_report_subscriptions
                (user_id, enabled, days_of_week, send_hour, timezone, consented_at)
                VALUES (${legacy.consentedId}, false, 2, 8, 'Asia/Seoul', now())`;
            await client`INSERT INTO email_report_subscriptions
                (user_id, enabled, days_of_week, send_hour, timezone, consented_at)
                VALUES (${legacy.neverId}, false, 2, 8, 'Asia/Seoul', NULL)`;

            await runInOrder(
                migration('0062_email_report_consent_and_welcome.sql')
            );
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        it('백필은 동의 시각이 있는 옛 행만 settings로 채운다', async () => {
            expect((await sourceRow(legacy.consentedId)).consent_source).toBe(
                'settings'
            );
            expect((await sourceRow(legacy.neverId)).consent_source).toBeNull();
        });

        it("CHECK는 허용 값 밖('other')을 거부하고 null과 세 값은 받는다", async () => {
            const userId = await createMember();
            await expect(
                client`INSERT INTO email_report_subscriptions
                    (user_id, days_of_week, send_hour, timezone, consent_source)
                    VALUES (${userId}, 2, 8, 'Asia/Seoul', 'other')`
            ).rejects.toThrow(
                /email_report_subscriptions_consent_source_check/
            );

            const accepted = await Promise.all(
                [null, 'settings', 'signup_email', 'signup_oauth'].map(
                    async source => {
                        const id = await createMember();
                        await client`INSERT INTO email_report_subscriptions
                            (user_id, days_of_week, send_hour, timezone, consent_source)
                            VALUES (${id}, 2, 8, 'Asia/Seoul', ${source})`;
                        return (await sourceRow(id)).consent_source;
                    }
                )
            );
            expect(accepted).toEqual([
                null,
                'settings',
                'signup_email',
                'signup_oauth',
            ]);
        });

        it('새로 켜는 저장은 동의 시각과 출처를 함께 남긴다', async () => {
            const userId = await createMember();

            const record = await repo.upsert({ ...INPUT, userId });

            expect(record.consentSource).toBe('signup_email');
            expect(record.consentedAt).toBeInstanceOf(Date);
            expect((await sourceRow(userId)).consent_source).toBe(
                'signup_email'
            );
        });

        it('이미 켜진 상태에서 다시 저장해도 처음 동의한 출처와 시각을 지킨다', async () => {
            const userId = await createMember();
            const first = await repo.upsert({ ...INPUT, userId });

            const again = await repo.upsert({
                ...INPUT,
                userId,
                consentSource: 'settings',
                sendHour: 21,
            });

            expect(again.consentSource).toBe('signup_email');
            expect(again.consentedAt?.getTime()).toBe(
                first.consentedAt?.getTime()
            );
            expect(again.sendHour).toBe(21);
        });

        it('끄는 저장은 출처와 동의 시각을 지우지 않는다', async () => {
            const userId = await createMember();
            const first = await repo.upsert({ ...INPUT, userId });

            const off = await repo.upsert({
                ...INPUT,
                userId,
                enabled: false,
                consentSource: 'settings',
            });

            expect(off.enabled).toBe(false);
            expect(off.consentSource).toBe('signup_email');
            expect(off.consentedAt?.getTime()).toBe(
                first.consentedAt?.getTime()
            );
        });

        it('꺼졌다가 다시 켜면 그 화면으로 출처와 동의 시각이 새로 찍힌다', async () => {
            const userId = await createMember();
            const first = await repo.upsert({ ...INPUT, userId });
            await repo.upsert({ ...INPUT, userId, enabled: false });
            await client`SELECT pg_sleep(0.05)`;

            const on = await repo.upsert({
                ...INPUT,
                userId,
                consentSource: 'settings',
            });

            expect(on.consentSource).toBe('settings');
            expect(on.consentedAt?.getTime()).toBeGreaterThan(
                first.consentedAt?.getTime() ?? Infinity
            );
        });

        it('꺼진 채 처음 저장하면 출처도 동의 시각도 비어 있다', async () => {
            const userId = await createMember();

            const record = await repo.upsert({
                ...INPUT,
                userId,
                enabled: false,
            });

            expect(record.consentSource).toBeNull();
            expect(record.consentedAt).toBeNull();
        });

        it('첫 리포트 발송 기록 테이블은 비어 있고, 상태 CHECK와 회원 삭제 연쇄가 동작한다', async () => {
            const [{ count }] = await client<{ count: number }[]>`
                SELECT count(*)::int AS count FROM email_report_welcomes`;
            expect(count).toBe(0);

            const userId = await createMember();
            await expect(
                client`INSERT INTO email_report_welcomes (user_id, status)
                    VALUES (${userId}, 'bogus')`
            ).rejects.toThrow(/email_report_welcomes_status_check/);

            await client`INSERT INTO email_report_welcomes (user_id, status)
                VALUES (${userId}, 'sending')`;
            await client`DELETE FROM users WHERE id = ${userId}`;
            const [{ remaining }] = await client<{ remaining: number }[]>`
                SELECT count(*)::int AS remaining FROM email_report_welcomes
                WHERE user_id = ${userId}`;
            expect(remaining).toBe(0);
        });
    }
);
