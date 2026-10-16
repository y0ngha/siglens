'use client';

import { useTranslations } from 'next-intl';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { ModalShell } from '@/shared/ui/ModalShell';
import { CloseIcon } from '@/shared/ui/StrokeIcons';

interface ByokRequiredModalProps {
    /** 닫기 — Escape·배경 클릭·닫기 버튼 모두 키를 만들지 않고 취소한다. */
    onClose: () => void;
    /** "AI 모델 키 등록하러 가기" — 모달을 닫고 BYOK 섹션으로 보낸다. */
    onGoToByok: () => void;
    /** "데이터 도구만 쓸게요" — BYOK 키 없이 그대로 발급한다. */
    onCreateAnyway: () => void;
}

const TITLE_ID = 'siglens-api-byok-required-title';
const BODY_ID = 'siglens-api-byok-required-body';
const ACTION_SIZE = 'min-h-11 px-4 py-2 text-sm';

/**
 * BYOK 키 없이 시그렌즈 API 키를 만들려 할 때 먼저 묻는 안내 모달. 공개 API의 AI 분석은
 * 호출자 자신의 LLM 키로만 만들어지므로, 키가 없는 채로 발급하면 데이터 도구만 쓸 수 있다는
 * 사실을 발급 전에 알려 준다. 안내만 담은 모달이라 패널에 먼저 포커스를 둔다.
 */
export function ByokRequiredModal({
    onClose,
    onGoToByok,
    onCreateAnyway,
}: ByokRequiredModalProps) {
    const t = useTranslations('features.siglens-api-key-management');
    return (
        <ModalShell
            titleId={TITLE_ID}
            descriptionId={BODY_ID}
            onClose={onClose}
            focusPanel
            className="relative max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
        >
            <button
                type="button"
                onClick={onClose}
                aria-label={t('ByokRequiredModal.close')}
                className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-lg text-secondary-400 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <CloseIcon className="size-5" />
            </button>
            <div className="mb-5 space-y-3 pr-8">
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {t('ByokRequiredModal.title')}
                </h2>
                <p
                    id={BODY_ID}
                    className="text-sm leading-relaxed text-secondary-300"
                >
                    {t('ByokRequiredModal.body')}
                </p>
            </div>
            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={onGoToByok}
                    className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                >
                    {t('ByokRequiredModal.goToByok')}
                </button>
                <button
                    type="button"
                    onClick={onCreateAnyway}
                    className={cn(BUTTON_GHOST, ACTION_SIZE)}
                >
                    {t('ByokRequiredModal.createAnyway')}
                </button>
            </div>
        </ModalShell>
    );
}
