import { setUserTier } from '@/infrastructure/tier/use-cases/setUserTier';
import { makeUserTierRepositoryMock } from './helpers';

describe('setUserTier', () => {
    it('updates a user tier for admin workflows', async () => {
        const { repository, updateUserTierMock } = makeUserTierRepositoryMock({
            updateUserTier: 'pro',
        });

        const result = await setUserTier(
            { userId: 'user-1', tier: 'pro' },
            { users: repository }
        );

        expect(updateUserTierMock).toHaveBeenCalledWith('user-1', 'pro');
        expect(result).toEqual({ ok: true, userId: 'user-1', tier: 'pro' });
    });

    it('returns a not-found error when the target user does not exist', async () => {
        const { repository, updateUserTierMock } = makeUserTierRepositoryMock();

        const result = await setUserTier(
            { userId: 'missing-user', tier: 'member' },
            { users: repository }
        );

        expect(updateUserTierMock).toHaveBeenCalledWith(
            'missing-user',
            'member'
        );
        expect(result).toEqual({
            ok: false,
            error: {
                code: 'user_not_found',
                message: 'User was not found',
            },
        });
    });
});
