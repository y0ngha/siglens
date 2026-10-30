'use client';

/** 공유할 분석을 준비하는 동안 띄우는 모달 — 대기 단계와 실패(재시도) 단계. */

import { useTranslations } from 'next-intl';
import type { UseShareFlowResult } from '@/features/share/hooks/useShareFlow';
import { ModalShell } from '@/shared/ui/ModalShell';
import { Spinner } from '@/shared/ui/Spinner';
import { SHARE_MODAL_PANEL } from '../utils/modalStyles';
import { ShareModalActions } from './modal/ShareModalActions';
import { ShareModalHeader } from './modal/ShareModalHeader';
import { SharePreparingStatus } from './modal/SharePreparingStatus';

const TITLE_ID = 'share-preparing-modal-title';

interface SharePreparingModalProps {
    phase: UseShareFlowResult['preparingPhase'];
    onClose: () => void;
    onRetry: () => void;
}

/**
 * 분석 준비 모달. 마운트 = 열림이고, 단계는 부모가 정한다.
 *
 * 대기 단계에서는 패널에 `aria-busy`를 건다. 실패로 넘어갈 때 포커스는 머리줄 닫기
 * 버튼에 그대로 머물러 있어서, 실패 문구가 live region 안에 있어야 스크린리더가 읽는다.
 * 그래서 live region은 두 단계에 걸쳐 같은 요소로 남기고 안의 문구만 바꾼다 —
 * 단계마다 새로 마운트되면 내용과 함께 삽입된 영역이라 읽히지 않는다.
 */
export function SharePreparingModal({
    phase,
    onClose,
    onRetry,
}: SharePreparingModalProps) {
    const t = useTranslations('widgets.share');
    const isPending = phase === 'pending';
    const title = isPending
        ? t('SharePreparingModal.797416')
        : t('SharePreparingModal.15b661');

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onClose}
            busy={isPending}
            className={SHARE_MODAL_PANEL}
        >
            <ShareModalHeader
                titleId={TITLE_ID}
                title={title}
                closeLabel={t('SharePreparingModal.94b7db')}
                onClose={onClose}
            />

            <div className="flex flex-col items-center gap-4 px-5 py-6">
                {isPending && <Spinner size="xl" />}
                <div
                    aria-live="polite"
                    className="flex flex-col items-center gap-1 text-center"
                >
                    <SharePreparingStatus phase={phase} />
                </div>
                {!isPending && (
                    <ShareModalActions
                        primary={{
                            label: t('SharePreparingModal.0c767c'),
                            onClick: onRetry,
                        }}
                        secondary={{
                            label: t('SharePreparingModal.94b7db'),
                            onClick: onClose,
                        }}
                    />
                )}
            </div>
        </ModalShell>
    );
}
