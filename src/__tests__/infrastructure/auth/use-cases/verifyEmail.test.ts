import { verifyEmail } from '@/infrastructure/auth/use-cases/verifyEmail';
import type { VerifyEmailDependencies } from '@/infrastructure/auth/use-cases/types';
import { EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS } from '@/infrastructure/auth/use-cases/constants';
import { hashEmailToken } from '@/infrastructure/auth/tokenUtils';
import type {
    EmailTokenPurpose,
    EmailTokenValue,
} from '@/infrastructure/email/tokenStore';

const VALID_CODE = '123456';
const STORED_HASH = hashEmailToken(VALID_CODE);

function makeDependencies(options?: { stored?: EmailTokenValue | null }): {
    dependencies: VerifyEmailDependencies;
    getToken: ReturnType<typeof jest.fn>;
    setToken: ReturnType<typeof jest.fn>;
} {
    const stored: EmailTokenValue | null =
        options && 'stored' in options
            ? (options.stored ?? null)
            : { status: 'pending', tokenHash: STORED_HASH };

    const getToken = jest
        .fn<
            Promise<EmailTokenValue | null>,
            [purpose: EmailTokenPurpose, email: string]
        >()
        .mockResolvedValue(stored);
    const setToken = jest.fn().mockResolvedValue(undefined);

    return {
        dependencies: {
            emailTokens: {
                set: setToken,
                get: getToken,
                delete: jest.fn(),
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
                message: 'Verification code has expired',
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
                message: 'Verification code is invalid',
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
                message: 'Verification code is invalid',
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
