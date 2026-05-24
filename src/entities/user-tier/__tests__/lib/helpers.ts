import type { UserTierRepository } from '@/shared/db/types';

type UserTierRepositoryMock = {
    repository: UserTierRepository;
    getUserTierMock: ReturnType<typeof jest.fn>;
    updateUserTierMock: ReturnType<typeof jest.fn>;
};

export function makeUserTierRepositoryMock({
    getUserTier = null,
    updateUserTier = null,
}: {
    getUserTier?: Awaited<ReturnType<UserTierRepository['getUserTier']>>;
    updateUserTier?: Awaited<ReturnType<UserTierRepository['updateUserTier']>>;
} = {}): UserTierRepositoryMock {
    const getUserTierMock = jest.fn().mockResolvedValue(getUserTier);
    const updateUserTierMock = jest.fn().mockResolvedValue(updateUserTier);

    return {
        repository: {
            getUserTier: getUserTierMock,
            updateUserTier: updateUserTierMock,
        },
        getUserTierMock,
        updateUserTierMock,
    };
}
