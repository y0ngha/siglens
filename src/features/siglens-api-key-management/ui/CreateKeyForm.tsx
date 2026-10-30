'use client';

import type { Ref } from 'react';
import { useTranslations } from 'next-intl';
import type { CreateSiglensApiKeyState } from '@/entities/siglens-api-key/model';
import { API_KEY_NAME_MAX_LENGTH } from '@/shared/config/publicApi';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { useByokConfirmGate } from '../hooks/useByokConfirmGate';
import {
    listCreateStatusNotices,
    type CreateStatusNotice,
} from '../lib/createStatusNotices';
import { ByokRequiredModal } from './ByokRequiredModal';
import { SubmitButton } from './SubmitButton';

interface CreateKeyFormProps {
    createState: CreateSiglensApiKeyState;
    createFormAction: (formData: FormData) => void;
    /** 인증 전에는 입력과 버튼을 막고 인증 안내를 보여 준다. */
    emailVerified: boolean;
    /** 활성 키가 상한에 닿았다. 버튼을 막고 상한 안내를 보여 준다. */
    limitReached: boolean;
    /** 상한 안내 문구에 넣는 활성 키 상한. */
    maxKeys: number;
    /** 등록한 BYOK LLM 키가 하나라도 있는가. 없으면 발급 전에 확인 모달을 연다. */
    hasByokKey: boolean;
    /** 이동할 BYOK 섹션의 DOM id(`#` 없이). */
    byokSectionId: string;
    /** 이름 입력칸. 새 키 원문을 치운 뒤 부모가 이리로 포커스를 돌린다. */
    nameInputRef?: Ref<HTMLInputElement>;
}

const STATUS_ID = 'siglens-api-key-create-status';

const NOTICE_TONE: Record<CreateStatusNotice, string> = {
    error: 'text-ui-danger-text',
    emailNotVerified: 'text-ui-warning-text',
    byokNotice: 'text-ui-warning-text',
    limitHint: 'text-secondary-400',
};

/** 이름 입력 + 발급 버튼 + 상태 영역(오류·이메일 인증 안내·BYOK 안내·상한 안내). */
export function CreateKeyForm({
    createState,
    createFormAction,
    emailVerified,
    limitReached,
    maxKeys,
    hasByokKey,
    byokSectionId,
    nameInputRef,
}: CreateKeyFormProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const {
        formRef,
        submitRef,
        modalOpen,
        handleSubmit,
        closeModal,
        createAnyway,
        goToByok,
    } = useByokConfirmGate({ hasByokKey, byokSectionId });

    const createBlocked = !emailVerified || limitReached;
    const errorMessage =
        createState.status === 'error' ? createState.message : null;
    const nameInvalid =
        createState.status === 'error' && createState.code === 'invalid_name';
    const notices = listCreateStatusNotices({
        hasError: errorMessage !== null,
        emailVerified,
        limitReached,
        hasByokKey,
    });
    const noticeText: Record<CreateStatusNotice, string> = {
        error: errorMessage ?? '',
        emailNotVerified: t('SiglensApiKeySection.emailNotVerified'),
        byokNotice: t('SiglensApiKeySection.byokNotice'),
        limitHint: t('SiglensApiKeySection.limitHint', { v0: maxKeys }),
    };

    return (
        <>
            <form
                ref={formRef}
                action={createFormAction}
                onSubmit={handleSubmit}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
                noValidate
            >
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-secondary-300">
                    {t('SiglensApiKeySection.nameLabel')}
                    <input
                        ref={nameInputRef}
                        type="text"
                        name="name"
                        required
                        disabled={!emailVerified}
                        maxLength={API_KEY_NAME_MAX_LENGTH}
                        autoComplete="off"
                        placeholder={t('SiglensApiKeySection.namePlaceholder')}
                        aria-invalid={nameInvalid || undefined}
                        aria-describedby={STATUS_ID}
                        className="h-10 w-full rounded-lg border border-border-control bg-secondary-950 px-3 text-sm text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 focus:outline-none"
                    />
                </label>
                <SubmitButton
                    buttonRef={submitRef}
                    label={t('SiglensApiKeySection.createButton')}
                    pendingLabel={t('SiglensApiKeySection.creating')}
                    disabled={createBlocked}
                    className={cn(BUTTON_PRIMARY, 'h-10 shrink-0 px-4 text-sm')}
                />
            </form>
            {modalOpen && (
                <ByokRequiredModal
                    onClose={closeModal}
                    onGoToByok={goToByok}
                    onCreateAnyway={createAnyway}
                />
            )}
            <div
                id={STATUS_ID}
                role="status"
                aria-live="polite"
                className="min-h-5 text-sm"
            >
                {notices.map(notice => (
                    <span key={notice} className={NOTICE_TONE[notice]}>
                        {noticeText[notice]}
                    </span>
                ))}
            </div>
        </>
    );
}
