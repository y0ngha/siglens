'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { cancelPriceAlertAction } from '@/entities/mail-alert/actions/cancelPriceAlertAction';
import { removeMailAlertTopicAction } from '@/entities/mail-alert/actions/removeMailAlertTopicAction';
import { setMailAlertIncludePortfolioAction } from '@/entities/mail-alert/actions/setMailAlertIncludePortfolioAction';
import { unsubscribeMailAlertAction } from '@/entities/mail-alert/actions/unsubscribeMailAlertAction';
import { topicToRow } from '@/entities/mail-alert/lib/topics';
import type {
    MailAlertChangeResult,
    MailAlertLinkAuth,
    MailAlertTopic,
} from '@/entities/mail-alert/model';

interface UseMailAlertManageInput {
    readonly topics: readonly MailAlertTopic[];
    /** 회원이면 현재 값, 아니면 `null`(스위치를 보이지 않는다). */
    readonly includePortfolio: boolean | null;
    /** 메일 속 서명 링크로 들어왔을 때만. 아니면 서버가 세션·쿠키로 소유자를 정한다. */
    readonly link?: MailAlertLinkAuth;
}

function rowKeyOf(topic: MailAlertTopic): string {
    const { kind, key } = topicToRow(topic);
    return `${kind}:${key}`;
}

/** 이미 없는 항목(`not_found`)도 화면에서는 뺀다 — 그만 받겠다는 목적이 이미 이뤄졌다. */
function isGone(result: MailAlertChangeResult): boolean {
    return (
        result.status === 'ok' ||
        result.status === 'subscriber_removed' ||
        result.status === 'not_found'
    );
}

/**
 * 설정 화면의 변경들. 서버가 처음 준 목록을 기준으로, 성공한 제거를 화면에 바로 반영한다. 항목 제거와
 * 전체 해지, 가격대 알림 지우기, 보유·관심종목 스위치는 각자 자기 요청의 진행 상태와 결과를 가진다(RQ-6). 마지막 항목을
 * 지우면 서버가 구독자도 지우므로(`subscriber_removed`) 전체 해지와 같은 "모두 그만 받았어요" 상태가 된다. 가격대
 * 알림도 같다 — 항목 없이 알림만 있던 구독자가 마지막 알림을 지우면 서버가 구독자를 지운다.
 */
export function useMailAlertManage({
    topics,
    includePortfolio,
    link,
}: UseMailAlertManageInput) {
    const [removedKeys, setRemovedKeys] = useState<readonly string[]>([]);
    const [removedAlertIds, setRemovedAlertIds] = useState<readonly string[]>(
        []
    );
    const [isAllStopped, setAllStopped] = useState(false);
    const [portfolioOn, setPortfolioOn] = useState(includePortfolio === true);

    const remove = useMutation<MailAlertChangeResult, Error, MailAlertTopic>({
        mutationFn: topic => removeMailAlertTopicAction(topic, link),
        onSuccess: (result, topic) => {
            if (result.status === 'subscriber_removed') setAllStopped(true);
            if (isGone(result)) {
                setRemovedKeys(keys => [...keys, rowKeyOf(topic)]);
            }
        },
    });
    const cancelAlert = useMutation<MailAlertChangeResult, Error, string>({
        mutationFn: alertId => cancelPriceAlertAction(alertId, link),
        onSuccess: (result, alertId) => {
            if (result.status === 'subscriber_removed') setAllStopped(true);
            if (isGone(result)) {
                setRemovedAlertIds(ids => [...ids, alertId]);
            }
        },
    });
    const unsubscribeAll = useMutation<MailAlertChangeResult, Error, void>({
        mutationFn: () => unsubscribeMailAlertAction(link),
        onSuccess: result => {
            if (isGone(result)) setAllStopped(true);
        },
    });
    const setPortfolio = useMutation<MailAlertChangeResult, Error, boolean>({
        mutationFn: value => setMailAlertIncludePortfolioAction(value),
        onSuccess: (result, value) => {
            if (result.status === 'subscriber_removed') setAllStopped(true);
            else if (result.status === 'ok') setPortfolioOn(value);
        },
    });

    const removed = new Set(removedKeys);
    return {
        visibleTopics: topics.filter(topic => !removed.has(rowKeyOf(topic))),
        isAllStopped,
        portfolioOn,
        remove,
        cancelAlert,
        removedAlertIds,
        unsubscribeAll,
        setPortfolio,
    };
}
