import { vi, type MockedFunction } from 'vitest';
const { mockDeleteByUserAndProvider } = vi.hoisted(() => ({
    mockDeleteByUserAndProvider: vi.fn(),
}));

vi.mock('@/entities/session/lib/getCurrentUser', () => ({
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
vi.mock('@/entities/api-key', () => ({
    DrizzleUserApiKeyRepository: vi.fn().mockImplementation(function() { return {
        deleteByUserAndProvider: mockDeleteByUserAndProvider,
    }; }),
}));

import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteApiKeyAction } from '@/entities/api-key/actions/deleteApiKeyAction';
import { makeFormData } from '@/shared/test-utils/makeFormData';
import type { ApiKeyActionState } from '@/entities/api-key/lib';

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
        ).rejects.toThrow('NEXT_REDIRECT:/login?next=/account');

        expect(mockRedirect).toHaveBeenCalledWith('/login?next=/account');
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
        expect(mockRevalidatePath).toHaveBeenCalledWith('/account');
        expect(result.status).toBe('success');
        expect(result.message).toBe('삭제되었습니다.');
    });
});
