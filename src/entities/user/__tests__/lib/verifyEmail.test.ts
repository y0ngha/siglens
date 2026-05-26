import { verifyEmail } from '@/entities/user/lib/verifyEmail';
import type { VerifyEmailDependencies } from '@/entities/user/lib/authUseCaseTypes';
import { EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS } from '@/entities/user/lib/authUseCaseConstants';
import { hashEmailToken } from '@/entities/session/lib/tokenUtils';
import type {
    EmailTokenPurpose,
    EmailTokenValue,
} from '@/entities/email-token';

const VALID_CODE = '123456';
const STORED_HASH = hashEmailToken(VALID_CODE);

function makeDependencies(options?: { stored?: EmailTokenValue | null }): {
    dependencies: VerifyEmailDependencies;
    getToken: ReturnType<typeof vi.fn>;
    setToken: ReturnType<typeof vi.fn>;
} {
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
                delete: vi.fn(),
                consume: vi.fn(),
            },
        },
        getToken,
        setToken,
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

    it('returns ok true idempotently when entry is already verified', async () => {
        const { dependencies, setToken } = makeDependencies({
            stored: { status: 'verified' },
        });

        const result = await verifyEmail(
            { email: 'user@example.com', code: VALID_CODE },
            dependencies
        );

        expect(result).toEqual({ ok: true });
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

        expect(result).toEqual({ ok: true });
        expect(getToken).toHaveBeenCalledWith(
            'email_verification',
            'user@example.com'
        );
        expect(setToken).toHaveBeenCalledWith(
            'email_verification',
            'user@example.com',
            { status: 'verified' },
            EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS
        );
    });
});
