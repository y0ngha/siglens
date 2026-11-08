'use client';

import { useState } from 'react';
import { submitVocFeedbackAction } from '@/entities/feedback/actions/submitVocFeedbackAction';
import type { FeedbackSurface, VocTrigger } from '@/entities/feedback/types';

export type VocSubmitStatus = 'idle' | 'sending' | 'sent' | 'error';

export interface UseVocSubmitResult {
    readonly status: VocSubmitStatus;
    readonly submit: (rating: number, comment: string) => Promise<void>;
}

/** 모달을 띄운 계기 -> 어느 사이트에서 남기는 의견인가. */
const SURFACE_OF_TRIGGER: Record<VocTrigger, FeedbackSurface> = {
    analysis: 'siglens',
    agent_chat: 'siglens_ai',
};

/**
 * VOC 별점 전송. 실패하면 모달을 닫지 않고 `error`로 두어 같은 입력으로 다시 보낼 수 있게 한다 -
 * 별점을 고르고 적은 의견이 한 번의 네트워크 오류로 사라지면 안 된다.
 */
export function useVocSubmit(trigger: VocTrigger): UseVocSubmitResult {
    const [status, setStatus] = useState<VocSubmitStatus>('idle');

    const submit = async (rating: number, comment: string): Promise<void> => {
        if (status === 'sending' || status === 'sent') return;
        setStatus('sending');
        const trimmed = comment.trim();
        try {
            const result = await submitVocFeedbackAction({
                surface: SURFACE_OF_TRIGGER[trigger],
                rating,
                ...(trimmed === '' ? {} : { comment: trimmed }),
                trigger,
                // 쿼리 문자열을 뺀 경로만 보낸다.
                pagePath: window.location.pathname,
            });
            setStatus(result.ok ? 'sent' : 'error');
        } catch {
            setStatus('error');
        }
    };

    return { status, submit };
}
