'use client';

import { useTranslations } from 'next-intl';
import { ApiKeyInput } from './ApiKeyInput';
import { useApiKeyForms } from '../hooks/useApiKeyForms';
import type { ApiKeyActionState } from '@/entities/api-key';
import { LLM_PROVIDER_VALUES, type LlmProvider } from '@/entities/api-key';
import { cn } from '@/shared/lib/cn';
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
                <span className="text-ui-success">{state.message}</span>
            )}
            {state.status === 'error' && (
                <span className="text-ui-danger">{state.message}</span>
            )}
        </div>
    );
}

interface SubmitButtonProps {
    label: string;
    pendingLabel: string;
    className: string;
    'aria-describedby'?: string;
}

function SubmitButton({
    label,
    pendingLabel,
    className,
    'aria-describedby': ariaDescribedby,
}: SubmitButtonProps) {
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
        <div className="rounded-xl bg-secondary-900/60 p-4 ring-1 ring-secondary-800">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-secondary-100">
                        {LLM_PROVIDER_LABELS[provider]}
                    </span>
                    {isRegistered ? (
                        <span className="rounded-full bg-ui-success/10 px-2 py-0.5 text-xs text-ui-success ring-1 ring-ui-success/30">
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
                            className="rounded-md border border-secondary-700 px-3 py-1.5 text-xs font-medium text-secondary-300 transition-colors hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('ApiKeySection.fc669b')}
                        </button>
                        <form action={deleteFormAction} noValidate>
                            <input
                                type="hidden"
                                name="provider"
                                value={provider}
                            />
                            <SubmitButton
                                label={t('ApiKeySection.fc81e2')}
                                pendingLabel={t('ApiKeySection.283e16')}
                                aria-describedby={deleteStatusId}
                                className="inline-flex h-7 items-center justify-center rounded-md border border-ui-danger/40 px-3 text-xs font-medium text-ui-danger transition-colors hover:bg-ui-danger/10 focus-visible:ring-2 focus-visible:ring-ui-danger focus-visible:outline-none disabled:opacity-50"
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
                        aria-label={`${LLM_PROVIDER_LABELS[provider]} API 키`}
                        aria-describedby={saveStatusId}
                    />
                    <SubmitButton
                        label={t('ApiKeySection.1f1712')}
                        pendingLabel={t('ApiKeySection.9f6785')}
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-secondary-700 px-4 text-sm font-medium text-secondary-200 transition-colors hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:opacity-50"
                    />
                    {isRegistered && (
                        <button
                            type="button"
                            onClick={() => setEditMode(false)}
                            className="inline-flex h-10 shrink-0 items-center justify-center px-2 text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
