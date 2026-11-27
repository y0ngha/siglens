'use client';

import { useQuery } from '@tanstack/react-query';
import { getMailAlertStateAction } from '@/entities/mail-alert/actions/getMailAlertStateAction';
import { topicToRow } from '@/entities/mail-alert/lib/topics';
import type { MailAlertTopic } from '@/entities/mail-alert/model';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

/**
 * 대화상자가 마운트될 때(= 버튼을 눌렀을 때) 이 화면 항목의 상태를 서버에서 읽는다. 렌더 중에는 아무것도
 * 읽지 않는다. 캐시는 대화상자가 열려 있는 동안만 산다(`gcTime: 0`): 세션·쿠키마다 답이 달라 다음 사람에게
 * 남기지 않는다.
 */
export function useMailAlertState(topic: MailAlertTopic) {
    const { kind, key } = topicToRow(topic);
    return useQuery({
        queryKey: QUERY_KEYS.mailAlertState(kind, key),
        queryFn: () => getMailAlertStateAction(topic),
        staleTime: 0,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
    });
}
