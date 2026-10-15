const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/entities/siglens-api-key/api', () => ({
    DrizzleSiglensApiKeyRepository: vi.fn().mockImplementation(function () {
        return { listActiveByUser: mockList };
    }),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { listSiglensApiKeysAction } from '@/entities/siglens-api-key/actions/listSiglensApiKeysAction';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const USER_ID = '11111111-1111-4111-8111-111111111111';
const rows = [
    {
        id: '33333333-3333-4333-8333-333333333333',
        name: '내 에이전트',
        keyPrefix: 'slk_ab12cd',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        lastUsedAt: null,
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('listSiglensApiKeysAction', () => {
    it('로그인한 본인의 키 목록을 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: USER_ID } as never);
        mockList.mockResolvedValue(rows);
        await expect(listSiglensApiKeysAction()).resolves.toEqual(rows);
        expect(mockList).toHaveBeenCalledWith(USER_ID);
    });

    it('비로그인은 저장소 없이 빈 목록', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        await expect(listSiglensApiKeysAction()).resolves.toEqual([]);
        expect(mockList).not.toHaveBeenCalled();
    });

    it('조회가 실패하면 빈 목록이 아니라 null(화면이 "키 없음"이라 거짓말하지 않게)', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: USER_ID } as never);
        mockList.mockRejectedValue(new Error('db down'));
        await expect(listSiglensApiKeysAction()).resolves.toBeNull();
        expect(console.error).toHaveBeenCalled();
    });

    it('세션 조회 오류는 삼키지 않고 전파한다 (Next 동적 렌더 신호 보존)', async () => {
        const dynamicUsage = new Error('Dynamic server usage');
        mockGetCurrentUser.mockRejectedValue(dynamicUsage);
        await expect(listSiglensApiKeysAction()).rejects.toBe(dynamicUsage);
    });
});
