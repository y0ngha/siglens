// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useDeleteAccountForm } from '@/features/account-delete/hooks/useDeleteAccountForm';
import { deleteAccountAction } from '@/features/account-delete/actions/deleteAccountAction';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockSetQueryData = vi.fn();
const mockRemoveQueries = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        setQueryData: mockSetQueryData,
        removeQueries: mockRemoveQueries,
        invalidateQueries: mockInvalidateQueries,
    }),
}));

vi.mock('@/features/account-delete/actions/deleteAccountAction', () => ({
    deleteAccountAction: vi.fn(),
}));

const mockDeleteAccountAction = vi.mocked(deleteAccountAction);

describe('useDeleteAccountForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useDeleteAccountForm());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({ error: null });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() => useDeleteAccountForm());
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });

    /**
     * 회귀: 탈퇴가 `useLogout`과 달리 React Query 캐시를 비우지 않아, 소프트 이동한
     * 홈에서 지워진 회원의 사용자 정보·보유종목이 남아 보였다.
     */
    it('sets currentUser to null and clears holdings and email-report caches', async () => {
        // 성공 경로는 서버 리다이렉트라 돌아오지 않는다.
        mockDeleteAccountAction.mockReturnValue(new Promise(() => {}));
        const { result } = renderHook(() => useDeleteAccountForm());

        await act(async () => {
            result.current[1](makeFormData({ email: 'user@example.com' }));
        });

        expect(mockSetQueryData).toHaveBeenCalledWith(
            QUERY_KEYS.currentUser(),
            null
        );
        expect(mockRemoveQueries).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.portfolioHoldings(),
        });
        expect(mockRemoveQueries).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.emailReportSettings(),
        });
        expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });

    /**
     * 회귀: 관심종목(staleTime 5분)·등록 API 키(1분) 캐시가 남아 같은 탭의 다음
     * 사용자가 지워진 회원의 관심종목을 보고, 남은 등록 키로 BYOK 게이트를 건너뛰었다.
     */
    it('clears every member-scoped cache before the action runs', async () => {
        let removedBeforeAction: unknown[] = [];
        mockDeleteAccountAction.mockImplementation(() => {
            removedBeforeAction = mockRemoveQueries.mock.calls.map(
                ([filters]) => filters
            );
            return new Promise(() => {});
        });
        const { result } = renderHook(() => useDeleteAccountForm());

        await act(async () => {
            result.current[1](makeFormData({ email: 'user@example.com' }));
        });

        // 리터럴로 고정한다 — 목록에서 키 하나가 빠지는 회귀도 여기서 실패한다.
        expect(removedBeforeAction).toEqual(
            expect.arrayContaining([
                { queryKey: ['portfolio-holdings'] },
                { queryKey: ['watchlist'] },
                { queryKey: ['email-report-settings'] },
                { queryKey: ['llm', 'registered-providers'] },
            ])
        );
    });

    it('refetches currentUser when deletion fails (user is still signed in)', async () => {
        mockDeleteAccountAction.mockResolvedValue({
            error: { code: 'user_not_found', message: 'x' },
        });
        const { result } = renderHook(() => useDeleteAccountForm());

        await act(async () => {
            result.current[1](makeFormData({ email: 'user@example.com' }));
        });

        expect(result.current[0].error?.code).toBe('user_not_found');
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.currentUser(),
        });
    });
});
