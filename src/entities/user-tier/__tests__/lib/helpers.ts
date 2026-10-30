import { vi } from 'vitest';
import type { UserTierRepository } from '@/shared/db/types';

type UserTierRepositoryMock = {
    repository: UserTierRepository;
    getUserTierMock: ReturnType<typeof vi.fn>;
};

/** getUserTier 테스트용 저장소 mock. 기본값 null은 '유저 없음'을 뜻한다. */
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
