import { cancelOAuthSignupAction } from '@/infrastructure/auth/cancelOAuthSignupAction';
import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/infrastructure/auth/pendingOAuthSignupStore', () => ({
    createPendingOAuthSignupStoreFromEnv: jest.fn(),
}));

const mockCreatePendingOAuthSignupStoreFromEnv = jest.mocked(
    createPendingOAuthSignupStoreFromEnv
);

describe('cancelOAuthSignupAction', () => {
    afterEach(() => jest.clearAllMocks());

    it('deletes the token and redirects to /login', async () => {
        const deleteMock = jest.fn().mockResolvedValue(undefined);
        mockCreatePendingOAuthSignupStoreFromEnv.mockReturnValue({
            delete: deleteMock,
            save: jest.fn(),
            peek: jest.fn(),
            consume: jest.fn(),
        });

        const fd = new FormData();
        fd.set('token', 'tok');
        await cancelOAuthSignupAction(fd);

        expect(deleteMock).toHaveBeenCalledWith('tok');
        expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('redirects to /login even without token', async () => {
        const fd = new FormData();
        await cancelOAuthSignupAction(fd);
        expect(redirect).toHaveBeenCalledWith('/login');
    });
});
