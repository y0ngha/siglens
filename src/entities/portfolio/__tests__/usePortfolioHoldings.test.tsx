vi.mock('@/entities/portfolio/actions/getPortfolioHoldingsAction', () => ({
    getPortfolioHoldingsAction: vi.fn(),
}));
vi.mock('@/entities/portfolio/actions/savePortfolioHoldingAction', () => ({
    savePortfolioHoldingAction: vi.fn(),
}));
vi.mock('@/entities/portfolio/actions/deletePortfolioHoldingAction', () => ({
    deletePortfolioHoldingAction: vi.fn(),
}));
// 회원 여부의 두 신호. 기본값은 "힌트 쿠키가 있는 회원" — 아래 기존 케이스들은 회원의
// 보유종목 흐름을 본다. 게스트·미확정 케이스는 '회원 여부에 따른 요청' 블록이 바꿔 쓴다.
const identity = vi.hoisted(() => ({
    hasAuthHint: true,
    currentUser: undefined as { id: string } | null | undefined,
    /** `currentUser` 조회가 실패로 끝났는가 — 데이터는 없지만 더 이상 pending이 아니다. */
    userQueryFailed: false,
}));
vi.mock('@/entities/auth/hooks/useAuthHint', () => ({
    useAuthHint: () => identity.hasAuthHint,
}));
vi.mock('@/entities/auth/hooks/useCurrentUser', () => ({
    useCurrentUser: () => ({
        data: identity.currentUser,
        isPending:
            identity.currentUser === undefined && !identity.userQueryFailed,
    }),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { deletePortfolioHoldingAction } from '@/entities/portfolio/actions/deletePortfolioHoldingAction';
import { getPortfolioHoldingsAction } from '@/entities/portfolio/actions/getPortfolioHoldingsAction';
import { savePortfolioHoldingAction } from '@/entities/portfolio/actions/savePortfolioHoldingAction';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type { PortfolioHoldingView } from '@/entities/portfolio/model';

const mockGetPortfolioHoldingsAction = getPortfolioHoldingsAction as ReturnType<
    typeof vi.fn
>;
const mockSavePortfolioHoldingAction = savePortfolioHoldingAction as ReturnType<
    typeof vi.fn
>;
const mockDeletePortfolioHoldingAction =
    deletePortfolioHoldingAction as ReturnType<typeof vi.fn>;

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10',
    averagePrice: '150.5',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    queryClients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe('usePortfolioHoldings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPortfolioHoldingsAction.mockResolvedValue([]);
        identity.hasAuthHint = true;
        identity.currentUser = undefined;
        identity.userQueryFailed = false;
    });

    afterEach(() => {
        queryClients.splice(0).forEach(c => c.clear());
    });

    it('holdings starts empty while loading, then reflects the fetched list', async () => {
        mockGetPortfolioHoldingsAction.mockResolvedValue([HOLDING]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        expect(result.current.holdings).toEqual([]);

        await waitFor(() => {
            expect(result.current.holdings).toEqual([HOLDING]);
        });
    });

    it('save.mutateAsync calls savePortfolioHoldingAction and invalidates the list on success', async () => {
        mockSavePortfolioHoldingAction.mockResolvedValue({
            status: 'ok',
            holding: HOLDING,
        });
        mockGetPortfolioHoldingsAction
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([HOLDING]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const input = { symbol: 'AAPL', quantity: '10', averagePrice: '150.5' };
        await act(async () => {
            await result.current.save.mutateAsync(input);
        });

        expect(mockSavePortfolioHoldingAction).toHaveBeenCalledWith(input);
        await waitFor(() => {
            expect(mockGetPortfolioHoldingsAction).toHaveBeenCalledTimes(2);
        });
        await waitFor(() => {
            expect(result.current.holdings).toEqual([HOLDING]);
        });
    });

    it('save.mutateAsync does NOT invalidate when the action returns an error result', async () => {
        mockSavePortfolioHoldingAction.mockResolvedValue({
            status: 'error',
            code: 'invalid_symbol',
            message: '올바른 종목 코드를 입력해 주세요.',
        });

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.save.mutateAsync({
                symbol: '!!!',
                quantity: '10',
                averagePrice: '150.5',
            });
        });

        expect(mockGetPortfolioHoldingsAction).toHaveBeenCalledTimes(1);
    });

    it('exposes isError: false on a successful fetch', async () => {
        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isError).toBe(false);
    });

    it('exposes isError: true and an empty holdings list when the read fails, and refetch() re-invokes the query', async () => {
        mockGetPortfolioHoldingsAction
            .mockRejectedValueOnce(new Error('DB connection failed'))
            .mockResolvedValueOnce([HOLDING]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.holdings).toEqual([]);

        result.current.refetch();

        await waitFor(() => expect(result.current.isError).toBe(false));
        expect(result.current.holdings).toEqual([HOLDING]);
    });

    it('remove.mutateAsync calls deletePortfolioHoldingAction and invalidates the list on success', async () => {
        mockDeletePortfolioHoldingAction.mockResolvedValue({ status: 'ok' });
        mockGetPortfolioHoldingsAction
            .mockResolvedValueOnce([HOLDING])
            .mockResolvedValueOnce([]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.remove.mutateAsync('AAPL');
        });

        expect(mockDeletePortfolioHoldingAction).toHaveBeenCalledWith('AAPL');
        await waitFor(() => {
            expect(mockGetPortfolioHoldingsAction).toHaveBeenCalledTimes(2);
        });
        await waitFor(() => {
            expect(result.current.holdings).toEqual([]);
        });
    });

    it('remove.mutateAsync does NOT invalidate when the action returns an error result', async () => {
        mockDeletePortfolioHoldingAction.mockResolvedValue({
            status: 'error',
            code: 'unknown',
            message: '삭제에 실패했어요. 다시 시도해 주세요.',
        });
        mockGetPortfolioHoldingsAction.mockResolvedValue([HOLDING]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.remove.mutateAsync('AAPL');
        });

        expect(mockGetPortfolioHoldingsAction).toHaveBeenCalledTimes(1);
        expect(result.current.holdings).toEqual([HOLDING]);
    });

    /**
     * 보유종목은 회원 전용이라 게스트의 답은 항상 빈 목록이다. 그 요청을 보내면
     * Server Action 큐에서 뒤에 선 요청(분석 스트림을 여는 데 필요한 것들)이 한 번의
     * 왕복만큼 늦어진다.
     */
    describe('회원 여부에 따른 요청', () => {
        it('게스트로 확정되면 요청 없이 빈 목록으로 끝난다', async () => {
            identity.hasAuthHint = false;
            identity.currentUser = null;

            const { result } = renderHook(() => usePortfolioHoldings(), {
                wrapper: makeWrapper(),
            });

            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            expect(result.current.isLoading).toBe(false);
            expect(result.current.holdings).toEqual([]);
            expect(mockGetPortfolioHoldingsAction).not.toHaveBeenCalled();
        });

        it('힌트도 없고 회원 여부도 아직 모르면 요청하지 않되 로딩으로 알린다', async () => {
            identity.hasAuthHint = false;
            identity.currentUser = undefined;

            const { result } = renderHook(() => usePortfolioHoldings(), {
                wrapper: makeWrapper(),
            });

            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            // "아직 모름"을 "빈 목록으로 확정"으로 읽으면 힌트 쿠키만 사라진 회원의
            // 분석이 보유종목 없이 먼저 시작된다.
            expect(result.current.isLoading).toBe(true);
            expect(mockGetPortfolioHoldingsAction).not.toHaveBeenCalled();
        });

        it('힌트가 없어도 회원으로 확정되면 그때 요청한다', async () => {
            identity.hasAuthHint = false;
            identity.currentUser = undefined;
            mockGetPortfolioHoldingsAction.mockResolvedValue([HOLDING]);

            const { result, rerender } = renderHook(
                () => usePortfolioHoldings(),
                { wrapper: makeWrapper() }
            );
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            expect(mockGetPortfolioHoldingsAction).not.toHaveBeenCalled();

            identity.currentUser = { id: 'user-1' };
            rerender();

            // 회원으로 확정된 그 렌더부터 로딩이어야 한다 — 사이에 "확정된 빈 목록"으로
            // 보이는 렌더가 끼면 분석이 보유종목 없이 출발한다.
            expect(result.current.isLoading).toBe(true);
            await waitFor(() =>
                expect(result.current.holdings).toEqual([HOLDING])
            );
            expect(result.current.isLoading).toBe(false);
        });

        /**
         * 로그아웃하면 쿼리는 꺼지지만 직전 회원의 보유종목은 캐시에 남는다. 꺼진 쿼리는
         * 다시 받아 비워 주지 않으므로, 훅이 직접 빈 목록을 돌려줘야 한다.
         */
        it('회원이었다가 게스트가 되면 캐시에 남은 보유종목을 내보내지 않는다', async () => {
            identity.hasAuthHint = true;
            identity.currentUser = { id: 'user-1' };
            mockGetPortfolioHoldingsAction.mockResolvedValue([HOLDING]);
            const { result, rerender } = renderHook(
                () => usePortfolioHoldings(),
                { wrapper: makeWrapper() }
            );
            await waitFor(() =>
                expect(result.current.holdings).toEqual([HOLDING])
            );

            identity.hasAuthHint = false;
            identity.currentUser = null;
            rerender();

            expect(result.current.holdings).toEqual([]);
            expect(result.current.isLoading).toBe(false);
        });

        /**
         * `currentUser` 조회가 실패하면 데이터는 계속 `undefined`다. 그걸 "아직 모름"으로
         * 읽으면 로딩이 영영 안 풀려 첫 분석이 막힌다(분석은 보유종목 확정을 기다린다).
         */
        it('회원 조회가 실패로 끝나면 로딩을 풀고 빈 목록으로 둔다', async () => {
            identity.hasAuthHint = false;
            identity.currentUser = undefined;
            identity.userQueryFailed = true;

            const { result } = renderHook(() => usePortfolioHoldings(), {
                wrapper: makeWrapper(),
            });

            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            expect(result.current.isLoading).toBe(false);
            expect(result.current.holdings).toEqual([]);
            expect(mockGetPortfolioHoldingsAction).not.toHaveBeenCalled();
        });

        it('힌트 쿠키가 있으면 회원 확정을 기다리지 않고 바로 요청한다', async () => {
            identity.hasAuthHint = true;
            identity.currentUser = undefined;

            renderHook(() => usePortfolioHoldings(), {
                wrapper: makeWrapper(),
            });

            await waitFor(() =>
                expect(mockGetPortfolioHoldingsAction).toHaveBeenCalledTimes(1)
            );
        });
    });
});
