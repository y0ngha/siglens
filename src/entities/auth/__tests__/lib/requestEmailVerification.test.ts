import { requestEmailVerification } from '@/entities/auth/lib/requestEmailVerification';
import type { RequestEmailVerificationDependencies } from '@/entities/auth/lib/authUseCaseTypes';
import {
    EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
    EMAIL_VERIFICATION_RATE_LIMITS,
} from '@/entities/auth/lib/authUseCaseConstants';
import { hashEmailToken } from '@/entities/auth/lib/tokenUtils';
import type { EmailMessage } from '@/shared/email/types';
import { createFakeFixedWindowLimiter } from '@/shared/test-utils/fakeFixedWindowLimiter';

const IP_HASH = 'iphash';
const EMAIL_HASH = hashEmailToken('user@example.com');
const ATTEMPTS_KEY = `auth:signup-verify:e:${EMAIL_HASH}`;
const KEYS = {
    ipHour: `auth:signup-code:ip:h:${IP_HASH}`,
    ipDay: `auth:signup-code:ip:d:${IP_HASH}`,
    cooldown: `auth:signup-code:e:cd:${EMAIL_HASH}`,
    emailHour: `auth:signup-code:e:h:${EMAIL_HASH}`,
    emailDay: `auth:signup-code:e:d:${EMAIL_HASH}`,
} as const;

function makeBuildMessage(): {
    buildMessage: (code: string) => EmailMessage;
    calls: string[];
} {
    const calls: string[] = [];
    return {
        buildMessage: (code: string) => {
            calls.push(code);
            return {
                to: 'user@example.com',
                subject: 'Verify your email',
                html: `<p>Code: <strong>${code}</strong></p>`,
                text: `Code: ${code}`,
            };
        },
        calls,
    };
}

function makeDependencies(options?: {
    sendEmailResolves?: boolean;
    sendEmailThrows?: boolean;
    /** 이 키의 한도 확인만 거부한다. 나머지는 실제 카운팅 가짜 한도를 쓴다. */
    blockKey?: string;
}): {
    dependencies: RequestEmailVerificationDependencies;
    setToken: ReturnType<typeof vi.fn>;
    sendEmail: ReturnType<typeof vi.fn>;
    limiter: ReturnType<typeof createFakeFixedWindowLimiter>;
} {
    const limiter = createFakeFixedWindowLimiter();
    const blockKey = options?.blockKey;
    const setToken = vi.fn().mockResolvedValue(undefined);
    const sendEmailThrows = options?.sendEmailThrows ?? false;
    const sendEmailResolves = options?.sendEmailResolves ?? true;
    const sendEmail = sendEmailThrows
        ? vi.fn().mockRejectedValue(new Error('smtp'))
        : vi.fn().mockResolvedValue(sendEmailResolves);

    return {
        dependencies: {
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
            resetCounter: limiter.resetCounter,
            ipHash: async () => IP_HASH,
        },
        setToken,
        sendEmail,
        limiter,
    };
}

describe('requestEmailVerification', () => {
    it('returns codeIssued false for an invalid email without dispatching', async () => {
        const { dependencies, setToken, sendEmail } = makeDependencies();
        const { buildMessage, calls } = makeBuildMessage();

        const result = await requestEmailVerification(
            { email: 'not-an-email' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({
            ok: true,
            codeIssued: false,
            emailDispatched: false,
        });
        expect(setToken).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
        expect(calls).toHaveLength(0);
    });

    it('persists a hashed pending code, dispatches email, and reports emailDispatched true', async () => {
        const { dependencies, setToken, sendEmail } = makeDependencies();
        const { buildMessage, calls } = makeBuildMessage();

        const result = await requestEmailVerification(
            { email: ' Tester@Example.COM ' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({
            ok: true,
            codeIssued: true,
            emailDispatched: true,
        });

        expect(calls).toHaveLength(1);
        const code = calls[0]!;
        expect(code).toMatch(/^\d{6}$/);

        expect(setToken).toHaveBeenCalledTimes(1);
        const [purpose, email, value, ttl] = setToken.mock.calls[0] as [
            string,
            string,
            { status: 'pending'; tokenHash: string },
            number,
        ];
        expect(purpose).toBe('email_verification');
        expect(email).toBe('tester@example.com');
        expect(value.status).toBe('pending');
        expect(value.tokenHash).toBe(hashEmailToken(code));
        expect(ttl).toBe(EMAIL_VERIFICATION_PENDING_TTL_SECONDS);

        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ subject: 'Verify your email' })
        );
    });

    describe.each([
        ['resolves false', { sendEmailResolves: false }],
        ['throws', { sendEmailThrows: true }],
    ] as const)('when the dispatcher %s', (_name, failure) => {
        it('returns email_send_failed instead of a sent state', async () => {
            const { dependencies } = makeDependencies(failure);
            const { buildMessage } = makeBuildMessage();

            const result = await requestEmailVerification(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );

            expect(result).toEqual({ ok: false, reason: 'email_send_failed' });
        });

        it('releases only the per-address cooldown and keeps every other counter', async () => {
            const { dependencies, limiter } = makeDependencies(failure);
            const { buildMessage } = makeBuildMessage();

            await requestEmailVerification(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );

            expect(limiter.count(KEYS.cooldown)).toBe(0);
            expect(limiter.count(KEYS.ipHour)).toBe(1);
            expect(limiter.count(KEYS.ipDay)).toBe(1);
            expect(limiter.count(KEYS.emailHour)).toBe(1);
            expect(limiter.count(KEYS.emailDay)).toBe(1);
        });

        it('keeps the pending record because the mail may still have been delivered', async () => {
            const { dependencies, setToken } = makeDependencies(failure);
            const { buildMessage } = makeBuildMessage();

            await requestEmailVerification(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );

            expect(setToken).toHaveBeenCalledTimes(1);
            expect(
                setToken.mock.calls.filter(
                    ([, , value]) => value.status === 'pending'
                )
            ).toHaveLength(1);
        });

        it('lets the next request through right away instead of rate_limited', async () => {
            const { dependencies } = makeDependencies(failure);
            const { buildMessage } = makeBuildMessage();
            const request = () =>
                requestEmailVerification(
                    { email: 'user@example.com' },
                    dependencies,
                    { buildMessage }
                );

            await request();
            const retry = await request();

            expect(retry).not.toEqual({ ok: false, reason: 'rate_limited' });
        });
    });

    it('keeps the cooldown after a successful send', async () => {
        const { dependencies, limiter } = makeDependencies();
        const { buildMessage } = makeBuildMessage();

        await requestEmailVerification(
            { email: 'user@example.com' },
            dependencies,
            { buildMessage }
        );

        expect(limiter.count(KEYS.cooldown)).toBe(1);
    });

    describe('남용 한도', () => {
        it('declares the agreed limits', () => {
            expect(EMAIL_VERIFICATION_RATE_LIMITS).toEqual({
                codePerIpHour: { limit: 20, windowSeconds: 3600 },
                codePerIpDay: { limit: 50, windowSeconds: 86400 },
                codeCooldownPerEmail: { limit: 1, windowSeconds: 60 },
                codePerEmailHour: { limit: 5, windowSeconds: 3600 },
                codePerEmailDay: { limit: 10, windowSeconds: 86400 },
                confirmPerIp: { limit: 30, windowSeconds: 1800 },
                attemptsPerEmail: { limit: 5, windowSeconds: 1800 },
            });
        });

        it.each(Object.entries(KEYS))(
            'returns rate_limited without storing or sending when the %s rule blocks',
            async (_name, key) => {
                const { dependencies, setToken, sendEmail } = makeDependencies({
                    blockKey: key,
                });
                const { buildMessage, calls } = makeBuildMessage();

                const result = await requestEmailVerification(
                    { email: 'user@example.com' },
                    dependencies,
                    { buildMessage }
                );

                expect(result).toEqual({ ok: false, reason: 'rate_limited' });
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

                await requestEmailVerification(
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

            await requestEmailVerification(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );

            expect(
                limiter.calls.find(rule => rule.key === KEYS.cooldown)
            ).toMatchObject({ limit: 1, windowSeconds: 60 });
        });

        it('does not spend the address slots when the IP rule blocks', async () => {
            const { dependencies, limiter } = makeDependencies({
                blockKey: KEYS.ipHour,
            });
            const { buildMessage } = makeBuildMessage();

            await requestEmailVerification(
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

            await requestEmailVerification(
                { email: 'not-an-email' },
                dependencies,
                { buildMessage }
            );

            expect(limiter.calls).toHaveLength(0);
        });

        it('resets the attempts counter of that address when a code is stored', async () => {
            const { dependencies, limiter } = makeDependencies();
            const { buildMessage } = makeBuildMessage();
            await limiter.rateLimit({
                key: ATTEMPTS_KEY,
                limit: 5,
                windowSeconds: 1800,
            });
            expect(limiter.count(ATTEMPTS_KEY)).toBe(1);

            await requestEmailVerification(
                { email: 'user@example.com' },
                dependencies,
                { buildMessage }
            );

            expect(limiter.count(ATTEMPTS_KEY)).toBe(0);
        });

        it('keeps the raw email out of every limiter key', async () => {
            const { dependencies, limiter } = makeDependencies();
            const { buildMessage } = makeBuildMessage();

            await requestEmailVerification(
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
                requestEmailVerification({ email }, dependencies, {
                    buildMessage,
                });

            const first = await request('user@example.com');
            const second = await request('user@example.com');
            const other = await request('other@example.com');

            expect(first).toMatchObject({ ok: true, codeIssued: true });
            expect(second).toEqual({ ok: false, reason: 'rate_limited' });
            expect(other).toMatchObject({ ok: true, codeIssued: true });
        });
    });
});
