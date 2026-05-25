import { vi } from 'vitest';
import type { UserTierRepository } from '@/shared/db/types';

type UserTierRepositoryMock = {
    repository: UserTierRepository;
    getUserTierMock: ReturnType<typeof vi.fn>;
    updateUserTierMock: ReturnType<typeof vi.fn>;
};

export function makeUserTierRepositoryMock({
    getUserTier = null,
    updateUserTier = null,
}: {
    getUserTier?: Awaited<ReturnType<UserTierRepository['getUserTier']>>;
    updateUserTier?: Awaited<ReturnType<UserTierRepository['updateUserTier']>>;
} = {}): UserTierRepositoryMock {
    const getUserTierMock = vi.fn().mockResolvedValue(getUserTier);
    const updateUserTierMock = vi.fn().mockResolvedValue(updateUserTier);

    return {
        repository: {
            getUserTier: getUserTierMock,
            updateUserTier: updateUserTierMock,
        },
        getUserTierMock,
        updateUserTierMock,
    };
}
