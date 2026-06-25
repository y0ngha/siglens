import type { MockedFunction } from 'vitest';
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { currentUserAction } from '@/entities/auth/actions/currentUserAction';

const mockGet = getCurrentUser as MockedFunction<typeof getCurrentUser>;

describe('currentUserAction', () => {
    it('getCurrentUser 결과를 그대로 반환한다', async () => {
        const fakeUser = { id: 'u1' } as never;
        mockGet.mockResolvedValue(fakeUser);
        await expect(currentUserAction()).resolves.toBe(fakeUser);
    });
});
