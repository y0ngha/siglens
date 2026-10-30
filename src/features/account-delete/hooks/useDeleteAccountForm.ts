'use client';

/**
 * 탈퇴 폼의 Server Action 연결과, 탈퇴 직전 회원 전용 React Query 캐시 정리.
 */
import { useActionState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { DeleteAccountFormState } from '@/shared/lib/auth/formTypes';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { deleteAccountAction } from '../actions/deleteAccountAction';

const INITIAL_STATE: DeleteAccountFormState = { error: null };

/**
 * 탈퇴 직전에 캐시에서 지우는 회원 전용 쿼리. 남겨 두면 같은 탭의 다음 사용자가
 * staleTime(관심종목 5분, 등록 API 키 1분) 동안 지워진 회원의 데이터를 보고,
 * 남은 `registeredProviders`로 BYOK 게이트까지 건너뛴다.
 * `registeredProviders`는 정확한 키로 지운다 — `['llm']` 접두사에는 사용자와
 * 무관한 전역 쿼리(`disabledServerKeyModels`)도 있다.
 */
const MEMBER_SCOPED_QUERY_KEYS: readonly QueryKey[] = [
    QUERY_KEYS.portfolioHoldings(),
    QUERY_KEYS.watchlist(),
    QUERY_KEYS.emailReportSettings(),
    QUERY_KEYS.registeredProviders(),
];

type UseDeleteAccountFormReturn = ReturnType<
    typeof useActionState<DeleteAccountFormState, FormData>
>;

/**
 * 탈퇴 폼 액션. 성공 경로는 서버 리다이렉트라 클라이언트가 "성공"을 돌려받지 못한다 —
 * 그래서 캐시 정리를 **액션 호출 전에** 한다. 정리하지 않으면 소프트 이동한 홈에서
 * 지워진 회원의 사용자 정보·보유종목·관심종목이 React Query 캐시에 남아 잠깐 보이고,
 * 같은 브라우저의 다음 사용자에게도 새어 나간다.
 *
 * 액션이 에러를 돌려주면(탈퇴 실패) 여전히 로그인 상태다 — 비워 둔 `currentUser`를
 * 다시 불러오도록 무효화한다. 지운 회원 쿼리는 다음 조회가 다시 채운다.
 */
export function useDeleteAccountForm(): UseDeleteAccountFormReturn {
    const queryClient = useQueryClient();
    return useActionState<DeleteAccountFormState, FormData>(
        async (prev, formData) => {
            queryClient.setQueryData(QUERY_KEYS.currentUser(), null);
            MEMBER_SCOPED_QUERY_KEYS.forEach(queryKey =>
                queryClient.removeQueries({ queryKey })
            );
            const next = await deleteAccountAction(prev, formData);
            if (next.error) {
                void queryClient.invalidateQueries({
                    queryKey: QUERY_KEYS.currentUser(),
                });
            }
            return next;
        },
        INITIAL_STATE
    );
}
