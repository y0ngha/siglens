'use client';

import { useMutation } from '@tanstack/react-query';
import { addMailAlertTopicAction } from '@/entities/mail-alert/actions/addMailAlertTopicAction';
import { removeMailAlertTopicAction } from '@/entities/mail-alert/actions/removeMailAlertTopicAction';
import type {
    MailAlertAddResult,
    MailAlertChangeResult,
    MailAlertTopic,
} from '@/entities/mail-alert/model';

interface AddVariables {
    readonly includePortfolio: boolean;
}

/**
 * 대화상자의 "받기"(코드 없이 이 항목 더하기)와 "그만 받기". 두 요청은 따로 진행되고 각자 자기 결과만
 * 돌려준다 — 한쪽이 진행 중일 때 다른 쪽 버튼이 같이 잠기지 않는다(RQ-6).
 */
export function useMailAlertTopicChange(topic: MailAlertTopic) {
    const add = useMutation<MailAlertAddResult, Error, AddVariables>({
        mutationFn: ({ includePortfolio }) =>
            addMailAlertTopicAction(topic, includePortfolio),
    });
    const remove = useMutation<MailAlertChangeResult, Error, void>({
        mutationFn: () => removeMailAlertTopicAction(topic),
    });
    return { add, remove };
}
