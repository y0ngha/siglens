import { vi } from 'vitest';
import type { UserTierRepository } from '@/shared/db/types';

type UserTierRepositoryMock = {
    repository: UserTierRepository;
    getUserTierMock: ReturnType<typeof vi.fn>;
};

export function makeUserTierRepositoryMock({
    getUserTier = null,
}: {
    getUserTier?: Awaited<ReturnType<UserTierRepository['getUserTier']>>;
} = {}): UserTierRepositoryMock {
    const getUserTierMock = vi.fn().mockResolvedValue(getUserTier);

    return {
        repository: {
            getUserTier: getUserTierMock,
        },
        getUserTierMock,
    };
}
