const mockUpsert = jest.fn();

jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: jest.fn(),
}));
jest.mock('@/infrastructure/db/client', () => ({
    getDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));
jest.mock('next/navigation', () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
jest.mock('@/infrastructure/db/userApiKeyRepository', () => ({
    DrizzleUserApiKeyRepository: jest.fn().mockImplementation(() => ({
        upsert: mockUpsert,
    })),
}));

import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveApiKeyAction } from '@/infrastructure/llm/saveApiKeyAction';
import { makeFormData } from '@/__tests__/utils/makeFormData';
import type { ApiKeyActionState } from '@/domain/llm';

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
    typeof getCurrentUser
>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<
    typeof revalidatePath
>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

const IDLE_STATE: ApiKeyActionState = { status: 'idle', message: null };

describe('saveApiKeyAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUpsert.mockResolvedValue({
            id: 'key-1',
            userId: 'user-1',
            provider: 'anthropic',
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    });

    it('비로그인 시 redirect("/login?next=/account")를 호출한다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        await expect(
            saveApiKeyAction(
                IDLE_STATE,
                makeFormData({ provider: 'anthropic', apiKey: 'sk-ant-test' })
            )
        ).rejects.toThrow('NEXT_REDIRECT:/login?next=/account');

        expect(mockRedirect).toHaveBeenCalledWith('/login?next=/account');
    });

    it('provider가 유효하지 않을 때 status: error를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);

        const result = await saveApiKeyAction(
            IDLE_STATE,
            makeFormData({
                provider: 'invalid-provider',
                apiKey: 'sk-ant-test',
            })
        );

        expect(result.status).toBe('error');
    });

    it('apiKey가 빈 문자열일 때 status: error를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);

        const result = await saveApiKeyAction(
            IDLE_STATE,
            makeFormData({ provider: 'anthropic', apiKey: '   ' })
        );

        expect(result.status).toBe('error');
    });

    it('DB upsert 실패 시 status: error를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);
        mockUpsert.mockRejectedValue(new Error('DB connection failed'));

        const result = await saveApiKeyAction(
            IDLE_STATE,
            makeFormData({ provider: 'anthropic', apiKey: 'sk-ant-test-1234' })
        );

        expect(result.status).toBe('error');
    });

    it('정상 입력 시 upsert 호출 + revalidatePath("/account") + status: success', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);

        const result = await saveApiKeyAction(
            IDLE_STATE,
            makeFormData({ provider: 'anthropic', apiKey: 'sk-ant-test-1234' })
        );

        expect(mockUpsert).toHaveBeenCalledWith({
            userId: 'user-1',
            provider: 'anthropic',
            apiKey: 'sk-ant-test-1234',
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith('/account');
        expect(result.status).toBe('success');
        expect(result.message).toBe('API 키가 저장되었습니다.');
    });
});
