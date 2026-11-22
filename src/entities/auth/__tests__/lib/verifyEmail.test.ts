import { verifyEmail } from '@/entities/auth/lib/verifyEmail';
import type { VerifyEmailDependencies } from '@/entities/auth/lib/authUseCaseTypes';
import { EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS } from '@/entities/auth/lib/authUseCaseConstants';
import { requestEmailVerification } from '@/entities/auth/lib/requestEmailVerification';
import { hashEmailToken } from '@/entities/auth/lib/tokenUtils';
import type {
    EmailTokenPurpose,
    EmailTokenValue,
} from '@/entities/email-token/types';
import { createFakeFixedWindowLimiter } from '@/shared/test-utils/fakeFixedWindowLimiter';

const VALID_CODE = '123456';
const STORED_HASH = hashEmailToken(VALID_CODE);
const OLD_BINDING_HASH = hashEmailToken('previous-browser-nonce');
const VERIFIED_MARKER = {
    status: 'verified',
    tokenHash: STORED_HASH,
    bindingHash: OLD_BINDING_HASH,
} as const satisfies EmailTokenValue;
const IP_HASH = 'iphash';
const IP_KEY = `auth:signup-verify:ip:${IP_HASH}`;
const ATTEMPTS_KEY = `auth:signup-verify:e:${hashEmailToken('user@example.com')}`;

function makeDependencies(options?: {
    stored?: EmailTokenValue | null;
    /** 이 키의 한도 확인만 거부한다. 나머지는 실제 카운팅 가짜 한도를 쓴다. */
    blockKey?: string;
    limiter?: ReturnType<typeof createFakeFixedWindowLimiter>;
}): {
    dependencies: VerifyEmailDependencies;
    getToken: ReturnType<typeof vi.fn>;
    setToken: ReturnType<typeof vi.fn>;
    deleteToken: ReturnType<typeof vi.fn>;
    limiter: ReturnType<typeof createFakeFixedWindowLimiter>;
} {
    const limiter = options?.limiter ?? createFakeFixedWindowLimiter();
    const blockKey = options?.blockKey;
    const deleteToken = vi.fn().mockResolvedValue(undefined);
    const stored: EmailTokenValue | null =
        options && 'stored' in options
            ? (options.stored ?? null)
            : { status: 'pending', tokenHash: STORED_HASH };

    const getToken = vi
        .fn<
            (
                purpose: EmailTokenPurpose,
                email: string
            ) => Promise<EmailTokenValue | null>
        >()
        .mockResolvedValue(stored);
    const setToken = vi.fn().mockResolvedValue(undefined);

    return {
        dependencies: {
            emailTokens: {
                set: setToken,
                get: getToken,
                delete: deleteToken,
                consume: vi.fn(),
            },
            rateLimit: async rule => {
                const allowed = await limiter.rateLimit(rule);
                return allowed && rule.key !== blockKey;
            },
            ipHash: async () => IP_HASH,
        },
        getToken,
        setToken,
        deleteToken,
        limiter,
    };
}

describe('verifyEmail', () => {
    it('returns expired_verification_code when no Redis entry exists', async () => {
        const { dependencies, setToken } = makeDependencies({ stored: null });

        const result = await verifyEmail(
            { email: 'user@example.com', code: VALID_CODE },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'expired_verification_code',
                field: 'code',
                message: '인증 코드가 만료되었습니다.',
            },
        });
        expect(setToken).not.toHaveBeenCalled();
    });

    it('rotates the binding when the right code is proven again on a verified marker (newest browser wins)', async () => {
        const { dependencies, setToken } = makeDependencies({
            stored: VERIFIED_MARKER,
        });

        const result = await verifyEmail(
            { email: 'user@example.com', code: VALID_CODE },
            dependencies
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const written = setToken.mock.calls.find(
            call => call[1] === 'user@example.com'
        )?.[2];
        expect(written).toEqual({
            status: 'verified',
            tokenHash: STORED_HASH,
            bindingHash: hashEmailToken(result.bindingToken),
        });
        expect(hashEmailToken(result.bindingToken)).not.toBe(OLD_BINDING_HASH);
    });

    it('returns invalid_verification_code and writes nothing when a verified marker meets a wrong code', async () => {
        const { dependencies, setToken } = makeDependencies({
            stored: VERIFIED_MARKER,
        });

        const result = await verifyEmail(
            { email: 'user@example.com', code: '999999' },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: expect.objectContaining({
                code: 'invalid_verification_code',
            }),
        });
        expect(setToken).not.toHaveBeenCalled();
    });

    it('returns invalid_verification_code when the submitted code does not match', async () => {
        const { dependencies, setToken } = makeDependencies();

        const result = await verifyEmail(
            { email: 'user@example.com', code: '999999' },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_verification_code',
                field: 'code',
                message: '인증 코드가 올바르지 않습니다.',
            },
        });
        expect(setToken).not.toHaveBeenCalled();
    });

    it('returns invalid_verification_code (not expired) when the stored hash is not a sha256 hex digest', async () => {
        const { dependencies, setToken } = makeDependencies({
            stored: { status: 'pending', tokenHash: 'not-a-hex-digest' },
        });

        const result = await verifyEmail(
            { email: 'user@example.com', code: VALID_CODE },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_verification_code',
                field: 'code',
                message: '인증 코드가 올바르지 않습니다.',
            },
        });
        expect(setToken).not.toHaveBeenCalled();
    });

    it('returns invalid_verification_code without Redis lookup for malformed email', async () => {
        const { dependencies, getToken, setToken } = makeDependencies();

        const result = await verifyEmail(
            { email: 'not-an-email', code: VALID_CODE },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_verification_code',
                field: 'code',
                message: '인증 코드가 올바르지 않습니다.',
            },
        });
        expect(getToken).not.toHaveBeenCalled();
        expect(setToken).not.toHaveBeenCalled();
    });

    it('transitions the Redis entry from pending to verified on success', async () => {
        const { dependencies, getToken, setToken } = makeDependencies();

        const result = await verifyEmail(
            { email: ' User@Example.COM ', code: VALID_CODE },
            dependencies
        );

        expect(result).toEqual({
            ok: true,
            bindingToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        });
        expect(getToken).toHaveBeenCalledWith(
            'email_verification',
            'user@example.com'
        );
        expect(setToken).toHaveBeenCalledWith(
            'email_verification',
            'user@example.com',
            {
                status: 'verified',
                tokenHash: STORED_HASH,
                bindingHash: expect.stringMatching(/^[0-9a-f]{64}$/),
            },
            EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS
        );
    });

    it('stores the hash of the returned binding token, never the token itself', async () => {
        const { dependencies, setToken } = makeDependencies();

        const result = await verifyEmail(
            { email: 'user@example.com', code: VALID_CODE },
            dependencies
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const written = setToken.mock.calls.find(
            call => call[1] === 'user@example.com'
        )?.[2];
        expect(written).toMatchObject({
            bindingHash: hashEmailToken(result.bindingToken),
        });
        expect(JSON.stringify(written)).not.toContain(result.bindingToken);
    });

    it('issues a different binding token on every verification', async () => {
        const first = await verifyEmail(
            { email: 'user@example.com', code: VALID_CODE },
            makeDependencies().dependencies
        );
        const second = await verifyEmail(
            { email: 'user@example.com', code: VALID_CODE },
            makeDependencies().dependencies
        );

        expect(first.ok && second.ok).toBe(true);
        if (first.ok && second.ok) {
            expect(first.bindingToken).not.toBe(second.bindingToken);
        }
    });

    describe('남용 한도', () => {
        it('returns rate_limited without reading the record when the IP limit blocks', async () => {
            const { dependencies, getToken, deleteToken } = makeDependencies({
                blockKey: IP_KEY,
            });

            const result = await verifyEmail(
                { email: 'user@example.com', code: VALID_CODE },
                dependencies
            );

            expect(result).toEqual({
                ok: false,
                error: expect.objectContaining({ code: 'rate_limited' }),
            });
            expect(getToken).not.toHaveBeenCalled();
            expect(deleteToken).not.toHaveBeenCalled();
        });

        it('uses the agreed IP and per-address limits', async () => {
            const { dependencies, limiter } = makeDependencies();

            await verifyEmail(
                { email: 'user@example.com', code: VALID_CODE },
                dependencies
            );

            expect(limiter.calls.find(rule => rule.key === IP_KEY)).toEqual({
                key: IP_KEY,
                limit: 30,
                windowSeconds: 1800,
            });
            expect(
                limiter.calls.find(rule => rule.key === ATTEMPTS_KEY)
            ).toEqual({ key: ATTEMPTS_KEY, limit: 5, windowSeconds: 1800 });
        });

        it('counts the attempt before it reads the record', async () => {
            const { dependencies, getToken, limiter } = makeDependencies();
            const counted = vi.fn();
            const original = dependencies.rateLimit;
            dependencies.rateLimit = async rule => {
                if (rule.key === ATTEMPTS_KEY) counted();
                return original(rule);
            };

            await verifyEmail(
                { email: 'user@example.com', code: VALID_CODE },
                dependencies
            );

            expect(limiter.count(ATTEMPTS_KEY)).toBe(1);
            expect(counted.mock.invocationCallOrder[0]).toBeLessThan(
                getToken.mock.invocationCallOrder[0] ?? 0
            );
        });

        it('keeps the raw email out of every limiter key', async () => {
            const { dependencies, limiter } = makeDependencies();

            await verifyEmail(
                { email: 'user@example.com', code: VALID_CODE },
                dependencies
            );

            expect(
                limiter.calls.filter(rule => rule.key.includes('example.com'))
            ).toEqual([]);
        });

        it('allows 5 wrong codes, then refuses the 6th even with the right code and deletes the pending record', async () => {
            const { dependencies, deleteToken, setToken } = makeDependencies();
            const verify = (code: string) =>
                verifyEmail({ email: 'user@example.com', code }, dependencies);

            const wrong = await Promise.all(
                ['1', '2', '3', '4', '5'].map(code => verify(code))
            );
            const sixth = await verify(VALID_CODE);

            expect(wrong).toHaveLength(5);
            expect(
                wrong.every(
                    r => !r.ok && r.error.code === 'invalid_verification_code'
                )
            ).toBe(true);
            expect(sixth).toEqual({
                ok: false,
                error: {
                    code: 'too_many_verification_attempts',
                    field: 'code',
                    message: expect.any(String),
                },
            });
            expect(deleteToken).toHaveBeenCalledWith(
                'email_verification',
                'user@example.com'
            );
            expect(setToken).not.toHaveBeenCalled();
        });

        it('lets the fifth attempt through when it is the right code', async () => {
            const { dependencies } = makeDependencies();
            const verify = (code: string) =>
                verifyEmail({ email: 'user@example.com', code }, dependencies);

            await Promise.all(['1', '2', '3', '4'].map(code => verify(code)));

            await expect(verify(VALID_CODE)).resolves.toMatchObject({
                ok: true,
            });
        });

        it('keeps a verified marker when the attempts are over the cap', async () => {
            const { dependencies, deleteToken } = makeDependencies({
                stored: VERIFIED_MARKER,
                blockKey: ATTEMPTS_KEY,
            });

            const result = await verifyEmail(
                { email: 'user@example.com', code: VALID_CODE },
                dependencies
            );

            expect(result).toEqual({
                ok: false,
                error: expect.objectContaining({
                    code: 'too_many_verification_attempts',
                }),
            });
            expect(deleteToken).not.toHaveBeenCalled();
        });

        it('lets the right code pass after a new code request resets the counter', async () => {
            const limiter = createFakeFixedWindowLimiter();
            const { dependencies, getToken } = makeDependencies({ limiter });
            const verify = (code: string) =>
                verifyEmail({ email: 'user@example.com', code }, dependencies);
            await Promise.all(
                ['1', '2', '3', '4', '5'].map(code => verify(code))
            );
            expect(await verify(VALID_CODE)).toMatchObject({ ok: false });

            const sent = await requestEmailVerification(
                { email: 'user@example.com' },
                {
                    emailTokens: dependencies.emailTokens,
                    emailDispatcher: {
                        sendEmail: vi.fn().mockResolvedValue(true),
                    },
                    rateLimit: dependencies.rateLimit,
                    resetCounter: limiter.resetCounter,
                    ipHash: dependencies.ipHash,
                },
                {
                    buildMessage: () => ({
                        to: 'user@example.com',
                        subject: 's',
                        html: 'h',
                        text: 't',
                    }),
                }
            );
            getToken.mockResolvedValue({
                status: 'pending',
                tokenHash: STORED_HASH,
            });

            expect(sent).toMatchObject({ ok: true, codeIssued: true });
            expect(limiter.count(ATTEMPTS_KEY)).toBe(0);
            await expect(verify(VALID_CODE)).resolves.toMatchObject({
                ok: true,
            });
        });

        it('counts attempts on the verified path too: the 6th try is refused even with the right code', async () => {
            const { dependencies, setToken } = makeDependencies({
                stored: VERIFIED_MARKER,
            });
            const verify = (code: string) =>
                verifyEmail({ email: 'user@example.com', code }, dependencies);

            await Promise.all(
                ['1', '2', '3', '4', '5'].map(code => verify(code))
            );
            const sixth = await verify(VALID_CODE);

            expect(sixth).toEqual({
                ok: false,
                error: expect.objectContaining({
                    code: 'too_many_verification_attempts',
                }),
            });
            expect(setToken).not.toHaveBeenCalled();
        });
    });
});
