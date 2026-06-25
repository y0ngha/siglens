const { mockGetCurrentUser, mockGetUserTier } = vi.hoisted(() => ({
    mockGetCurrentUser: vi.fn(),
    mockGetUserTier: vi.fn(),
}));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

// DrizzleUserRepository는 barrel이 아닌 @/entities/auth/api에서 직접 import되므로
// 해당 경로를 mock한다.
vi.mock('@/entities/auth/api', () => ({
    DrizzleUserRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
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
