jest.mock('@/entities/session/lib/getCurrentUser', () => ({
    getCurrentUser: jest.fn(),
}));

import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { currentUserAction } from '@/entities/session/actions/currentUserAction';

const mockGet = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;

describe('currentUserAction', () => {
    it('getCurrentUser 결과를 그대로 반환한다', async () => {
        const fakeUser = { id: 'u1' } as never;
        mockGet.mockResolvedValue(fakeUser);
        await expect(currentUserAction()).resolves.toBe(fakeUser);
    });
});
