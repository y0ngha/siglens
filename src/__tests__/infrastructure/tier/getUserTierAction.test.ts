const mockGetCurrentUser = jest.fn();
const mockGetUserTier = jest.fn();

jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('@/shared/db/client', () => ({
    getDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));

jest.mock('@/infrastructure/db/userRepository', () => ({
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/infrastructure/tier/use-cases/getUserTier', () => ({
    getUserTier: (...args: unknown[]) => mockGetUserTier(...args),
}));

import { getUserTierAction } from '@/infrastructure/tier/getUserTierAction';

describe('getUserTierAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
