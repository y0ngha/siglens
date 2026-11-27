'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { confirmPriceAlertAction } from '@/entities/mail-alert/actions/confirmPriceAlertAction';
import { createPriceAlertAction } from '@/entities/mail-alert/actions/createPriceAlertAction';
import { getPriceAlertProposalStateAction } from '@/entities/mail-alert/actions/getPriceAlertProposalStateAction';
import type { PriceAlertConfirmState } from '@/entities/mail-alert/model';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useMailAlertCodeFlow } from './useMailAlertCodeFlow';

/**
 * 카드가 마운트될 때 이 제안의 상태를 서버에서 읽는다. 렌더 중에는 아무것도 읽지 않는다. 캐시는 카드가 보이는 동안만
 * 산다(`gcTime: 0`): 세션·쿠키마다 답이 달라 다음 사람에게 남기지 않는다. 토큰은 제안 id와 같은 사람이 만든
 * 값이라 키에는 id만 쓴다(토큰을 키에 두면 서명된 값이 React Query 개발 도구·로그에 번진다, CR-8).
 */
export function usePriceAlertProposalState(proposalId: string, token: string) {
    return useQuery({
        queryKey: QUERY_KEYS.priceAlertProposalState(proposalId),
        queryFn: () => getPriceAlertProposalStateAction(token),
        staleTime: 0,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
    });
}

/**
 * 만들기 버튼. 에이전트가 아니라 사용자의 클릭만 알림을 만든다. 결과는 호출자가 읽는다(`data`).
 * 같은 토큰으로 다시 눌러도 서버가 한 번만 만든다(제안 id로 멱등).
 */
export function useCreatePriceAlert() {
    return useMutation({
        mutationFn: (token: string) => createPriceAlertAction(token),
    });
}

const IDLE_CONFIRM: PriceAlertConfirmState = { status: 'idle' };

/**
 * 비회원의 코드 확인 두 단계와 그 결과. 카드가 이 결과(만들었음 등)를 읽어 위쪽 요약을 저장된 값으로 바꿔야 하므로
 * 폼이 아니라 카드가 들고, 지연 로드되는 폼에는 prop으로 넘긴다.
 */
export function usePriceAlertCodeFlow() {
    return useMailAlertCodeFlow(confirmPriceAlertAction, IDLE_CONFIRM);
}

export type PriceAlertCodeFlow = ReturnType<typeof usePriceAlertCodeFlow>;
