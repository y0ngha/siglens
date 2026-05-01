import { createUserTierContext } from '@/infrastructure/tier/use-cases/createUserTierContext';
import { makeUserTierRepositoryMock } from './helpers';

describe('createUserTierContext', () => {
    it('returns free context without repository access for anonymous requests', async () => {
        const { repository, getUserTierMock } = makeUserTierRepositoryMock({
            getUserTier: 'pro',
        });

        const result = await createUserTierContext(
            { userId: null },
            { users: repository }
        );

        expect(getUserTierMock).not.toHaveBeenCalled();
        expect(result).toEqual({ userId: null, tier: 'free' });
    });

    it('treats an undefined userId as an anonymous request', async () => {
        const { repository, getUserTierMock } = makeUserTierRepositoryMock({
            getUserTier: 'pro',
        });

        const result = await createUserTierContext(
            { userId: undefined },
            { users: repository }
        );

        expect(getUserTierMock).not.toHaveBeenCalled();
        expect(result).toEqual({ userId: null, tier: 'free' });
    });

    it('adds the persisted tier to authenticated request context', async () => {
        const { repository, getUserTierMock } = makeUserTierRepositoryMock({
            getUserTier: 'member',
        });

        const result = await createUserTierContext(
            { userId: 'user-1' },
            { users: repository }
        );

        expect(getUserTierMock).toHaveBeenCalledWith('user-1');
        expect(result).toEqual({ userId: 'user-1', tier: 'member' });
    });

    it('falls back to free when an authenticated user is missing', async () => {
        const { repository, getUserTierMock } = makeUserTierRepositoryMock();

        const result = await createUserTierContext(
            { userId: 'missing-user' },
            { users: repository }
        );

        expect(getUserTierMock).toHaveBeenCalledWith('missing-user');
        expect(result).toEqual({ userId: 'missing-user', tier: 'free' });
    });
});
