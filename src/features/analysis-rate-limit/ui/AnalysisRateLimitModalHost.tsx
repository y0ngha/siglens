'use client';

import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { formatRetryAt } from '@/shared/lib/formatRetryAt';
import { useAnalysisRateLimitNotice } from '../hooks/useAnalysisRateLimitNotice';
import { AnalysisRateLimitSignupModal } from './AnalysisRateLimitSignupModal';

/**
 * 비회원 생성 한도 모달의 단일 호스트. 루트 레이아웃에 한 번만 마운트한다.
 *
 * 분석 스트림(`runAnalysisStream`)이 `rate_limited`를 받으면 발행하고, 여기서
 * 구독해 연다. 어떤 알림이 모달을 여는지(비회원 한도 소진만, 같은 한도 창은 한 번)는
 * `useAnalysisRateLimitNotice`가 정한다. 이 컴포넌트는 재시도 시각을 사용자
 * 로케일로 포맷해 모달에 넘기기만 한다.
 */
export function AnalysisRateLimitModalHost() {
    const locale = useCurrentLocale();
    const { notice, dismiss } = useAnalysisRateLimitNotice();

    if (notice === null) return null;

    return (
        <AnalysisRateLimitSignupModal
            retryAtLabel={formatRetryAt(notice.retryAt, locale)}
            onClose={dismiss}
        />
    );
}
