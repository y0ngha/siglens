import { vi, type MockedFunction } from 'vitest';
import { cancelOAuthSignupAction } from '@/features/auth-oauth/actions/cancelOAuthSignupAction';
import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account/lib/pendingOAuthSignupStore';

vi.mock('next/navigation', () => ({
    redirect: vi.fn().mockImplementation((url: string) => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { url });
    }),
}));
vi.mock('@/entities/oauth-account/lib/pendingOAuthSignupStore', () => ({
    createPendingOAuthSignupStoreFromEnv: vi.fn(),
}));

const mockCreatePendingOAuthSignupStoreFromEnv = vi.mocked(
    createPendingOAuthSignupStoreFromEnv
);
const mockRedirect = redirect as MockedFunction<typeof redirect>;

describe('cancelOAuthSignupAction', () => {
    afterEach(() => vi.clearAllMocks());

    it('deletes the token and redirects to /login', async () => {
        const deleteMock = vi.fn().mockResolvedValue(undefined);
        mockCreatePendingOAuthSignupStoreFromEnv.mockReturnValue({
            delete: deleteMock,
            save: vi.fn(),
            peek: vi.fn(),
            consume: vi.fn(),
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
        const deleteMock = vi.fn().mockRejectedValue(new Error('Redis down'));
        mockCreatePendingOAuthSignupStoreFromEnv.mockReturnValue({
            delete: deleteMock,
            save: vi.fn(),
            peek: vi.fn(),
            consume: vi.fn(),
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
