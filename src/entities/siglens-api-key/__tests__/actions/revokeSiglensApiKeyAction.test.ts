const { mockRevoke, mockInvalidate } = vi.hoisted(() => ({
    mockRevoke: vi.fn(),
    mockInvalidate: vi.fn(),
}));

vi.mock('next-intl/server', async () => {
    const { nextIntlServerStub } =
        await import('@/shared/test-utils/catalogTranslator');
    return nextIntlServerStub();
});
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/entities/siglens-api-key/api', () => ({
    DrizzleSiglensApiKeyRepository: vi.fn().mockImplementation(function () {
        return { revokeOwned: mockRevoke };
    }),
}));
vi.mock('@/entities/siglens-api-key/server/apiKeyAuth', () => ({
    revokeApiKeyAuth: mockInvalidate,
}));

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { revokeSiglensApiKeyAction } from '@/entities/siglens-api-key/actions/revokeSiglensApiKeyAction';
import type { RevokeSiglensApiKeyState } from '@/entities/siglens-api-key/model';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const IDLE: RevokeSiglensApiKeyState = { status: 'idle' };
const USER = { id: '11111111-1111-4111-8111-111111111111' } as never;
const KEY_ID = '33333333-3333-4333-8333-333333333333';
const KEY_HASH = 'b'.repeat(64);

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockInvalidate.mockResolvedValue(true);
});

describe('revokeSiglensApiKeyAction', () => {
    it('본인 id로 폐기하고 그 키의 인증 캐시를 지운다', async () => {
        mockGetCurrentUser.mockResolvedValue(USER);
        mockRevoke.mockResolvedValue({ status: 'revoked', keyHash: KEY_HASH });
        const result = await revokeSiglensApiKeyAction(
            IDLE,
            makeFormData({ keyId: KEY_ID })
        );
        expect(result).toEqual({ status: 'revoked' });
        expect(mockRevoke).toHaveBeenCalledWith(
            '11111111-1111-4111-8111-111111111111',
            KEY_ID
        );
        expect(mockInvalidate).toHaveBeenCalledWith([KEY_HASH]);
        expect(revalidatePath).toHaveBeenCalledWith(
            '/[locale]/account',
            'page'
        );
    });

    it('캐시 삭제가 실패해도 폐기는 성공으로 돌려준다(TTL 안에 만료)', async () => {
        mockGetCurrentUser.mockResolvedValue(USER);
        mockRevoke.mockResolvedValue({ status: 'revoked', keyHash: KEY_HASH });
        mockInvalidate.mockResolvedValue(false);
        await expect(
            revokeSiglensApiKeyAction(IDLE, makeFormData({ keyId: KEY_ID }))
        ).resolves.toEqual({ status: 'revoked' });
    });

    it('남의 키·이미 폐기된 키는 not_found이고 캐시를 건드리지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(USER);
        mockRevoke.mockResolvedValue({ status: 'not_found' });
        const result = await revokeSiglensApiKeyAction(
            IDLE,
            makeFormData({ keyId: KEY_ID })
        );
        expect(result).toMatchObject({ status: 'error', code: 'not_found' });
        expect(mockInvalidate).not.toHaveBeenCalled();
    });

    it.each([
        ['UUID 형식이 아님', 'not-a-uuid'],
        ['빈 값', ''],
        ['SQL 조각', `${KEY_ID}' OR '1'='1`],
    ])('keyId가 %s이면 저장소를 부르지 않고 not_found', async (_l, keyId) => {
        mockGetCurrentUser.mockResolvedValue(USER);
        const result = await revokeSiglensApiKeyAction(
            IDLE,
            makeFormData({ keyId })
        );
        expect(result).toMatchObject({ status: 'error', code: 'not_found' });
        expect(mockRevoke).not.toHaveBeenCalled();
    });

    it('keyId 필드가 없어도 저장소를 부르지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(USER);
        await revokeSiglensApiKeyAction(IDLE, makeFormData({}));
        expect(mockRevoke).not.toHaveBeenCalled();
    });

    it('비로그인은 unauthenticated', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        const result = await revokeSiglensApiKeyAction(
            IDLE,
            makeFormData({ keyId: KEY_ID })
        );
        expect(result).toMatchObject({
            status: 'error',
            code: 'unauthenticated',
        });
        expect(mockRevoke).not.toHaveBeenCalled();
    });

    it('저장소가 던지면 server_error(던지지 않는다)', async () => {
        mockGetCurrentUser.mockResolvedValue(USER);
        mockRevoke.mockRejectedValue(new Error('db down'));
        await expect(
            revokeSiglensApiKeyAction(IDLE, makeFormData({ keyId: KEY_ID }))
        ).resolves.toMatchObject({ status: 'error', code: 'server_error' });
    });
});
