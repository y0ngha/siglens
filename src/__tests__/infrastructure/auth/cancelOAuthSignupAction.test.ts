import { cancelOAuthSignupAction } from '@/infrastructure/auth/cancelOAuthSignupAction';
import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';

jest.mock('next/navigation', () => ({
    redirect: jest.fn().mockImplementation((url: string) => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { url });
    }),
}));
jest.mock('@/infrastructure/auth/pendingOAuthSignupStore', () => ({
    createPendingOAuthSignupStoreFromEnv: jest.fn(),
}));

const mockCreatePendingOAuthSignupStoreFromEnv = jest.mocked(
    createPendingOAuthSignupStoreFromEnv
);
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

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
        await expect(cancelOAuthSignupAction(fd)).rejects.toThrow(
            'NEXT_REDIRECT'
        );

        expect(deleteMock).toHaveBeenCalledWith('tok');
        expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('redirects to /login even without token', async () => {
        const fd = new FormData();
        await expect(cancelOAuthSignupAction(fd)).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('redirects to /login when store is unavailable (null)', async () => {
        mockCreatePendingOAuthSignupStoreFromEnv.mockReturnValue(null);
        const fd = new FormData();
        fd.set('token', 'tok');
        await expect(cancelOAuthSignupAction(fd)).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('redirects to /login even when store.delete throws (best-effort cleanup)', async () => {
        const deleteMock = jest.fn().mockRejectedValue(new Error('Redis down'));
        mockCreatePendingOAuthSignupStoreFromEnv.mockReturnValue({
            delete: deleteMock,
            save: jest.fn(),
            peek: jest.fn(),
            consume: jest.fn(),
        });
        const fd = new FormData();
        fd.set('token', 'tok');
        await expect(cancelOAuthSignupAction(fd)).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(deleteMock).toHaveBeenCalledWith('tok');
        expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('예상치 못한 내부 에러 시 /login으로 리다이렉트한다', async () => {
        mockCreatePendingOAuthSignupStoreFromEnv.mockImplementation(() => {
            throw new Error('Unexpected store error');
        });
        const fd = new FormData();
        fd.set('token', 'tok');
        await expect(cancelOAuthSignupAction(fd)).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(mockRedirect).toHaveBeenCalledWith('/login');
    });
});
