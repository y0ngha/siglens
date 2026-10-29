'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisRateLimitPayload } from '@/shared/lib/sse/analysisRateLimit';
import { subscribeAnalysisRateLimited } from '@/shared/lib/sse/analysisRateLimitSignal';
import { shouldOpenSignupModal } from '../lib/shouldOpenSignupModal';

/** {@link useAnalysisRateLimitNotice}의 반환값. */
export interface AnalysisRateLimitNotice {
    /** 모달로 보여 줄 거절 알림. 닫혀 있으면 `null`. */
    readonly notice: AnalysisRateLimitPayload | null;
    /** 모달을 닫는다. 같은 한도 창의 알림은 다시 열지 않는다. */
    readonly dismiss: () => void;
}

/**
 * 분석 스트림의 `rate_limited` 발행을 구독해, 가입 유도 모달로 띄울 알림을 고른다.
 *
 * 같은 한도 창에서는 한 번만 연다 — 종목 페이지는 여러 축을 동시에 요청하므로,
 * 닫은 뒤 다른 탭으로 옮길 때마다 같은 모달이 다시 뜨면 성가시다. 판단 기준은
 * {@link shouldOpenSignupModal}.
 */
export function useAnalysisRateLimitNotice(): AnalysisRateLimitNotice {
    const [notice, setNotice] = useState<AnalysisRateLimitPayload | null>(null);
    // 렌더에 쓰지 않는 중복 억제 기준이라 ref다.
    const lastShownRetryAtRef = useRef(0);

    useEffect(
        () =>
            subscribeAnalysisRateLimited(payload => {
                if (
                    !shouldOpenSignupModal(payload, lastShownRetryAtRef.current)
                ) {
                    return;
                }
                lastShownRetryAtRef.current = payload.retryAt;
                setNotice(payload);
            }),
        []
    );

    const dismiss = useCallback(() => setNotice(null), []);
    return { notice, dismiss };
}
