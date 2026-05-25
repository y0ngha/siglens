import { vi } from 'vitest';
const mockGetCurrentUser = vi.fn();
const mockGetUserTier = vi.fn();

vi.mock('@/entities/session/lib/getCurrentUser', () => ({
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/entities/user', () => ({
    DrizzleUserRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../lib/getUserTier', () => ({
    getUserTier: (...args: unknown[]) => mockGetUserTier(...args),
}));

import { getUserTierAction } from '../../actions/getUserTierAction';

describe('getUserTierAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('비로그인 시 기본 tier ("free") 를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        const tier = await getUserTierAction();
        expect(tier).toBe('free');
        expect(mockGetUserTier).not.toHaveBeenCalled();
    });

    it('로그인 사용자는 getUserTier 결과를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' });
        mockGetUserTier.mockResolvedValue('pro');
        const tier = await getUserTierAction();
        expect(tier).toBe('pro');
    });
});
