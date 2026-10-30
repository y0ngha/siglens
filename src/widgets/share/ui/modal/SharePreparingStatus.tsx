/** 공유 준비 모달의 상태 문구 — 단계마다 다른 안내를 그린다. */

import { useTranslations } from 'next-intl';
import type { UseShareFlowResult } from '@/features/share/hooks/useShareFlow';

interface SharePreparingStatusProps {
    phase: UseShareFlowResult['preparingPhase'];
}

/**
 * 대기 단계는 진행 안내와 예상 시간, 실패 단계는 재시도 안내를 그린다.
 * live region은 부모가 갖는다 — 이 컴포넌트는 단계마다 내용만 바꾼다.
 */
export function SharePreparingStatus({ phase }: SharePreparingStatusProps) {
    const t = useTranslations('widgets.share');

    if (phase === 'error') {
        return (
            <p className="text-sm text-secondary-300">
                {t('SharePreparingModal.98580d')}
            </p>
        );
    }

    return (
        <>
            <p className="text-sm text-secondary-200">
                {t('SharePreparingModal.cec483')}
            </p>
            <p className="text-xs text-secondary-500">
                {t('SharePreparingModal.99d27b')}
            </p>
        </>
    );
}
