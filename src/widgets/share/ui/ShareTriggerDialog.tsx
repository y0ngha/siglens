'use client';

/** 공유할 분석이 아직 없을 때 분석부터 돌릴지 묻는 확인 모달. */

import { useTranslations } from 'next-intl';
import { ModalShell } from '@/shared/ui/ModalShell';
import { SHARE_MODAL_PANEL } from '../utils/modalStyles';
import { ShareModalActions } from './modal/ShareModalActions';
import { ShareModalHeader } from './modal/ShareModalHeader';

const TITLE_ID = 'share-trigger-dialog-title';

interface ShareTriggerDialogProps {
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * 분석을 먼저 돌린 뒤 끝나면 공유 화면으로 이어진다고 알리는 확인 모달. 마운트 = 열림이다.
 *
 * `ModalShell`이 포커스 트랩(첫 조작 요소 포커스·Tab 순환·트리거 복원)과 Esc·배경 클릭
 * 닫기를 맡는다. 첫 조작 요소는 머리줄 닫기 버튼이라, 열린 직후 Enter는 확인이 아니라
 * 닫기다 — 분석을 실수로 시작하지 않게 한다.
 */
export function ShareTriggerDialog({
    onConfirm,
    onCancel,
}: ShareTriggerDialogProps) {
    const t = useTranslations('widgets.share');

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onCancel}
            className={SHARE_MODAL_PANEL}
        >
            <ShareModalHeader
                titleId={TITLE_ID}
                title={t('ShareTriggerDialog.5481d6')}
                closeLabel={t('ShareTriggerDialog.94b7db')}
                onClose={onCancel}
            />

            <div className="flex flex-col gap-4 px-5 py-4">
                <p className="text-sm leading-relaxed text-secondary-400">
                    {t('ShareTriggerDialog.b74ea2')}
                </p>
                <ShareModalActions
                    primary={{
                        label: t('ShareTriggerDialog.cc6aae'),
                        onClick: onConfirm,
                    }}
                    secondary={{
                        label: t('ShareTriggerDialog.2d4e13'),
                        onClick: onCancel,
                    }}
                />
            </div>
        </ModalShell>
    );
}
