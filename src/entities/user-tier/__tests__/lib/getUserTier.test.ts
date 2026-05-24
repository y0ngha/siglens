import { getUserTier } from '../../lib/getUserTier';
import { makeUserTierRepositoryMock } from './helpers';

describe('getUserTier', () => {
    it('returns the persisted user tier', async () => {
        const { repository, getUserTierMock } = makeUserTierRepositoryMock({
            getUserTier: 'pro',
        });

        const result = await getUserTier(
            { userId: 'user-1' },
            { users: repository }
        );

        expect(getUserTierMock).toHaveBeenCalledWith('user-1');
        expect(result).toBe('pro');
    });

    it('falls back to free when the user is missing', async () => {
        const { repository, getUserTierMock } = makeUserTierRepositoryMock();

        const result = await getUserTier(
            { userId: 'missing-user' },
            { users: repository }
        );

        expect(getUserTierMock).toHaveBeenCalledWith('missing-user');
        expect(result).toBe('free');
    });
});
