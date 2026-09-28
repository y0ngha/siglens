'use client';

import { useTranslations } from 'next-intl';
import { ApiKeyInput } from './ApiKeyInput';
import { useApiKeyForms } from '../hooks/useApiKeyForms';
import type { ApiKeyActionState } from '@/shared/lib/types';
import {
    LLM_PROVIDER_VALUES,
    type LlmProvider,
} from '@/shared/config/llmProviders';
import { cn } from '@/shared/lib/cn';
import {
    BUTTON_GHOST,
    BUTTON_OUTLINE,
    BUTTON_OUTLINE_DANGER,
} from '@/shared/lib/buttonStyles';
import { LLM_PROVIDER_LABELS } from '@/shared/lib/llmProviderLabels';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';

const PROVIDER_PLACEHOLDERS: Record<LlmProvider, string> = {
    anthropic: 'sk-ant-...',
    google: 'AIza...',
    openai: 'sk-...',
    deepseek: 'sk-...',
};

interface StatusMessageProps {
    id: string;
    state: ApiKeyActionState;
    className?: string;
}

function StatusMessage({ id, state, className }: StatusMessageProps) {
    return (
        <div
            id={id}
            role="status"
            aria-live="polite"
            className={cn('min-h-5 text-sm', className)}
        >
            {state.status === 'success' && (
                <span className="text-ui-success-text">{state.message}</span>
            )}
            {state.status === 'error' && (
                <span className="text-ui-danger-text">{state.message}</span>
            )}
        </div>
    );
}

interface PendingLabelSubmitProps {
    label: string;
    pendingLabel: string;
    className: string;
    'aria-describedby'?: string;
}

/**
 * 카드 안의 작은 아웃라인 제출 버튼. 공용 `SubmitButton`은 전폭 채움 + 흰 스피너라
 * 이 자리(인라인 아웃라인, 문구만 바뀜)에 맞지 않아 톤 상수만 공유한다.
 */
function PendingLabelSubmit({
    label,
    pendingLabel,
    className,
    'aria-describedby': ariaDescribedby,
}: PendingLabelSubmitProps) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            aria-describedby={ariaDescribedby}
            className={className}
        >
            {pending ? pendingLabel : label}
        </button>
    );
}

interface ProviderCardProps {
    provider: LlmProvider;
    isRegistered: boolean;
}

function ProviderCard({ provider, isRegistered }: ProviderCardProps) {
    const t = useTranslations('features.api-key-management');
    // editMode: true only when an already-registered provider's "재등록" is active
    const [editMode, setEditMode] = useState(false);
    const { saveState, saveFormAction, deleteState, deleteFormAction } =
        useApiKeyForms();

    // when isRegistered changes (e.g. deletion → false), the parent key
    // remounts this component, so editMode resets to false and the form opens via !isRegistered.

    // for re-registration, close the form optimistically on submit.
    // On failure, the error appears in the status region below; user can click 재등록 to retry.
    const handleSave = (formData: FormData): void => {
        if (isRegistered) setEditMode(false);
        saveFormAction(formData);
    };

    const showSaveInput = !isRegistered || editMode;

    const saveStatusId = `api-key-save-status-${provider}`;
    const deleteStatusId = `api-key-delete-status-${provider}`;

    return (
        // E2E가 카드를 반경 클래스(`div.rounded-xl`)로 집고 있었다. 반경 어휘를
        // 세 단계로 통일하면서 그 셀렉터가 조용히 아무것도 못 찾게 됐다 —
        // 스타일 클래스는 테스트가 기대도 되는 계약이 아니다. 안정된 앵커를 준다.
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
                                aria-describedby={deleteStatusId}
                                className={cn(
                                    BUTTON_OUTLINE_DANGER,
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

            {showSaveInput && (
                <StatusMessage
                    id={saveStatusId}
                    state={saveState}
                    className="mt-1.5"
                />
            )}

            {isRegistered && deleteState.status !== 'idle' && (
                <StatusMessage
                    id={deleteStatusId}
                    state={deleteState}
                    className="mt-1"
                />
            )}
        </div>
    );
}

interface ApiKeySectionProps {
    registeredProviders: LlmProvider[];
}

export function ApiKeySection({ registeredProviders }: ApiKeySectionProps) {
    const t = useTranslations('features.api-key-management');
    const registeredSet = new Set(registeredProviders);

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-secondary-100">
                    {t('ApiKeySection.64f90b')}
                </h2>
                <p className="mt-1 text-sm text-secondary-400">
                    {t('ApiKeySection.017638')}
                </p>
            </div>
            {LLM_PROVIDER_VALUES.map(provider => (
                <ProviderCard
                    key={`${provider}-${String(registeredSet.has(provider))}`}
                    provider={provider}
                    isRegistered={registeredSet.has(provider)}
                />
            ))}
        </div>
    );
}
