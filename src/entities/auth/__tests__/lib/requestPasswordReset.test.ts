import { requestPasswordReset } from '@/entities/auth/lib/requestPasswordReset';
import type { RequestPasswordResetDependencies } from '@/entities/auth/lib/authUseCaseTypes';
import {
    PASSWORD_RESET_RATE_LIMITS,
    PASSWORD_RESET_TTL_SECONDS,
} from '@/entities/auth/lib/authUseCaseConstants';
import { hashEmailToken } from '@/entities/auth/lib/tokenUtils';
import type { EmailMessage } from '@/shared/email/types';
import type { EmailAuthUserRecord } from '@/shared/db/types';
import { createFakeFixedWindowLimiter } from '@/shared/test-utils/fakeFixedWindowLimiter';

const IP_HASH = 'iphash';
const EMAIL_HASH = hashEmailToken('user@example.com');
const KEYS = {
    ipHour: `auth:reset-req:ip:h:${IP_HASH}`,
    ipDay: `auth:reset-req:ip:d:${IP_HASH}`,
    cooldown: `auth:reset-req:e:cd:${EMAIL_HASH}`,
    emailHour: `auth:reset-req:e:h:${EMAIL_HASH}`,
    emailDay: `auth:reset-req:e:d:${EMAIL_HASH}`,
} as const;

const createdAt = new Date('2026-04-27T00:00:00.000Z');
const updatedAt = new Date('2026-04-27T00:00:01.000Z');

const user: EmailAuthUserRecord = {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'existing-password-hash',
    name: null,
    avatarUrl: null,
    tier: 'free',
    emailVerified: true,
    createdAt,
    updatedAt,
};

function makeBuildMessage(): {
    buildMessage: (token: string) => EmailMessage;
    calls: string[];
} {
    const calls: string[] = [];
    return {
        buildMessage: (token: string) => {
            calls.push(token);
            return {
                to: 'user@example.com',
                subject: 'Reset your password',
                html: `<a href="https://example.com/reset?token=${token}">Reset</a>`,
                text: `Reset: https://example.com/reset?token=${token}`,
            };
        },
        calls,
    };
}

function makeDependencies(options?: {
    user?: EmailAuthUserRecord | null;
    sendEmailResolves?: boolean;
    sendEmailThrows?: boolean;
    /** 이 키의 한도 확인만 거부한다. 나머지는 실제 카운팅 가짜 한도를 쓴다. */
    blockKey?: string;
}): {
    dependencies: RequestPasswordResetDependencies;
    limiter: ReturnType<typeof createFakeFixedWindowLimiter>;
    findEmailAuthUserByEmail: ReturnType<typeof vi.fn>;
    setToken: ReturnType<typeof vi.fn>;
    sendEmail: ReturnType<typeof vi.fn>;
    /** 응답 뒤로 미룬 작업. 실행하기 전에는 아무 것도 하지 않은 것과 같다. */
    deferred: Array<() => Promise<void>>;
    runDeferred: () => Promise<void>;
} {
    const deferred: Array<() => Promise<void>> = [];
    const limiter = createFakeFixedWindowLimiter();
    const blockKey = options?.blockKey;
    const foundUser = options && 'user' in options ? options.user : user;
    const findEmailAuthUserByEmail = vi.fn().mockResolvedValue(foundUser);
    const setToken = vi.fn().mockResolvedValue(undefined);

    const sendEmailThrows = options?.sendEmailThrows ?? false;
    const sendEmailResolves = options?.sendEmailResolves ?? true;
    const sendEmail = sendEmailThrows
        ? vi.fn().mockRejectedValue(new Error('smtp error'))
        : vi.fn().mockResolvedValue(sendEmailResolves);

    return {
        dependencies: {
            users: { findEmailAuthUserByEmail },
            emailTokens: {
                set: setToken,
                get: vi.fn(),
                delete: vi.fn(),
                consume: vi.fn(),
            },
            emailDispatcher: { sendEmail },
            rateLimit: async rule => {
                const allowed = await limiter.rateLimit(rule);
                return allowed && rule.key !== blockKey;
            },
            ipHash: async () => IP_HASH,
            deferDispatch: task => {
                deferred.push(task);
            },
        },
        limiter,
        findEmailAuthUserByEmail,
        setToken,
        sendEmail,
        deferred,
        runDeferred: async () => {
            await Promise.all(deferred.map(task => task()));
        },
    };
}

describe('requestPasswordReset', () => {
    it('returns ok without dispatching for an invalid email without repository access', async () => {
        const { dependencies, findEmailAuthUserByEmail, setToken, sendEmail } =
            makeDependencies();
        const { buildMessage, calls } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: 'not-an-email' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({ ok: true });
        expect(findEmailAuthUserByEmail).not.toHaveBeenCalled();
        expect(setToken).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
        expect(calls).toHaveLength(0);
    });

    it('returns ok without dispatching when no account matches the email', async () => {
        const { dependencies, findEmailAuthUserByEmail, setToken, sendEmail } =
            makeDependencies({ user: null });
        const { buildMessage } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: ' Missing@Example.COM ' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({ ok: true });
        expect(findEmailAuthUserByEmail).toHaveBeenCalledWith(
            'missing@example.com'
        );
        expect(setToken).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('returns ok without dispatching for OAuth-only accounts without a password hash', async () => {
        const { dependencies, setToken, sendEmail } = makeDependencies({
            user: { ...user, passwordHash: null },
        });
        const { buildMessage } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: 'user@example.com' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({ ok: true });
        expect(setToken).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('persists a token hash and dispatches the email once the deferred task runs', async () => {
        const { dependencies, setToken, sendEmail, deferred, runDeferred } =
            makeDependencies();
        const { buildMessage, calls } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: ' User@Example.COM ' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({ ok: true });
        // 응답 경로에서는 토큰 저장도 메일 발송도 기다리지 않는다.
        expect(deferred).toHaveLength(1);
        expect(setToken).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();

        await runDeferred();

        expect(setToken).toHaveBeenCalledTimes(1);
        const [purpose, email, value, ttl] = setToken.mock.calls[0] as [
            string,
            string,
            { status: 'pending'; tokenHash: string },
            number,
        ];
        expect(purpose).toBe('password_reset');
        expect(email).toBe('user@example.com');
        expect(value.status).toBe('pending');
        expect(value.tokenHash).toBe(hashEmailToken(calls[0]!));
        expect(ttl).toBe(PASSWORD_RESET_TTL_SECONDS);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'user@example.com',
                subject: 'Reset your password',
            })
        );
    });

    it('sends the mail only after the token is stored', async () => {
        const { dependencies, setToken, sendEmail, runDeferred } =
            makeDependencies();
        const order: string[] = [];
        setToken.mockImplementation(async () => {
            order.push('set');
        });
        sendEmail.mockImplementation(async () => {
            order.push('send');
            return true;
        });
        const { buildMessage } = makeBuildMessage();

        await requestPasswordReset(
            { email: 'user@example.com' },
            dependencies,
            {
                buildMessage,
            }
        );
        await runDeferred();

        expect(order).toEqual(['set', 'send']);
    });

    it('keeps the response identical when the deferred dispatch fails, and logs it without secrets', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const { dependencies, runDeferred } = makeDependencies({
                sendEmailThrows: true,
            });
            const { buildMessage } = makeBuildMessage();

            const result = await requestPasswordReset(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );
            await expect(runDeferred()).resolves.toBeUndefined();

            expect(result).toEqual({ ok: true });
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('[requestPasswordReset]'),
                expect.anything()
            );
        } finally {
            warn.mockRestore();
        }
    });

    describe('응답 시간 동등성(N69)', () => {
        /**
         * 시계를 재지 않고 "응답 전에 기다린 일"의 순서를 비교한다. 계정이 있을 때만 하는
         * I/O(토큰 저장·메일 발송)가 응답 경로에 들어오면 두 로그가 달라진다.
         */
        async function awaitedCalls(
            foundUser: EmailAuthUserRecord | null
        ): Promise<string[]> {
            const { dependencies, setToken, sendEmail } = makeDependencies({
                user: foundUser,
            });
            const log: string[] = [];
            const rateLimit = dependencies.rateLimit;
            dependencies.rateLimit = async rule => {
                log.push(`rateLimit:${rule.key}`);
                return rateLimit(rule);
            };
            const findUser = dependencies.users.findEmailAuthUserByEmail;
            dependencies.users = {
                findEmailAuthUserByEmail: async email => {
                    log.push('findUser');
                    return findUser(email);
                },
            };
            // 발송이 영원히 끝나지 않아도 응답은 나가야 한다.
            setToken.mockImplementation(() => new Promise(() => {}));
            sendEmail.mockImplementation(() => new Promise(() => {}));
            const { buildMessage } = makeBuildMessage();

            const result = await requestPasswordReset(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );
            expect(result).toEqual({ ok: true });
            log.push(`setToken:${setToken.mock.calls.length}`);
            log.push(`sendEmail:${sendEmail.mock.calls.length}`);
            return log;
        }

        it('awaits exactly the same work whether or not the account exists', async () => {
            const existing = await awaitedCalls(user);
            const missing = await awaitedCalls(null);
            const oauthOnly = await awaitedCalls({
                ...user,
                passwordHash: null,
            });

            expect(existing).toEqual(missing);
            expect(existing).toEqual(oauthOnly);
            expect(existing).toContain('findUser');
            expect(existing.slice(-2)).toEqual(['setToken:0', 'sendEmail:0']);
        });
    });

    describe('남용 한도', () => {
        it('declares the agreed limits', () => {
            expect(PASSWORD_RESET_RATE_LIMITS).toEqual({
                requestPerIpHour: { limit: 20, windowSeconds: 3600 },
                requestPerIpDay: { limit: 50, windowSeconds: 86400 },
                requestCooldownPerEmail: { limit: 1, windowSeconds: 60 },
                requestPerEmailHour: { limit: 5, windowSeconds: 3600 },
                requestPerEmailDay: { limit: 10, windowSeconds: 86400 },
                confirmPerIp: { limit: 20, windowSeconds: 1800 },
            });
        });

        it.each(Object.entries(KEYS))(
            'returns rate_limited without a lookup, token or mail when the %s rule blocks',
            async (_name, key) => {
                const {
                    dependencies,
                    findEmailAuthUserByEmail,
                    setToken,
                    sendEmail,
                } = makeDependencies({ blockKey: key });
                const { buildMessage, calls } = makeBuildMessage();

                const result = await requestPasswordReset(
                    { email: 'user@example.com' },
                    dependencies,
                    { buildMessage }
                );

                expect(result).toEqual({ ok: false, reason: 'rate_limited' });
                expect(findEmailAuthUserByEmail).not.toHaveBeenCalled();
                expect(setToken).not.toHaveBeenCalled();
                expect(sendEmail).not.toHaveBeenCalled();
                expect(calls).toHaveLength(0);
            }
        );

        it.each([
            ['ipHour', 20, KEYS.ipHour],
            ['ipDay', 50, KEYS.ipDay],
            ['emailHour', 5, KEYS.emailHour],
            ['emailDay', 10, KEYS.emailDay],
        ] as const)(
            'sends the rule key and the agreed limit for %s',
            async (_name, limit, key) => {
                const { dependencies, limiter } = makeDependencies();
                const { buildMessage } = makeBuildMessage();

                await requestPasswordReset(
                    { email: 'user@example.com' },
                    dependencies,
                    { buildMessage }
                );

                expect(
                    limiter.calls.find(rule => rule.key === key)?.limit
                ).toBe(limit);
            }
        );

        it('uses a 60 second single-request window for the per-address cooldown', async () => {
            const { dependencies, limiter } = makeDependencies();
            const { buildMessage } = makeBuildMessage();

            await requestPasswordReset(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );

            expect(
                limiter.calls.find(rule => rule.key === KEYS.cooldown)
            ).toMatchObject({ limit: 1, windowSeconds: 60 });
        });

        it('counts the limiter before the account lookup', async () => {
            const { dependencies, limiter, findEmailAuthUserByEmail } =
                makeDependencies();
            const rateLimit = vi.spyOn(dependencies, 'rateLimit');
            const { buildMessage } = makeBuildMessage();

            await requestPasswordReset(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );

            expect(limiter.calls.length).toBeGreaterThan(0);
            expect(
                Math.max(...rateLimit.mock.invocationCallOrder)
            ).toBeLessThan(
                Math.min(...findEmailAuthUserByEmail.mock.invocationCallOrder)
            );
        });

        it('does not spend the address slots when the IP rule blocks', async () => {
            const { dependencies, limiter } = makeDependencies({
                blockKey: KEYS.ipHour,
            });
            const { buildMessage } = makeBuildMessage();

            await requestPasswordReset(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );

            expect(limiter.calls.map(rule => rule.key)).toEqual([KEYS.ipHour]);
            expect(limiter.count(KEYS.cooldown)).toBe(0);
            expect(limiter.count(KEYS.emailHour)).toBe(0);
            expect(limiter.count(KEYS.emailDay)).toBe(0);
        });

        it('calls no limiter for an invalid email', async () => {
            const { dependencies, limiter } = makeDependencies();
            const { buildMessage } = makeBuildMessage();

            await requestPasswordReset(
                { email: 'not-an-email' },
                dependencies,
                { buildMessage }
            );

            expect(limiter.calls).toHaveLength(0);
        });

        it('consumes the same keys for an unknown address as for an existing one', async () => {
            const known = makeDependencies();
            const unknown = makeDependencies({ user: null });
            const { buildMessage } = makeBuildMessage();

            await requestPasswordReset(
                { email: 'user@example.com' },
                known.dependencies,
                { buildMessage }
            );
            await requestPasswordReset(
                { email: 'user@example.com' },
                unknown.dependencies,
                { buildMessage }
            );

            expect(unknown.limiter.calls).toEqual(known.limiter.calls);
        });

        it('keeps the raw email out of every limiter key', async () => {
            const { dependencies, limiter } = makeDependencies();
            const { buildMessage } = makeBuildMessage();

            await requestPasswordReset(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );

            expect(limiter.calls.length).toBeGreaterThan(0);
            expect(
                limiter.calls.filter(rule => rule.key.includes('example.com'))
            ).toEqual([]);
        });

        it('blocks the second request for one address within the cooldown but not another address', async () => {
            const { dependencies } = makeDependencies();
            const { buildMessage } = makeBuildMessage();
            const request = (email: string) =>
                requestPasswordReset({ email }, dependencies, {
                    buildMessage,
                });

            const first = await request('user@example.com');
            const second = await request('user@example.com');
            const other = await request('other@example.com');

            expect(first).toEqual({ ok: true });
            expect(second).toEqual({ ok: false, reason: 'rate_limited' });
            expect(other).toEqual({ ok: true });
        });
    });
});
