'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import type { LlmProvider } from '@/shared/config/llmProviders';
import { cn } from '@/shared/lib/cn';
import {
    BUTTON_GHOST,
    BUTTON_OUTLINE,
    BUTTON_OUTLINE_DANGER,
} from '@/shared/lib/buttonStyles';
import { LLM_PROVIDER_LABELS } from '@/shared/lib/llmProviderLabels';

import { useApiKeyForms } from '../hooks/useApiKeyForms';
import { useProviderCardFocus } from '../hooks/useProviderCardFocus';
import { ApiKeyInput } from './ApiKeyInput';
import { ApiKeyStatusMessage } from './ApiKeyStatusMessage';
import { PendingLabelSubmit } from './PendingLabelSubmit';

const PROVIDER_PLACEHOLDERS: Record<LlmProvider, string> = {
    anthropic: 'sk-ant-...',
    google: 'AIza...',
    openai: 'sk-...',
    deepseek: 'sk-...',
};

/** `disabled:` 대신 `aria-disabled:`로 잠그는 제출 버튼의 전송 중 모양(`PendingLabelSubmit`). */
const PENDING_OUTLINE =
    'aria-disabled:cursor-not-allowed aria-disabled:text-secondary-500';
const PENDING_OUTLINE_DANGER = cn(
    PENDING_OUTLINE,
    'aria-disabled:border-border-control'
);

interface ProviderCardProps {
    provider: LlmProvider;
    isRegistered: boolean;
    /** 이 카드의 저장·삭제로 다시 마운트된 카드다. 포커스를 이어받는다. */
    restoreFocus: boolean;
    /** 포커스를 이어받은 뒤 부른다. 부모가 `restoreFocus` 요청을 지운다. */
    onFocusRestored: () => void;
    /**
     * 이 카드의 저장·삭제가 성공해 등록 여부가 `isRegistered`로 바뀌었다. 카드는
     * 새 등록 여부를 키로 다시 마운트된다. 재등록처럼 등록 여부가 그대로인 성공은
     * 재마운트가 없으므로 부르지 않는다.
     */
    onRegistrationChange: (
        provider: LlmProvider,
        isRegistered: boolean
    ) => void;
}

/**
 * 프로바이더 하나의 BYOK 키 카드. 미등록이면 입력 폼을, 등록됨이면 '재등록'·'삭제'를
 * 보인다. 등록 여부가 바뀌면 부모가 `key`로 다시 마운트하므로 편집 상태는 그때
 * 저절로 초기화된다.
 */
export function ProviderCard({
    provider,
    isRegistered,
    restoreFocus,
    onFocusRestored,
    onRegistrationChange,
}: ProviderCardProps) {
    // 등록된 프로바이더에서 '재등록'을 누른 동안만 true.
    const [editMode, setEditMode] = useState(false);
    // 키는 분리 전 `ApiKeySection.*` 네임스페이스를 일부러 그대로 쓴다 — 옮기면 카탈로그만 의미 없이 갈아엎힌다.
    const t = useTranslations('features.api-key-management');
    const {
        saveState,
        saveFormAction,
        isSavePending,
        deleteState,
        deleteFormAction,
        isDeletePending,
    } = useApiKeyForms({
        onSuccess: kind => {
            const registeredAfter = kind === 'save';
            if (registeredAfter !== isRegistered) {
                onRegistrationChange(provider, registeredAfter);
            }
        },
    });
    const showSaveInput = !isRegistered || editMode;
    // REACT.md#HK-1 예외: 파생값 `showSaveInput`을 입력으로 받는다.
    const { inputRef, reRegisterRef } = useProviderCardFocus({
        showSaveInput,
        restoreFocus,
        onFocusRestored,
    });

    // 결과 영역은 전송 중부터 띄운다. 재등록은 제출하자마자 폼을 닫으므로 입력
    // 폼에 묶어 두면 그 결과(특히 실패)가 어디에도 보이지 않는다.
    const showSaveStatus =
        showSaveInput || isSavePending || saveState.status !== 'idle';
    const showDeleteStatus =
        isRegistered && (isDeletePending || deleteState.status !== 'idle');
    const saveStatusId = `api-key-save-status-${provider}`;
    const deleteStatusId = `api-key-delete-status-${provider}`;

    // 재등록은 제출 즉시 폼을 닫는다. 실패하면 아래 결과 영역에 오류가 남고,
    // '재등록'을 다시 눌러 재시도한다.
    const handleSave = (formData: FormData): void => {
        if (isRegistered) setEditMode(false);
        saveFormAction(formData);
    };

    return (
        // E2E는 카드를 이 testid로 집는다. 스타일 클래스(반경 등)는 테스트가
        // 기대도 되는 계약이 아니라서 전용 앵커를 둔다.
        <div
            data-testid={`api-key-card-${provider}`}
            className="rounded-lg bg-secondary-900/60 p-4 ring-1 ring-secondary-700"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-secondary-100">
                        {LLM_PROVIDER_LABELS[provider]}
                    </span>
                    {isRegistered ? (
                        <span className="rounded-full bg-ui-success/10 px-2 py-0.5 text-xs text-ui-success-text ring-1 ring-ui-success/30">
                            {t('ApiKeySection.e848ed')}
                        </span>
                    ) : (
                        <span className="rounded-full bg-secondary-800 px-2 py-0.5 text-xs text-secondary-400">
                            {t('ApiKeySection.363c34')}
                        </span>
                    )}
                </div>
                {isRegistered && !showSaveInput && (
                    <div className="flex items-center gap-2">
                        <button
                            ref={reRegisterRef}
                            type="button"
                            onClick={() => setEditMode(true)}
                            className={cn(
                                BUTTON_OUTLINE,
                                'px-3 py-1.5 text-xs'
                            )}
                        >
                            {t('ApiKeySection.fc669b')}
                        </button>
                        <form action={deleteFormAction} noValidate>
                            <input
                                type="hidden"
                                name="provider"
                                value={provider}
                            />
                            <PendingLabelSubmit
                                label={t('ApiKeySection.fc81e2')}
                                pendingLabel={t('ApiKeySection.283e16')}
                                aria-describedby={
                                    showDeleteStatus
                                        ? deleteStatusId
                                        : undefined
                                }
                                className={cn(
                                    BUTTON_OUTLINE_DANGER,
                                    PENDING_OUTLINE_DANGER,
                                    'h-7 px-3 text-xs'
                                )}
                            />
                        </form>
                    </div>
                )}
            </div>

            {showSaveInput && (
                <form
                    action={handleSave}
                    className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
                    noValidate
                >
                    <input type="hidden" name="provider" value={provider} />
                    <ApiKeyInput
                        ref={inputRef}
                        name="apiKey"
                        placeholder={PROVIDER_PLACEHOLDERS[provider]}
                        aria-label={t('ApiKeySection.apiKeyLabel', {
                            v0: LLM_PROVIDER_LABELS[provider],
                        })}
                        aria-describedby={saveStatusId}
                    />
                    <PendingLabelSubmit
                        label={t('ApiKeySection.1f1712')}
                        pendingLabel={t('ApiKeySection.9f6785')}
                        className={cn(
                            BUTTON_OUTLINE,
                            PENDING_OUTLINE,
                            'h-10 shrink-0 px-4 text-sm'
                        )}
                    />
                    {isRegistered && (
                        <button
                            type="button"
                            onClick={() => setEditMode(false)}
                            className={cn(
                                BUTTON_GHOST,
                                'h-10 shrink-0 px-2 text-sm'
                            )}
                        >
                            {t('ApiKeySection.19b2d1')}
                        </button>
                    )}
                </form>
            )}

            {showSaveStatus && (
                <ApiKeyStatusMessage
                    id={saveStatusId}
                    state={saveState}
                    className="mt-1.5"
                />
            )}

            {showDeleteStatus && (
                <ApiKeyStatusMessage
                    id={deleteStatusId}
                    state={deleteState}
                    className="mt-1"
                />
            )}
        </div>
    );
}
