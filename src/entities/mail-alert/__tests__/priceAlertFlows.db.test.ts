import { drizzle } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/shared/db/schema';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import {
    DrizzleMailAlertSubscriberRepository,
    DrizzlePriceAlertRepository,
} from '../api';
import { PRICE_ALERT_MAX_ACTIVE } from '../lib/priceAlertConstants';
import type { PriceAlertProposal } from '../model';
import {
    createPriceAlertFlow,
    getPriceAlertProposalState,
    type PriceAlertFlowDeps,
} from '../server/priceAlertFlows';

vi.mock('server-only', () => ({}));

/**
 * 가격대 알림 만들기 흐름(`createPriceAlertFlow`·`getPriceAlertProposalState`)을 진짜 저장소와 진짜 Postgres에서
 * 본다(TESTING.md#TE-55): 제안의 값이 열에 그대로 들어가는지(숫자 6자리, 날짜, 분석 시각), 더블클릭 두 요청이 알림
 * 하나만 만드는지, 비회원 쿠키가 회원에게 연결된 행을 가리켜도 거절되는지(DB-12), 상한이 실제 행 수로 막는지.
 * 서명·세션·Redis는 가짜다 — 이 파일이 보려는 것은 저장 규칙이다. `TEST_DATABASE_URL`이 없으면 건너뛴다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `price_alert_flow_test_${process.pid}`;
const NOW = new Date('2026-11-25T15:00:00Z');

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.replaceAll('"public".', ''));

function proposal(
    overrides: Partial<PriceAlertProposal> = {}
): PriceAlertProposal {
    return {
        proposalId: randomUUID(),
        subject: 'subject',
        symbol: 'AAPL',
        market: 'us',
        condition: { kind: 'close_below', level: 180.25 },
        basis: 'price_level',
        analysisAt: null,
        referenceClose: 190.5,
        quoteAt: null,
        startsAfterSession: '2026-11-24',
        expiresOn: '2026-12-24',
        exp: Math.floor(NOW.getTime() / 1000) + 3_600,
        ...overrides,
    };
}

function member(id: string, email: string): AuthUserRecord {
    return {
        id,
        email,
        name: null,
        avatarUrl: null,
        tier: 'member',
        emailVerified: true,
        createdAt: NOW,
        updatedAt: NOW,
    };
}

describe.skipIf(!URL)(
    '가격대 알림 만들기 흐름이 진짜 Postgres에서 규칙대로 동작한다',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: 8,
            connection: { search_path: SCHEMA },
        });
        const db = drizzle(client, { schema });
        const subscribers = new DrizzleMailAlertSubscriberRepository(db);
        const priceAlerts = new DrizzlePriceAlertRepository(db);

        function depsFor(
            account: AuthUserRecord | null,
            current: { proposal: PriceAlertProposal; cookie: string | null }
        ): PriceAlertFlowDeps {
            return {
                launched: true,
                signingReady: true,
                subscribers,
                users: {
                    findByEmail: async (email: string) =>
                        account?.email === email ? account : null,
                } as PriceAlertFlowDeps['users'],
                currentUser: async () => account,
                guestCookie: {
                    read: async () => current.cookie,
                    write: async (id: string) => {
                        current.cookie = id;
                    },
                    clear: async () => {
                        current.cookie = null;
                    },
                },
                verifyLink: () => false,
                rateLimit: async () => true,
                resetCounter: async () => {},
                ipHash: async () => 'ip-hash',
                emailTokens: null,
                emailDispatcher: { sendEmail: async () => true },
                buildCodeMessage: (to, code) => ({
                    to,
                    subject: 'code',
                    html: code,
                    text: code,
                }),
                locale: 'ko',
                priceAlertsEnabled: true,
                priceAlerts,
                verifyProposal: () => current.proposal,
                callerSubject: async () => current.proposal.subject,
                readReference: async () => null,
                now: () => NOW.getTime(),
            };
        }

        async function insertUser(email: string): Promise<AuthUserRecord> {
            const [row] = await client<{ id: string }[]>`
                INSERT INTO users (email, email_verified) VALUES (${email}, true) RETURNING id`;
            return member(row?.id ?? '', email);
        }

        async function alertRows(subscriberId: string) {
            return client<Record<string, unknown>[]>`
                SELECT symbol, market, condition, approach, zone_low::text AS zone_low, zone_high::text AS zone_high,
                       level::text AS level, basis, analysis_at, reference_close::text AS reference_close,
                       to_char(starts_after_session, 'YYYY-MM-DD') AS starts_after_session,
                       to_char(expires_on, 'YYYY-MM-DD') AS expires_on, status
                FROM price_alerts WHERE subscriber_id = ${subscriberId}`;
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
            await migration('0063_mail_alerts.sql').reduce(
                (previous, statement) =>
                    previous.then(() =>
                        client.unsafe(statement).then(() => {})
                    ),
                Promise.resolve()
            );
            await migration('0065_price_alerts.sql').reduce(
                (previous, statement) =>
                    previous.then(() =>
                        client.unsafe(statement).then(() => {})
                    ),
                Promise.resolve()
            );
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        it('인증된 회원이 만들면 agent_chat 동의의 구독자 행과 제안의 값 그대로의 알림 행이 생긴다(구간 + 분석 시각)', async () => {
            const user = await insertUser('flow-member@example.com');
            const current = {
                proposal: proposal({
                    symbol: '005930.KS',
                    market: 'kr',
                    basis: 'analysis_entry_zone',
                    analysisAt: '2026-11-25T12:00:00.000Z',
                    referenceClose: 70_500,
                    condition: {
                        kind: 'enter_zone',
                        low: 68_000.5,
                        high: 69_500,
                        approach: 'from_above',
                    },
                    startsAfterSession: '2026-11-25',
                    expiresOn: '2026-12-24',
                }),
                cookie: null,
            };

            const result = await createPriceAlertFlow(
                depsFor(user, current),
                'token'
            );

            expect(result).toMatchObject({ status: 'created' });
            const row = await subscribers.findForMember(user.id);
            expect(row?.consentSource).toBe('agent_chat');
            const [alert] = await alertRows(row?.id ?? '');
            expect(alert).toMatchObject({
                symbol: '005930.KS',
                market: 'kr',
                condition: 'enter_zone',
                approach: 'from_above',
                zone_low: '68000.500000',
                zone_high: '69500.000000',
                level: null,
                basis: 'analysis_entry_zone',
                reference_close: '70500.000000',
                starts_after_session: '2026-11-25',
                expires_on: '2026-12-24',
                status: 'active',
            });
            expect(new Date(alert?.analysis_at as string).toISOString()).toBe(
                '2026-11-25T12:00:00.000Z'
            );
        });

        it('같은 제안을 동시에 두 번 눌러도(더블클릭) 알림은 하나이고 둘 다 created다', async () => {
            const user = await insertUser('flow-double@example.com');
            const current = { proposal: proposal(), cookie: null };

            const [first, second] = await Promise.all([
                createPriceAlertFlow(depsFor(user, current), 'token'),
                createPriceAlertFlow(depsFor(user, current), 'token'),
            ]);

            expect(first).toMatchObject({ status: 'created' });
            expect(second).toMatchObject({ status: 'created' });
            const row = await subscribers.findForMember(user.id);
            expect(await alertRows(row?.id ?? '')).toHaveLength(1);
            await expect(
                getPriceAlertProposalState(depsFor(user, current), 'token')
            ).resolves.toMatchObject({ status: 'created' });
        });

        it('같은 가격대의 다른 제안은 exists, 다른 가격이면 만들어진다', async () => {
            const user = await insertUser('flow-dup@example.com');
            const base = { proposal: proposal(), cookie: null };
            await createPriceAlertFlow(depsFor(user, base), 'token');

            const same = { proposal: proposal(), cookie: null };
            const other = {
                proposal: proposal({
                    condition: { kind: 'close_below', level: 170 },
                }),
                cookie: null,
            };

            await expect(
                createPriceAlertFlow(depsFor(user, same), 'token')
            ).resolves.toEqual({ status: 'exists' });
            await expect(
                createPriceAlertFlow(depsFor(user, other), 'token')
            ).resolves.toMatchObject({ status: 'created' });
        });

        it('살아 있는 알림이 상한(10)이면 limit_reached이고 상태도 limit_reached다', async () => {
            const user = await insertUser('flow-limit@example.com');
            for (let i = 0; i < PRICE_ALERT_MAX_ACTIVE; i += 1) {
                const current = {
                    proposal: proposal({
                        condition: { kind: 'close_below', level: 100 + i },
                    }),
                    cookie: null,
                };
                await createPriceAlertFlow(depsFor(user, current), 'token');
            }
            const extra = {
                proposal: proposal({
                    condition: { kind: 'close_below', level: 50 },
                }),
                cookie: null,
            };

            await expect(
                createPriceAlertFlow(depsFor(user, extra), 'token')
            ).resolves.toEqual({ status: 'limit_reached' });
            await expect(
                getPriceAlertProposalState(depsFor(user, extra), 'token')
            ).resolves.toEqual({ status: 'limit_reached' });
            const row = await subscribers.findForMember(user.id);
            expect(await alertRows(row?.id ?? '')).toHaveLength(
                PRICE_ALERT_MAX_ACTIVE
            );
        });

        it('비회원 쿠키가 가리키는 구독자(코드 확인을 마친 브라우저)에는 만든다', async () => {
            const { id } = await subscribers.upsertVerified({
                email: 'flow-guest@example.com',
                locale: 'ko',
                consentSource: 'symbol',
            });
            const current = {
                proposal: proposal(),
                cookie: id as string | null,
            };

            const result = await createPriceAlertFlow(
                depsFor(null, current),
                'token'
            );

            expect(result).toMatchObject({ status: 'created' });
            expect(await alertRows(id)).toHaveLength(1);
        });

        it('쿠키가 회원에게 연결된 구독자 id를 가리켜도 그 행에는 아무것도 만들지 못한다(DB-12)', async () => {
            const owner = await insertUser('flow-owned@example.com');
            const { id } = await subscribers.upsertVerified({
                email: 'flow-owned@example.com',
                locale: 'ko',
                consentSource: 'symbol',
            });
            await subscribers.linkVerifiedMember(owner.id, id);
            const current = {
                proposal: proposal(),
                cookie: id as string | null,
            };

            const result = await createPriceAlertFlow(
                depsFor(null, current),
                'token'
            );

            expect(result).toEqual({ status: 'needs_code' });
            expect(await alertRows(id)).toHaveLength(0);
            // 쿠키는 낡은 것으로 보고 비운다.
            expect(current.cookie).toBeNull();
        });

        it('이메일 인증 전 회원이나 알아볼 수 없는 방문자는 needs_code이고 DB에 아무것도 남기지 않는다', async () => {
            const before = await client<{ n: number }[]>`
                SELECT count(*)::int AS n FROM price_alerts`;
            const current = { proposal: proposal(), cookie: null };

            await expect(
                createPriceAlertFlow(depsFor(null, current), 'token')
            ).resolves.toEqual({ status: 'needs_code' });

            const after = await client<{ n: number }[]>`
                SELECT count(*)::int AS n FROM price_alerts`;
            expect(after[0]?.n).toBe(before[0]?.n);
        });
    }
);
