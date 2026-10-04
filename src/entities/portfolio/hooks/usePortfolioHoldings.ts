'use client';

import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useAuthHint } from '@/entities/auth/hooks/useAuthHint';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import {
    PORTFOLIO_HOLDINGS_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import { deletePortfolioHoldingAction } from '@/entities/portfolio/actions/deletePortfolioHoldingAction';
import { getPortfolioHoldingsAction } from '@/entities/portfolio/actions/getPortfolioHoldingsAction';
import { savePortfolioHoldingAction } from '@/entities/portfolio/actions/savePortfolioHoldingAction';
import type {
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
    DeletePortfolioResult,
} from '../model';

interface UsePortfolioHoldingsReturn {
    holdings: PortfolioHoldingView[];
    isHydrated: boolean;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
    save: UseMutationResult<SavePortfolioResult, Error, RawHoldingInput>;
    remove: UseMutationResult<DeletePortfolioResult, Error, string>;
}

/**
 * Fetches the current member's holdings and exposes save/delete mutations that invalidate the list on success.
 *
 * **게스트에게는 요청하지 않는다.** 보유종목은 회원 전용이라 게스트의 답은 항상 빈 목록인데,
 * 예전에는 종목 페이지를 여는 모든 방문자가 이 액션을 한 번씩 보냈다. Server Action은 한 번에
 * 하나씩만 나가므로(운영 실측 한 건 ~0.3s) 그 한 번이 분석 스트림 시작을 그만큼 늦췄다 —
 * `useAnalysis`는 보유종목이 확정될 때까지 첫 분석 요청을 미룬다.
 *
 * 회원 여부는 두 신호로 판단한다:
 *   - 힌트 쿠키가 있으면 지금처럼 하이드레이션 즉시 요청한다(회원의 타이밍은 그대로).
 *   - 힌트가 없으면 `currentUser`가 확정될 때까지 기다린다. 그동안은 `isLoading`을 true로
 *     돌려 "아직 모름"을 "빈 목록으로 확정"과 구분한다 — 힌트 쿠키만 사라진 회원이 보유종목
 *     없이 분석을 먼저 시작하지 않게 한다. 게스트로 확정되거나 조회가 실패하면 요청 없이
 *     빈 목록으로 끝난다.
 */
export function usePortfolioHoldings(): UsePortfolioHoldingsReturn {
    const isHydrated = useHydrated();
    const hasAuthHint = useAuthHint();
    const { data: currentUser, isPending: isUserPending } = useCurrentUser();
    const qc = useQueryClient();

    const isMemberLikely = hasAuthHint || currentUser != null;
    // "아직 모름"은 쿼리 상태로 판단한다. 데이터(`undefined`)로 판단하면 `currentUser` 조회가
    // 실패했을 때 영영 로딩으로 남아 첫 분석이 막힌다 — tier 쪽(`useUserTier`)도 같은
    // `isPending` 기준이라, 실패하면 둘 다 "게스트로 확정"으로 떨어진다.
    const isIdentityPending = !hasAuthHint && isUserPending;

    const {
        data,
        isLoading: isQueryLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: QUERY_KEYS.portfolioHoldings(),
        queryFn: () => getPortfolioHoldingsAction(),
        enabled: isHydrated && isMemberLikely,
        staleTime: PORTFOLIO_HOLDINGS_STALE_TIME_MS,
    });
    const isLoading = isQueryLoading || (isHydrated && isIdentityPending);

    const save = useMutation<SavePortfolioResult, Error, RawHoldingInput>({
        mutationFn: input => savePortfolioHoldingAction(input),
        onSuccess: result => {
            if (result.status === 'ok') {
                qc.invalidateQueries({
                    queryKey: QUERY_KEYS.portfolioHoldings(),
                });
            }
        },
    });

    const remove = useMutation<DeletePortfolioResult, Error, string>({
        mutationFn: symbol => deletePortfolioHoldingAction(symbol),
        onSuccess: result => {
            if (result.status === 'ok') {
                qc.invalidateQueries({
                    queryKey: QUERY_KEYS.portfolioHoldings(),
                });
            }
        },
    });

    // 회원이 아니면 캐시에 무엇이 남아 있든 빈 목록이다. 쿼리를 끄기만 하면 로그아웃한
    // 뒤에도 직전 회원의 보유종목이 캐시에 남아 그대로 노출된다 — 꺼진 쿼리는 다시 받아
    // 비워 주지 않는다.
    const holdings: PortfolioHoldingView[] = isMemberLikely ? (data ?? []) : [];

    return {
        holdings,
        isHydrated,
        isLoading,
        isError,
        refetch: () => {
            void refetch();
        },
        save,
        remove,
    };
}
