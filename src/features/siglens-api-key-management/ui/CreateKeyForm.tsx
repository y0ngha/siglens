'use client';

import { useTranslations } from 'next-intl';
import type { CreateSiglensApiKeyState } from '@/entities/siglens-api-key/model';
import { API_KEY_NAME_MAX_LENGTH } from '@/shared/config/publicApi';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SubmitButton } from './SubmitButton';

interface CreateKeyFormProps {
    createState: CreateSiglensApiKeyState;
    createFormAction: (formData: FormData) => void;
    emailVerified: boolean;
    limitReached: boolean;
    maxKeys: number;
}

/** 이름 입력 + 발급 버튼 + 상태 영역(오류·이메일 인증 안내·상한 안내). */
export function CreateKeyForm({
    createState,
    createFormAction,
    emailVerified,
    limitReached,
    maxKeys,
}: CreateKeyFormProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const createBlocked = !emailVerified || limitReached;
    return (
        <>
            <form
                action={createFormAction}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
                noValidate
            >
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-secondary-300">
                    {t('SiglensApiKeySection.nameLabel')}
                    <input
                        type="text"
                        name="name"
                        required
                        disabled={!emailVerified}
                        maxLength={API_KEY_NAME_MAX_LENGTH}
                        autoComplete="off"
                        placeholder={t('SiglensApiKeySection.namePlaceholder')}
                        aria-describedby="siglens-api-key-create-status"
                        className="h-10 w-full rounded-lg border border-border-control bg-secondary-950 px-3 text-sm text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 focus:outline-none"
                    />
                </label>
                <SubmitButton
                    label={t('SiglensApiKeySection.createButton')}
                    pendingLabel={t('SiglensApiKeySection.creating')}
                    disabled={createBlocked}
                    className={cn(BUTTON_PRIMARY, 'h-10 shrink-0 px-4 text-sm')}
                />
            </form>
            <div
                id="siglens-api-key-create-status"
                role="status"
                aria-live="polite"
                className="min-h-5 text-sm"
            >
                {createState.status === 'error' && (
                    <span className="text-ui-danger-text">
                        {createState.message}
                    </span>
                )}
                {!emailVerified && (
                    <span className="text-ui-warning-text">
                        {t('SiglensApiKeySection.emailNotVerified')}
                    </span>
                )}
                {emailVerified &&
                    limitReached &&
                    createState.status !== 'error' && (
                        <span className="text-secondary-400">
                            {t('SiglensApiKeySection.limitHint', {
                                v0: maxKeys,
                            })}
                        </span>
                    )}
            </div>
        </>
    );
}
