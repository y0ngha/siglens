/**
 * Branch coverage for confirmPasswordReset — targets uncovered:
 * - L99: stored.status !== 'pending' after consume (TOCTOU)
 * - L102: safeCompareTokenHashes mismatch after consume
 */

import { confirmPasswordReset } from '@/entities/auth/lib/confirmPasswordReset';
import type { ConfirmPasswordResetDependencies } from '@/entities/auth/lib/authUseCaseTypes';
import { hashEmailToken } from '@/entities/auth/lib/tokenUtils';
import type { EmailTokenValue } from '@/entities/email-token';
import type { EmailAuthUserRecord } from '@/shared/db/types';

const RAW_TOKEN = 'raw-token-value';
const STORED_TOKEN_HASH = hashEmailToken(RAW_TOKEN);
const NEW_PASSWORD = 'NewSecret1';

const user: EmailAuthUserRecord = {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'old-hash',
    name: null,
    avatarUrl: null,
    tier: 'free',
    emailVerified: true,
    createdAt: new Date('2026-04-27T00:00:00.000Z'),
    updatedAt: new Date('2026-04-27T00:00:01.000Z'),
};

function makeDeps(overrides: {
    consumedToken?: EmailTokenValue | null;
}): ConfirmPasswordResetDependencies {
    const getToken = vi.fn().mockResolvedValue({
        status: 'pending',
        tokenHash: STORED_TOKEN_HASH,
    });
    const consumeToken = vi
        .fn()
        .mockResolvedValue(overrides.consumedToken ?? null);

    return {
        emailTokens: {
            get: getToken,
            consume: consumeToken,
            set: vi.fn(),
            delete: vi.fn(),
        },
        emailAuthUsers: {
            findEmailAuthUserByEmail: vi.fn().mockResolvedValue(user),
            updatePassword: vi.fn().mockResolvedValue(true),
        },
        passwordHasher: {
            hashPassword: vi.fn().mockResolvedValue('new-hash'),
        },
        passwordVerifier: {
            verifyPassword: vi.fn().mockResolvedValue(false),
        },
    } as unknown as ConfirmPasswordResetDependencies;
}

describe('confirmPasswordReset — consume TOCTOU branches', () => {
    it('returns error when consumed token has non-pending status', async () => {
        const deps = makeDeps({
            consumedToken: {
                status: 'verified',
            },
        });

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            deps
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('invalid_token');
    });

    it('returns error when consumed token hash does not match', async () => {
        const wrongHash = hashEmailToken('different-token');
        const deps = makeDeps({
            consumedToken: {
                status: 'pending',
                tokenHash: wrongHash,
            },
        });

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            deps
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('invalid_token');
    });
});
