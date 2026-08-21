import type { MockedFunction } from 'vitest';
const { mockDeleteByUserAndProvider } = vi.hoisted(() => ({
    mockDeleteByUserAndProvider: vi.fn(),
}));

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
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    redirect: vi.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
vi.mock('@/entities/api-key/api', () => ({
    DrizzleUserApiKeyRepository: vi.fn().mockImplementation(function () {
        return {
            deleteByUserAndProvider: mockDeleteByUserAndProvider,
        };
    }),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteApiKeyAction } from '@/entities/api-key/actions/deleteApiKeyAction';
import { makeFormData } from '@/shared/test-utils/makeFormData';
import type { ApiKeyActionState } from '@/entities/api-key';

const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockRevalidatePath = revalidatePath as MockedFunction<
    typeof revalidatePath
>;
const mockRedirect = redirect as MockedFunction<typeof redirect>;

const IDLE_STATE: ApiKeyActionState = { status: 'idle', message: null };

describe('deleteApiKeyAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDeleteByUserAndProvider.mockResolvedValue(true);
    });

    it('비로그인 시 redirect("/login?next=/account")를 호출한다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        await expect(
            deleteApiKeyAction(
                IDLE_STATE,
                makeFormData({ provider: 'anthropic' })
            )
        ).rejects.toThrow(
            `NEXT_REDIRECT:/login?next=${encodeURIComponent('/account')}`
        );

        // `next`는 `URLSearchParams`를 거치며 인코딩된다(프록시 전방 가드와 동일).
        expect(mockRedirect).toHaveBeenCalledWith(
            `/login?next=${encodeURIComponent('/account')}`
        );
    });

    it('provider 필드가 없을 때 status: error를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);

        const result = await deleteApiKeyAction(IDLE_STATE, makeFormData({}));

        expect(result.status).toBe('error');
    });

    it('유효하지 않은 provider일 때 status: error를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);

        const result = await deleteApiKeyAction(
            IDLE_STATE,
            makeFormData({ provider: 'invalid-provider' })
        );

        expect(result.status).toBe('error');
    });

    it('DB 삭제 실패 시 status: error를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);
        mockDeleteByUserAndProvider.mockRejectedValue(
            new Error('DB connection failed')
        );

        const result = await deleteApiKeyAction(
            IDLE_STATE,
            makeFormData({ provider: 'anthropic' })
        );

        expect(result.status).toBe('error');
    });

    it('성공 시 deleteByUserAndProvider 호출 + revalidatePath + status: success', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);

        const result = await deleteApiKeyAction(
            IDLE_STATE,
            makeFormData({ provider: 'anthropic' })
        );

        expect(mockDeleteByUserAndProvider).toHaveBeenCalledWith(
            'user-1',
            'anthropic'
        );
        expect(mockRevalidatePath).toHaveBeenCalledWith(
            '/[locale]/account',
            'page'
        );
        expect(result.status).toBe('success');
        expect(result.message).toBe('삭제되었습니다.');
    });
});
