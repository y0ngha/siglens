import { findUserBySessionToken } from '@/entities/auth/lib/findUserBySessionToken';
import {
    safeCompareTokenHashes,
    hashEmailToken,
} from '@/entities/auth/lib/tokenUtils';
import type { FindUserBySessionTokenDependencies } from '@/entities/auth/lib/authUseCaseTypes';

function createMockDependencies(
    overrides: Partial<FindUserBySessionTokenDependencies> = {}
): FindUserBySessionTokenDependencies {
    return {
        sessions: {
            findSession: vi.fn().mockResolvedValue(null),
            ...overrides.sessions,
        } as unknown as FindUserBySessionTokenDependencies['sessions'],
        users: {
            findById: vi.fn().mockResolvedValue(null),
            ...overrides.users,
        } as unknown as FindUserBySessionTokenDependencies['users'],
    };
}

const MOCK_USER = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test',
    avatarUrl: null,
    emailVerified: true,
    createdAt: new Date(),
};

describe('Session security edge cases', () => {
    describe('findUserBySessionToken', () => {
        it('returns null for expired token', async () => {
            const pastDate = new Date('2020-01-01');
            const deps = createMockDependencies({
                sessions: {
                    findSession: vi.fn().mockResolvedValue({
                        userId: 'user-1',
                        expiresAt: pastDate,
                    }),
                } as unknown as FindUserBySessionTokenDependencies['sessions'],
            });

            const result = await findUserBySessionToken('valid-token', deps, {
                now: new Date('2025-01-01'),
            });

            expect(result).toBeNull();
        });

        it('returns null when session not found (missing cookie)', async () => {
            const deps = createMockDependencies();

            const result = await findUserBySessionToken(
                'nonexistent-token',
                deps
            );

            expect(result).toBeNull();
            expect(deps.sessions.findSession).toHaveBeenCalledWith(
                'nonexistent-token'
            );
        });

        it('returns null when token is empty string', async () => {
            const deps = createMockDependencies();

            const result = await findUserBySessionToken('', deps);

            expect(result).toBeNull();
        });

        it('returns user for valid non-expired session', async () => {
            const futureDate = new Date('2030-01-01');
            const deps = createMockDependencies({
                sessions: {
                    findSession: vi.fn().mockResolvedValue({
                        userId: 'user-1',
                        expiresAt: futureDate,
                    }),
                } as unknown as FindUserBySessionTokenDependencies['sessions'],
                users: {
                    findById: vi.fn().mockResolvedValue(MOCK_USER),
                } as unknown as FindUserBySessionTokenDependencies['users'],
            });

            const result = await findUserBySessionToken('valid-token', deps, {
                now: new Date('2025-01-01'),
            });

            expect(result).toEqual(MOCK_USER);
        });

        it('returns null when session is exactly at expiration boundary', async () => {
            const now = new Date('2025-06-01T12:00:00Z');
            const deps = createMockDependencies({
                sessions: {
                    findSession: vi.fn().mockResolvedValue({
                        userId: 'user-1',
                        expiresAt: now,
                    }),
                } as unknown as FindUserBySessionTokenDependencies['sessions'],
            });

            const result = await findUserBySessionToken('token', deps, { now });

            expect(result).toBeNull();
        });
    });

    describe('safeCompareTokenHashes (timing-safe comparison)', () => {
        it('returns false when first hash is not valid SHA-256 hex', () => {
            const validHash = hashEmailToken('test');
            expect(safeCompareTokenHashes('not-a-hash', validHash)).toBe(false);
        });

        it('returns false when second hash is not valid SHA-256 hex', () => {
            const validHash = hashEmailToken('test');
            expect(safeCompareTokenHashes(validHash, 'not-a-hash')).toBe(false);
        });

        it('returns false for two different valid hashes', () => {
            const hash1 = hashEmailToken('token-a');
            const hash2 = hashEmailToken('token-b');
            expect(safeCompareTokenHashes(hash1, hash2)).toBe(false);
        });

        it('returns true for identical hashes', () => {
            const hash = hashEmailToken('same-token');
            expect(safeCompareTokenHashes(hash, hash)).toBe(true);
        });

        it('returns false for empty strings', () => {
            expect(safeCompareTokenHashes('', '')).toBe(false);
        });

        it('returns false for uppercase hex (not valid pattern)', () => {
            const hash = hashEmailToken('test').toUpperCase();
            const lower = hashEmailToken('test');
            expect(safeCompareTokenHashes(hash, lower)).toBe(false);
        });
    });
});
