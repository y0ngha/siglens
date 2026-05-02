const mockFindByUser = jest.fn();

jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: jest.fn(),
}));
jest.mock('@/infrastructure/db/client', () => ({
    getDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));
jest.mock('@/infrastructure/db/userApiKeyRepository', () => ({
    DrizzleUserApiKeyRepository: jest.fn().mockImplementation(() => ({
        findByUser: mockFindByUser,
    })),
}));

import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getRegisteredProvidersAction } from '@/infrastructure/llm/getRegisteredProvidersAction';

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
    typeof getCurrentUser
>;

describe('getRegisteredProvidersAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindByUser.mockResolvedValue([]);
    });

    it('비로그인 시 빈 배열을 반환하고 redirect를 호출하지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        const result = await getRegisteredProvidersAction();

        expect(result).toEqual([]);
        expect(mockFindByUser).not.toHaveBeenCalled();
    });

    it('로그인했지만 등록된 provider가 없으면 빈 배열을 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);
        mockFindByUser.mockResolvedValue([]);

        const result = await getRegisteredProvidersAction();

        expect(result).toEqual([]);
    });

    it('로그인 + 2개 provider → RegisteredProvider[] 반환, apiKey 필드 없음', async () => {
        const updatedAt1 = new Date('2026-05-01T00:00:00.000Z');
        const updatedAt2 = new Date('2026-05-02T00:00:00.000Z');

        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);
        mockFindByUser.mockResolvedValue([
            {
                id: 'key-1',
                userId: 'user-1',
                provider: 'google',
                createdAt: new Date(),
                updatedAt: updatedAt1,
            },
            {
                id: 'key-2',
                userId: 'user-1',
                provider: 'anthropic',
                createdAt: new Date(),
                updatedAt: updatedAt2,
            },
        ]);

        const result = await getRegisteredProvidersAction();

        expect(result).toHaveLength(2);
        expect(result).toEqual(
            expect.arrayContaining([
                { provider: 'google', updatedAt: updatedAt1 },
                { provider: 'anthropic', updatedAt: updatedAt2 },
            ])
        );
        for (const item of result) {
            expect(Object.keys(item)).toEqual(
                expect.arrayContaining(['provider', 'updatedAt'])
            );
            expect(Object.keys(item)).toHaveLength(2);
        }
    });

    it('결과가 provider 기준 알파벳 오름차순으로 정렬되어 있다', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            email: 'test@example.com',
        } as never);
        mockFindByUser.mockResolvedValue([
            {
                id: 'key-2',
                userId: 'user-1',
                provider: 'openai',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'key-1',
                userId: 'user-1',
                provider: 'anthropic',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'key-3',
                userId: 'user-1',
                provider: 'google',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);

        const result = await getRegisteredProvidersAction();

        expect(result.map(r => r.provider)).toEqual([
            'anthropic',
            'google',
            'openai',
        ]);
    });
});
