import { verifyEmail } from '@/entities/auth/lib/verifyEmail';
import { hashEmailToken } from '@/entities/auth/lib/tokenUtils';
import type { VerifyEmailDependencies } from '@/entities/auth/lib/authUseCaseTypes';

function createMockEmailTokens(
    overrides: Partial<VerifyEmailDependencies['emailTokens']> = {}
): VerifyEmailDependencies['emailTokens'] {
    return {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        consume: vi.fn().mockResolvedValue(null),
        ...overrides,
    } as unknown as VerifyEmailDependencies['emailTokens'];
}

describe('Email verification edge cases', () => {
    it('returns expired error when no token stored', async () => {
        const emailTokens = createMockEmailTokens({
            get: vi.fn().mockResolvedValue(null),
        });

        const result = await verifyEmail(
            { email: 'test@example.com', code: '123456' },
            { emailTokens }
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('expired_verification_code');
        }
    });

    it('returns invalid error when wrong code submitted', async () => {
        const correctCode = '654321';
        const emailTokens = createMockEmailTokens({
            get: vi.fn().mockResolvedValue({
                status: 'pending',
                tokenHash: hashEmailToken(correctCode),
            }),
        });

        const result = await verifyEmail(
            { email: 'test@example.com', code: '111111' },
            { emailTokens }
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('invalid_verification_code');
        }
    });

    it('returns ok: true when already verified', async () => {
        const emailTokens = createMockEmailTokens({
            get: vi.fn().mockResolvedValue({
                status: 'verified',
            }),
        });

        const result = await verifyEmail(
            { email: 'test@example.com', code: 'any-code' },
            { emailTokens }
        );

        expect(result.ok).toBe(true);
    });

    it('returns ok: true and sets verified status on correct code', async () => {
        const code = '654321';
        const emailTokens = createMockEmailTokens({
            get: vi.fn().mockResolvedValue({
                status: 'pending',
                tokenHash: hashEmailToken(code),
            }),
        });

        const result = await verifyEmail(
            { email: 'test@example.com', code },
            { emailTokens }
        );

        expect(result.ok).toBe(true);
        expect(emailTokens.set).toHaveBeenCalledWith(
            'email_verification',
            'test@example.com',
            { status: 'verified' },
            expect.any(Number)
        );
    });

    it('returns invalid error for malformed email', async () => {
        const emailTokens = createMockEmailTokens();

        const result = await verifyEmail(
            { email: 'not-an-email', code: '123456' },
            { emailTokens }
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('invalid_verification_code');
        }
    });
});
