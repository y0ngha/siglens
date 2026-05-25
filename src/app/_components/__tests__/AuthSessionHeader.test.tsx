vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}));
vi.mock('@/widgets/layout/Header', () => ({
    Header: ({
        currentUser,
        loadingUserMenu,
    }: {
        currentUser: unknown;
        loadingUserMenu?: boolean;
    }) => (
        <header data-testid="header">
            {currentUser ? 'logged-in' : 'guest'}
            {loadingUserMenu ? '-loading' : ''}
        </header>
    ),
}));
vi.mock('@/entities/session', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/config/cookieNames', () => ({
    AUTH_HINT_COOKIE_NAME: 'auth_hint',
}));

import { cookies } from 'next/headers';
import { getCurrentUser } from '@/entities/session';
import { AuthSessionHeader } from '@/app/_components/AuthSessionHeader';
import type { MockedFunction } from 'vitest';

const mockCookies = cookies as MockedFunction<typeof cookies>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;

describe('AuthSessionHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns a valid ReactNode when no session hint cookie exists', async () => {
        mockCookies.mockResolvedValue({
            get: vi.fn().mockReturnValue(undefined),
        } as never);
        mockGetCurrentUser.mockResolvedValue(null);

        const result = await AuthSessionHeader();

        expect(result).toBeDefined();
    });

    it('returns a valid ReactNode when session hint cookie exists', async () => {
        mockCookies.mockResolvedValue({
            get: vi.fn().mockReturnValue({ value: '1' }),
        } as never);
        mockGetCurrentUser.mockResolvedValue({
            id: '1',
            email: 'test@test.com',
            name: 'Test',
            tier: 'free',
            avatarUrl: null,
        } as never);

        const result = await AuthSessionHeader();

        expect(result).toBeDefined();
    });
});
