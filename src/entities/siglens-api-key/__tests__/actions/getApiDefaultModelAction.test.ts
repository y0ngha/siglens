const { mockFind } = vi.hoisted(() => ({ mockFind: vi.fn() }));
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/entities/siglens-api-key/api', () => ({
    DrizzleSiglensApiKeyRepository: vi.fn().mockImplementation(function () {
        return { findApiDefaultModel: mockFind };
    }),
}));

import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { getApiDefaultModelAction } from '@/entities/siglens-api-key/actions/getApiDefaultModelAction';

const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('getApiDefaultModelAction', () => {
    it('본인의 저장된 기본 모델을 돌려준다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never);
        mockFind.mockResolvedValue('claude-opus-5');
        await expect(getApiDefaultModelAction()).resolves.toBe('claude-opus-5');
        expect(mockFind).toHaveBeenCalledWith(USER_ID);
    });

    it('비로그인은 null이고 DB를 읽지 않는다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null);
        await expect(getApiDefaultModelAction()).resolves.toBeNull();
        expect(mockFind).not.toHaveBeenCalled();
    });

    it('조회 실패는 던지지 않고 null (로그는 남긴다)', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never);
        mockFind.mockRejectedValue(new Error('db down'));
        await expect(getApiDefaultModelAction()).resolves.toBeNull();
        expect(console.error).toHaveBeenCalledWith(
            '[getApiDefaultModelAction] failed:',
            {
                name: 'Error',
                code: undefined,
            }
        );
    });
});
