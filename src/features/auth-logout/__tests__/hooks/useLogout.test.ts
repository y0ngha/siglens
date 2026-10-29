// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useLogout } from '@/features/auth-logout/hooks/useLogout';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

const mockSetQueryData = vi.fn();
const mockRemoveQueries = vi.fn();
const mockLogoutAction = vi.fn().mockResolvedValue(undefined);

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        setQueryData: mockSetQueryData,
        removeQueries: mockRemoveQueries,
    }),
}));

vi.mock('@/features/auth-logout/actions/logoutAction', () => ({
    logoutAction: (...args: unknown[]) => mockLogoutAction(...args),
}));

describe('useLogout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns pending: false and a logout function', () => {
        const { result } = renderHook(() => useLogout());

        expect(result.current.pending).toBe(false);
        expect(typeof result.current.logout).toBe('function');
    });

    it('calls setQueryData with null for currentUser key and invokes logoutAction on logout', async () => {
        const { result } = renderHook(() => useLogout());

        await act(async () => {
            result.current.logout();
        });

        expect(mockSetQueryData).toHaveBeenCalledWith(
            QUERY_KEYS.currentUser(),
            null
        );
        expect(mockLogoutAction).toHaveBeenCalled();
    });

    it('removes the portfolio holdings query from the cache on logout', async () => {
        const { result } = renderHook(() => useLogout());

        await act(async () => {
            result.current.logout();
        });

        expect(mockRemoveQueries).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.portfolioHoldings(),
        });
        expect(mockRemoveQueries).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.emailReportSettings(),
        });
    });

    // The post-logout redirect is a soft navigation, so these entries would
    // otherwise be served to the next member who signs in on the same tab.
    it('removes the watchlist and registered-providers queries from the cache on logout', async () => {
        const { result } = renderHook(() => useLogout());

        await act(async () => {
            result.current.logout();
        });

        expect(mockRemoveQueries).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.watchlist(),
        });
        expect(mockRemoveQueries).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.registeredProviders(),
        });
        expect(mockRemoveQueries).toHaveBeenCalledTimes(4);
    });

    it('clears the cache before calling logoutAction', async () => {
        const { result } = renderHook(() => useLogout());

        await act(async () => {
            result.current.logout();
        });

        expect(mockRemoveQueries.mock.invocationCallOrder.at(-1)!).toBeLessThan(
            mockLogoutAction.mock.invocationCallOrder[0]!
        );
    });

    it('logout function is always callable after re-render', () => {
        const { result, rerender } = renderHook(() => useLogout());

        rerender();

        expect(typeof result.current.logout).toBe('function');
    });
});
