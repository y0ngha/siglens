'use client';

import { useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { LlmProvider } from '@/domain/llm';
import { useApiKeyForms } from '@/components/account/hooks/useApiKeyForms';
import { LLM_PROVIDER_LABELS } from '@/lib/llmProviderLabels';

const PROVIDER_PLACEHOLDERS: Record<LlmProvider, string> = {
    anthropic: 'sk-ant-...',
    google: 'AIza...',
    openai: 'sk-...',
};

const PROVIDERS: LlmProvider[] = ['anthropic', 'google', 'openai'];

interface SubmitButtonProps {
    label: string;
    pendingLabel: string;
    className: string;
}

function SubmitButton({ label, pendingLabel, className }: SubmitButtonProps) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
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
    // editMode: true only when an already-registered provider's "재등록" is active
    // Unregistered providers always show the input (showSaveInput = !isRegistered || editMode)
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
        <div className="ring-secondary-800 bg-secondary-900/60 rounded-xl p-4 ring-1">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-secondary-100 text-sm font-semibold">
                        {LLM_PROVIDER_LABELS[provider]}
                    </span>
                    {isRegistered ? (
                        <span className="bg-ui-success/10 text-ui-success ring-ui-success/30 rounded-full px-2 py-0.5 text-xs ring-1">
                            등록됨
                        </span>
                    ) : (
                        <span className="bg-secondary-800 text-secondary-400 rounded-full px-2 py-0.5 text-xs">
                            미등록
                        </span>
                    )}
                </div>
                {isRegistered && !showSaveInput && (
                    <button
                        type="button"
                        onClick={() => setEditMode(true)}
                        className="border-secondary-700 text-secondary-300 hover:bg-secondary-800 focus-visible:ring-primary-500 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        재등록
                    </button>
                )}
            </div>

            {showSaveInput && (
                <form
                    action={handleSave}
                    className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
                    noValidate
                >
                    <input type="hidden" name="provider" value={provider} />
                    <input
                        type="password"
                        name="apiKey"
                        required
                        placeholder={PROVIDER_PLACEHOLDERS[provider]}
                        aria-label={`${LLM_PROVIDER_LABELS[provider]} API 키`}
                        aria-describedby={saveStatusId}
                        className="border-secondary-700 bg-secondary-950 text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-primary-500/40 h-10 min-w-0 flex-1 rounded-md border px-3 font-mono text-sm focus:ring-2 focus:outline-none"
                    />
                    <SubmitButton
                        label="저장"
                        pendingLabel="저장 중…"
                        className="border-secondary-700 text-secondary-200 hover:bg-secondary-800 focus-visible:ring-primary-500 inline-flex h-10 shrink-0 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                    />
                    {isRegistered && (
                        <button
                            type="button"
                            onClick={() => setEditMode(false)}
                            className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 inline-flex h-10 shrink-0 items-center justify-center px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                            취소
                        </button>
                    )}
                </form>
            )}

            <div
                id={saveStatusId}
                role="status"
                aria-live="polite"
                className="mt-1.5 min-h-[1.25rem] text-sm"
            >
                {saveState.status === 'success' && (
                    <span className="text-ui-success">{saveState.message}</span>
                )}
                {saveState.status === 'error' && (
                    <span className="text-ui-danger">{saveState.message}</span>
                )}
            </div>

            {isRegistered && (
                <>
                    <form action={deleteFormAction} className="mt-2" noValidate>
                        <input type="hidden" name="provider" value={provider} />
                        <SubmitButton
                            label="삭제"
                            pendingLabel="삭제 중…"
                            className="text-ui-danger border-ui-danger/40 hover:bg-ui-danger/10 focus-visible:ring-ui-danger inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                        />
                    </form>
                    <div
                        id={deleteStatusId}
                        role="status"
                        aria-live="polite"
                        className="mt-1 min-h-[1.25rem] text-sm"
                    >
                        {deleteState.status === 'success' && (
                            <span className="text-ui-success">
                                {deleteState.message}
                            </span>
                        )}
                        {deleteState.status === 'error' && (
                            <span className="text-ui-danger">
                                {deleteState.message}
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

interface ApiKeySectionProps {
    registeredProviders: LlmProvider[];
}

export function ApiKeySection({ registeredProviders }: ApiKeySectionProps) {
    const registeredSet = useMemo(
        () => new Set(registeredProviders),
        [registeredProviders]
    );

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-secondary-100 text-lg font-semibold">
                    AI 모델 API 키
                </h2>
                <p className="text-secondary-400 mt-1 text-sm">
                    등록한 키는 계정에만 저장되며 AES-256으로 암호화됩니다.
                </p>
            </div>
            {PROVIDERS.map(provider => (
                <ProviderCard
                    key={`${provider}-${String(registeredSet.has(provider))}`}
                    provider={provider}
                    isRegistered={registeredSet.has(provider)}
                />
            ))}
        </div>
    );
}
