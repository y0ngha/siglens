jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: jest.fn(),
}));

import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { currentUserAction } from '@/infrastructure/auth/currentUserAction';

const mockGet = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;

describe('currentUserAction', () => {
    it('getCurrentUser 결과를 그대로 반환한다', async () => {
        const fakeUser = { id: 'u1' } as never;
        mockGet.mockResolvedValue(fakeUser);
        await expect(currentUserAction()).resolves.toBe(fakeUser);
    });
});
