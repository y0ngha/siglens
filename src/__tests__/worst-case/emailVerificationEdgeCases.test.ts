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

/** 한도는 통과시키는 포트 — 이 파일은 코드 비교 경계만 본다(한도는 verifyEmail.test가 다룬다). */
const ALLOW_ALL = {
    rateLimit: async () => true,
    ipHash: async () => 'iphash',
};

describe('Email verification edge cases', () => {
    it('returns expired error when no token stored', async () => {
        const emailTokens = createMockEmailTokens({
            get: vi.fn().mockResolvedValue(null),
        });

        const result = await verifyEmail(
            { email: 'test@example.com', code: '123456' },
            { emailTokens, ...ALLOW_ALL }
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
            { emailTokens, ...ALLOW_ALL }
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('invalid_verification_code');
        }
    });

    it('rejects a wrong code when already verified (no free pass for a stranger)', async () => {
        const emailTokens = createMockEmailTokens({
            get: vi.fn().mockResolvedValue({
                status: 'verified',
                tokenHash: hashEmailToken('654321'),
                bindingHash: hashEmailToken('binding'),
            }),
        });

        const result = await verifyEmail(
            { email: 'test@example.com', code: 'any-code' },
            { emailTokens, ...ALLOW_ALL }
        );

        expect(result.ok).toBe(false);
        expect(emailTokens.set).not.toHaveBeenCalled();
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
            { emailTokens, ...ALLOW_ALL }
        );

        expect(result.ok).toBe(true);
        expect(emailTokens.set).toHaveBeenCalledWith(
            'email_verification',
            'test@example.com',
            expect.objectContaining({
                status: 'verified',
                tokenHash: hashEmailToken(code),
            }),
            expect.any(Number)
        );
    });

    it('returns invalid error for malformed email', async () => {
        const emailTokens = createMockEmailTokens();

        const result = await verifyEmail(
            { email: 'not-an-email', code: '123456' },
            { emailTokens, ...ALLOW_ALL }
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('invalid_verification_code');
        }
    });
});
