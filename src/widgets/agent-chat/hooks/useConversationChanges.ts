'use client';

import { useQuery } from '@tanstack/react-query';
import { getConversationChangesAction } from '@/entities/chat-conversation/actions/getConversationChangesAction';
import type { ChatSymbolChangesResult } from '@/entities/chat-conversation/types';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

const NO_CHANGES: readonly ChatSymbolChangesResult[] = [];

/**
 * 다시 연 대화의 "분석 이후 달라진 점". 서버 액션이 페이지가 뜬 뒤에 계산해 돌려준다 — 카드가
 * 대화 열기를 늦추지 않는다. `conversationId`가 `null`이면 부르지 않는다.
 *
 * 회원 값이라 `gcTime: 0`: 카드가 언마운트되면 항목이 지워져 로그아웃·계정 전환 뒤에 다음 사람에게 남지 않는다
 * (REACT.md#RQ-5). 한 번 받은 값은 화면에 있는 동안 다시 받지 않는다(`staleTime: Infinity`, 포커스 재조회 없음) —
 * 시세가 바뀐다고 카드 문장이 바뀌면 읽던 줄이 흔들린다. 실패는 재시도 없이 "카드 없음"이다.
 */
export function useConversationChanges(conversationId: string | null): {
    readonly results: readonly ChatSymbolChangesResult[];
} {
    const { data } = useQuery({
        queryKey: QUERY_KEYS.conversationChanges(conversationId ?? ''),
        queryFn: () => getConversationChangesAction(conversationId ?? ''),
        enabled: conversationId !== null,
        gcTime: 0,
        staleTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
    return { results: data ?? NO_CHANGES };
}
