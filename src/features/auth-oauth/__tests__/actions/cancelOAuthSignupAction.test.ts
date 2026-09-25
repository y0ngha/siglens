import type { MockedFunction } from 'vitest';
import { cancelOAuthSignupAction } from '@/features/auth-oauth/actions/cancelOAuthSignupAction';
import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account/lib/pendingOAuthSignupStore';

// 액션의 리다이렉트는 `localeHref`/`localeRedirect`를 거치고, 그 안의
// `getLocale()`은 next-intl config 파일을 요구한다(빌드 플러그인이 만든다).
// 여기서는 액션 로직만 검증하므로 기본 로케일로 고정한다 — 그러면 리다이렉트
// 경로가 접두사 없는 기존 값과 같아져 기존 단언이 그대로 유효하다.
// ko 카탈로그를 실제로 조회하는 스텁 — 키 오타나 카탈로그 누락이 여기서 잡힌다.
vi.mock('next-intl/server', async () => {
    const { nextIntlServerStub } =
        await import('@/shared/test-utils/catalogTranslator');
    return nextIntlServerStub();
});
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

    /** ai.siglens.io에서 온 가입을 취소해도 로그인 화면이 SSO 핸드오프 복귀를 잃지 않는다. */
    it('지우기 전에 읽은 next를 로그인 화면에 되실어 준다', async () => {
        const next = '/api/auth/handoff?to=ai&next=%2Fc%2Fabc';
        const deleteMock = vi.fn().mockResolvedValue(undefined);
        const peekMock = vi.fn().mockResolvedValue({ next });
        mockCreatePendingOAuthSignupStoreFromEnv.mockReturnValue({
            delete: deleteMock,
            save: vi.fn(),
            peek: peekMock,
            consume: vi.fn(),
        });
        const fd = new FormData();
        fd.set('token', 'tok');
        await expect(cancelOAuthSignupAction(fd)).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(peekMock.mock.invocationCallOrder[0]!).toBeLessThan(
            deleteMock.mock.invocationCallOrder[0]!
        );
        expect(mockRedirect).toHaveBeenCalledWith(
            `/login?next=${encodeURIComponent(next)}`
        );
    });

    it('peek이 실패해도 토큰은 지우고 next 없이 /login으로 보낸다', async () => {
        const deleteMock = vi.fn().mockResolvedValue(undefined);
        mockCreatePendingOAuthSignupStoreFromEnv.mockReturnValue({
            delete: deleteMock,
            save: vi.fn(),
            peek: vi.fn().mockRejectedValue(new Error('Redis down')),
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
});
