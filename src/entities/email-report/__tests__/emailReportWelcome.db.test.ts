import { readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import { DrizzleEmailReportWelcomeRepository } from '../api';

vi.mock('server-only', () => ({}));

/**
 * 가입 첫 리포트의 선점(`claimDue`)이 진짜 Postgres에서 "회원당 한 번"과 재시도 한도를 지키는지 본다
 * (TESTING.md#TE-55). 모킹된 DB로는 `ON CONFLICT DO NOTHING`이 진 쪽에 행을 돌려주지 않는다는 점,
 * 갱신의 행 잠금 재평가, CHECK, 회원 삭제 연쇄가 보이지 않는다.
 * `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --name <unique> -e POSTGRES_PASSWORD=x -e POSTGRES_USER=siglens -e POSTGRES_DB=siglens_test \
 *     -p 127.0.0.1:55432:5432 --pull never postgres:17-alpine
 *   TEST_DATABASE_URL=postgres://siglens:x@127.0.0.1:55432/siglens_test yarn test emailReportWelcome.db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 `0041_email_reports.sql`과
 * `0062_email_report_consent_and_welcome.sql`을 적용하고 끝나면 스키마를 지운다. `users`는 FK와
 * 대상 조건(이메일 인증, 등급)에 필요한 열만 둔 최소 테이블이다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `email_report_welcome_test_${process.pid}`;

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.replace('"public"."users"', '"users"'));

interface MemberOptions {
    consentSource?: string | null;
    enabled?: boolean;
    verified?: boolean;
    tier?: string;
    /** 동의한 지 몇 분이 지났는가. */
    consentedMinutesAgo?: number;
}

describe.skipIf(!URL)(
    '가입 첫 리포트 선점이 진짜 Postgres에서 한 번만, 한도 안에서 잡힌다',
    () => {
        const admin = postgres(URL as string, {
            max: 1,
            onnotice: () => {},
        });
        const client = postgres(URL as string, {
            max: 4,
            connection: { search_path: SCHEMA },
        });
        const repo = new DrizzleEmailReportWelcomeRepository(
            drizzle(client, { schema })
        );

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

        /** 회원과 그 구독 행을 만들고 회원 id를 돌려준다. 기본값은 "대상이 되는 회원"이다. */
        async function createMember(
            options: MemberOptions = {}
        ): Promise<string> {
            const {
                consentSource = 'signup_email',
                enabled = true,
                verified = true,
                tier = 'member',
                consentedMinutesAgo = 10,
            } = options;
            const [user] = await client<{ id: string }[]>`
                INSERT INTO users (email, email_verified, tier)
                VALUES (${`m-${Math.random().toString(36).slice(2)}@example.com`}, ${verified}, ${tier})
                RETURNING id`;
            await client`INSERT INTO email_report_subscriptions
                (user_id, enabled, days_of_week, send_hour, timezone, locale, consented_at, consent_source)
                VALUES (${user.id}, ${enabled}, 2, 8, 'Asia/Seoul', 'ko',
                    now() - make_interval(mins => ${consentedMinutesAgo}), ${consentSource})`;
            return user.id;
        }

        async function welcomeRow(userId: string) {
            const [row] = await client<
                {
                    status: string;
                    attempts: number;
                    error: string | null;
                    sent_at: string | null;
                }[]
            >`SELECT status, attempts, error, sent_at
              FROM email_report_welcomes WHERE user_id = ${userId}`;
            return row;
        }

        const ids = (claimed: readonly { userId: string }[]) =>
            claimed.map(r => r.userId);

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
                `CREATE TABLE "users" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                    "email" text,
                    "email_verified" boolean DEFAULT false NOT NULL,
                    "tier" text DEFAULT 'member' NOT NULL
                )`
            );
            await runInOrder(migration('0041_email_reports.sql'));
            await runInOrder(
                migration('0062_email_report_consent_and_welcome.sql')
            );
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        it('가입 화면에서 고른, 켜져 있고, 인증됐고, 회원 등급이고, 24시간 안에 동의한 회원만 잡는다', async () => {
            const eligibleEmail = await createMember({
                consentSource: 'signup_email',
            });
            const eligibleOAuth = await createMember({
                consentSource: 'signup_oauth',
            });
            const proMember = await createMember({ tier: 'pro' });
            const fromSettings = await createMember({
                consentSource: 'settings',
            });
            const neverSource = await createMember({ consentSource: null });
            const disabled = await createMember({ enabled: false });
            const unverified = await createMember({ verified: false });
            const freeTier = await createMember({ tier: 'free' });
            const tooOld = await createMember({
                consentedMinutesAgo: 24 * 60 + 5,
            });

            const claimed = await repo.claimDue(new Date());

            const mine = new Set([
                eligibleEmail,
                eligibleOAuth,
                proMember,
                fromSettings,
                neverSource,
                disabled,
                unverified,
                freeTier,
                tooOld,
            ]);
            expect(
                ids(claimed)
                    .filter(id => mine.has(id))
                    .sort()
            ).toEqual([eligibleEmail, eligibleOAuth, proMember].sort());
            expect(await welcomeRow(eligibleEmail)).toMatchObject({
                status: 'sending',
                attempts: 1,
            });
            expect(await welcomeRow(fromSettings)).toBeUndefined();
            expect(await welcomeRow(tooOld)).toBeUndefined();
        });

        it('수신자 정보(주소, 일정, 시간대, 로케일, 동의 시각, 시도 횟수)를 함께 돌려준다', async () => {
            const userId = await createMember();

            const claimed = await repo.claimDue(new Date());

            const mine = claimed.find(r => r.userId === userId);
            expect(mine).toMatchObject({
                daysOfWeek: 2,
                sendHour: 8,
                timezone: 'Asia/Seoul',
                locale: 'ko',
                attempts: 1,
            });
            expect(mine?.email).toMatch(/@example\.com$/);
            expect(mine?.consentedAt).toBeInstanceOf(Date);
        });

        it('두 번째 선점은 같은 회원을 다시 돌려주지 않는다(한 번만)', async () => {
            const userId = await createMember();

            const first = await repo.claimDue(new Date());
            const second = await repo.claimDue(new Date());

            expect(ids(first)).toContain(userId);
            expect(ids(second)).not.toContain(userId);
        });

        it('겹쳐 도는 두 실행이 같은 회원을 함께 잡지 못한다', async () => {
            const userId = await createMember();

            const [a, b] = await Promise.all([
                repo.claimDue(new Date()),
                repo.claimDue(new Date()),
            ]);

            const winners = [...ids(a), ...ids(b)].filter(id => id === userId);
            expect(winners).toEqual([userId]);
        });

        it('보냈다고 기록한 회원은 보낸 시각이 찍히고 다시 잡히지 않는다', async () => {
            const userId = await createMember();
            await repo.claimDue(new Date());

            await repo.finish(userId, 'sent', null);

            const row = await welcomeRow(userId);
            expect(row.status).toBe('sent');
            expect(row.sent_at).not.toBeNull();
            expect(ids(await repo.claimDue(new Date()))).not.toContain(userId);
        });

        it('실패한 건은 시도 횟수가 3이 될 때까지만 다시 잡힌다', async () => {
            const userId = await createMember();
            await repo.claimDue(new Date());
            await repo.finish(userId, 'failed', 'dispatcher rejected');
            expect((await welcomeRow(userId)).sent_at).toBeNull();

            const second = await repo.claimDue(new Date());
            expect(second.find(r => r.userId === userId)?.attempts).toBe(2);
            await repo.finish(userId, 'failed', 'dispatcher rejected');

            const third = await repo.claimDue(new Date());
            expect(third.find(r => r.userId === userId)?.attempts).toBe(3);
            await repo.finish(userId, 'failed', 'dispatcher rejected');

            expect(ids(await repo.claimDue(new Date()))).not.toContain(userId);
            expect(await welcomeRow(userId)).toMatchObject({
                status: 'failed',
                attempts: 3,
                error: 'dispatcher rejected',
            });
        });

        it('30분 넘게 sending으로 멈춘 행은 다시 잡고, 그보다 어린 행은 잡지 않는다', async () => {
            const stale = await createMember();
            const fresh = await createMember();
            await repo.claimDue(new Date());
            await client`UPDATE email_report_welcomes
                SET updated_at = now() - interval '31 minutes'
                WHERE user_id = ${stale}`;
            await client`UPDATE email_report_welcomes
                SET updated_at = now() - interval '29 minutes'
                WHERE user_id = ${fresh}`;

            const claimed = await repo.claimDue(new Date());

            expect(claimed.find(r => r.userId === stale)?.attempts).toBe(2);
            expect(ids(claimed)).not.toContain(fresh);
            expect((await welcomeRow(fresh)).attempts).toBe(1);
        });

        it('동의한 지 24시간이 지나면 실패한 건도 다시 잡지 않는다', async () => {
            const userId = await createMember();
            await repo.claimDue(new Date());
            await repo.finish(userId, 'failed', 'dispatcher rejected');
            await client`UPDATE email_report_subscriptions
                SET consented_at = now() - interval '25 hours'
                WHERE user_id = ${userId}`;

            expect(ids(await repo.claimDue(new Date()))).not.toContain(userId);
            expect((await welcomeRow(userId)).attempts).toBe(1);
        });

        it('수신을 끈 회원의 실패한 건은 다시 잡지 않는다', async () => {
            const userId = await createMember();
            await repo.claimDue(new Date());
            await repo.finish(userId, 'failed', 'dispatcher rejected');
            await client`UPDATE email_report_subscriptions
                SET enabled = false WHERE user_id = ${userId}`;

            expect(ids(await repo.claimDue(new Date()))).not.toContain(userId);
        });

        it('findWelcomed는 최근 보낸 회원과 처리 중인 회원만 돌려준다', async () => {
            const recent = await createMember();
            const old = await createMember();
            const failed = await createMember();
            const inFlight = await createMember();
            const stale = await createMember();
            await repo.claimDue(new Date());
            await repo.finish(recent, 'sent', null);
            await repo.finish(old, 'sent', null);
            await repo.finish(failed, 'failed', 'x');
            await client`UPDATE email_report_welcomes
                SET sent_at = now() - interval '13 hours'
                WHERE user_id = ${old}`;

            // `inFlight`와 `stale`은 선점만 하고 기록하지 않아 sending으로 남는다.
            await client`UPDATE email_report_welcomes
                SET updated_at = now() - interval '31 minutes'
                WHERE user_id = ${stale}`;

            const welcomed = await repo.findWelcomed(
                new Date(Date.now() - 12 * 60 * 60 * 1000),
                new Date(Date.now() - 30 * 60 * 1000)
            );

            expect(welcomed.has(recent)).toBe(true);
            expect(welcomed.has(old)).toBe(false);
            expect(welcomed.has(failed)).toBe(false);
            // 겹친 실행이 보내는 중일 수 있는 처리 중 행은 건너뛰고, 멈춘 지 오래된 행은 아니다.
            expect(welcomed.has(inFlight)).toBe(true);
            expect(welcomed.has(stale)).toBe(false);
        });

        it('이미 sent인 행은 failed·retry로 덮어쓰지 않는다', async () => {
            const userId = await createMember();
            await repo.claimDue(new Date());
            await repo.finish(userId, 'sent', null);

            await repo.finish(userId, 'failed', 'late failure');
            await repo.finish(userId, 'retry', 'late retry');

            expect(await welcomeRow(userId)).toMatchObject({
                status: 'sent',
                attempts: 1,
                error: null,
            });
        });

        it('retry는 시도 횟수를 되돌려, 다음 실행이 같은 횟수로 다시 잡는다', async () => {
            const userId = await createMember();
            await repo.claimDue(new Date());

            await repo.finish(userId, 'retry', 'request in flight');

            expect(await welcomeRow(userId)).toMatchObject({
                status: 'failed',
                attempts: 0,
            });
            const again = await repo.claimDue(new Date());
            expect(again.find(r => r.userId === userId)?.attempts).toBe(1);
        });

        it('동의한 뒤 정기 리포트가 이미 나간 회원은 첫 리포트 대상이 아니다', async () => {
            const regularFirst = await createMember();
            const regularBeforeConsent = await createMember();
            const regularFailed = await createMember();
            await client`INSERT INTO email_report_deliveries (user_id, local_date, status)
                VALUES (${regularFirst}, current_date, 'sent'),
                       (${regularBeforeConsent}, current_date, 'sent'),
                       (${regularFailed}, current_date, 'failed')`;
            // 동의보다 앞선 발송은 막지 않는다.
            await client`UPDATE email_report_deliveries
                SET updated_at = now() - interval '1 hour'
                WHERE user_id = ${regularBeforeConsent}`;

            const claimed = ids(await repo.claimDue(new Date()));

            expect(claimed).not.toContain(regularFirst);
            expect(claimed).toContain(regularBeforeConsent);
            expect(claimed).toContain(regularFailed);
        });

        it('정기 리포트가 나간 뒤에는 실패한 첫 리포트도 다시 잡지 않는다', async () => {
            const userId = await createMember();
            await repo.claimDue(new Date());
            await repo.finish(userId, 'failed', 'dispatcher rejected');
            await client`INSERT INTO email_report_deliveries (user_id, local_date, status)
                VALUES (${userId}, current_date, 'sent')`;

            expect(ids(await repo.claimDue(new Date()))).not.toContain(userId);
            expect((await welcomeRow(userId)).attempts).toBe(1);
        });

        it('앱 시계가 DB보다 앞서도 방금 삽입한 행을 같은 선점에서 다시 잡지 않는다', async () => {
            const userId = await createMember();

            const claimed = await repo.claimDue(
                new Date(Date.now() + 2 * 60 * 60 * 1000)
            );

            expect(claimed.find(r => r.userId === userId)?.attempts).toBe(1);
            expect((await welcomeRow(userId)).attempts).toBe(1);
        });

        it('90일보다 오래된 기록만 지운다', async () => {
            const oldId = await createMember();
            const newId = await createMember();
            await repo.claimDue(new Date());
            await client`UPDATE email_report_welcomes
                SET created_at = now() - interval '91 days'
                WHERE user_id = ${oldId}`;

            const deleted = await repo.pruneOlderThan(
                new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            );

            expect(deleted).toBeGreaterThanOrEqual(1);
            expect(await welcomeRow(oldId)).toBeUndefined();
            expect(await welcomeRow(newId)).toBeDefined();
        });

        it('회원을 지우면 첫 리포트 기록도 함께 지워진다', async () => {
            const userId = await createMember();
            await repo.claimDue(new Date());
            expect(await welcomeRow(userId)).toBeDefined();

            await client`DELETE FROM users WHERE id = ${userId}`;

            expect(await welcomeRow(userId)).toBeUndefined();
        });
    }
);
