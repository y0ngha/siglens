import type { MockedFunction } from 'vitest';
import { getRemainingTokensAction } from '../actions/getRemainingTokensAction';
import { createChatTokenStore, hashClientIp } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getOrCreateGuestId } from '@/shared/api/guestId';

const GUEST_ID = '11111111-1111-1111-1111-111111111111';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    createChatTokenStore: vi.fn(),
    hashClientIp: vi.fn((key: string) => `hashed_${key}`),
}));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/api/guestId', () => ({
    getOrCreateGuestId: vi
        .fn()
        .mockResolvedValue('11111111-1111-1111-1111-111111111111'),
}));

const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockGetOrCreateGuestId = getOrCreateGuestId as MockedFunction<
    typeof getOrCreateGuestId
>;
const mockCreateChatTokenStore = createChatTokenStore as MockedFunction<
    typeof createChatTokenStore
>;
const mockHashClientIp = hashClientIp as MockedFunction<typeof hashClientIp>;
const mockGetRemainingTokens = vi.fn();

describe('getRemainingTokensAction 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentUser.mockResolvedValue(null);
        mockGetOrCreateGuestId.mockResolvedValue(GUEST_ID);
        mockCreateChatTokenStore.mockReturnValue({
            tryConsumeToken: vi.fn(),
            getRemainingTokens: mockGetRemainingTokens,
            refundConsumedToken: vi.fn().mockResolvedValue(undefined),
        });
    });

    it('게스트는 쿠키 id(`guest:<id>`)를 해시하여 core 토큰 저장소에 전달한다', async () => {
        mockGetRemainingTokens.mockResolvedValue(3);

        const result = await getRemainingTokensAction();

        expect(mockHashClientIp).toHaveBeenCalledWith(`guest:${GUEST_ID}`);
        expect(mockGetRemainingTokens).toHaveBeenCalledWith(
            `hashed_guest:${GUEST_ID}`
        );
        expect(result).toBe(3);
    });

    it('로그인한 회원은 `user:<userId>`를 해시하여 전달하고 쿠키를 읽지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as Awaited<
            ReturnType<typeof getCurrentUser>
        >);
        mockGetRemainingTokens.mockResolvedValue(4);

        const result = await getRemainingTokensAction();

        expect(mockGetOrCreateGuestId).not.toHaveBeenCalled();
        expect(mockHashClientIp).toHaveBeenCalledWith('user:user-1');
        expect(mockGetRemainingTokens).toHaveBeenCalledWith(
            'hashed_user:user-1'
        );
        expect(result).toBe(4);
    });

    it('오류 발생 시 null을 반환한다', async () => {
        mockGetCurrentUser.mockRejectedValue(new Error('db unavailable'));

        const result = await getRemainingTokensAction();

        expect(result).toBeNull();
    });
});
