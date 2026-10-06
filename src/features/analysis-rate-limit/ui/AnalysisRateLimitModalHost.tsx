'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { formatRetryAt } from '@/shared/lib/formatRetryAt';
import type { AnalysisRateLimitPayload } from '@/shared/lib/sse/analysisRateLimit';
import { subscribeAnalysisRateLimited } from '@/shared/lib/sse/analysisRateLimitSignal';
import { AnalysisRateLimitSignupModal } from './AnalysisRateLimitSignupModal';

/**
 * 비회원 생성 한도 모달의 단일 호스트. 루트 레이아웃에 한 번만 마운트한다.
 *
 * 분석 스트림(`runAnalysisStream`)이 `rate_limited`를 받으면 발행하고, 여기서
 * 구독해 연다. 회원(`member`)과 저장소 장애(`reason: 'unavailable'`)는 모달 없이
 * 각 위젯의 배너 문구만 받는다.
 *
 * 같은 한도 창에서는 한 번만 연다 — 종목 페이지는 여러 축을 동시에 요청하므로,
 * 닫은 뒤 다른 탭으로 옮길 때마다 같은 모달이 다시 뜨면 성가시다. 재시도 시각이
 * 더 늦은 새 거절(예: 시간 한도 → 일 한도)만 다시 띄운다.
 */
export function AnalysisRateLimitModalHost() {
    const locale = useCurrentLocale();
    const [notice, setNotice] = useState<AnalysisRateLimitPayload | null>(null);
    // 렌더에 쓰지 않는 중복 억제 기준이라 ref다.
    const lastShownRetryAtRef = useRef(0);

    useEffect(
        () =>
            subscribeAnalysisRateLimited(payload => {
                // 저장소 장애(`unavailable`)는 한도를 쓴 게 아니라 가입을 권하지 않는다.
                if (payload.audience !== 'guest') return;
                if (payload.reason !== 'quota') return;
                if (payload.retryAt <= lastShownRetryAtRef.current) return;
                lastShownRetryAtRef.current = payload.retryAt;
                setNotice(payload);
            }),
        []
    );

    if (notice === null) return null;

    return (
        <AnalysisRateLimitSignupModal
            retryAtLabel={formatRetryAt(notice.retryAt, locale)}
            onClose={() => setNotice(null)}
        />
    );
}
