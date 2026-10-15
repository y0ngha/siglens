'use client';

import { useTranslations } from 'next-intl';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { useApiDefaultModelForm } from '../hooks/useApiDefaultModelForm';
import type { ApiModelOptionGroup } from '../lib/buildApiModelOptions';
import { SubmitButton } from './SubmitButton';

interface DefaultModelFormProps {
    /** 저장된 `users.api_default_model`. 없으면 `null`. */
    defaultModel: string | null;
    /** 선택지. 비어 있으면(키 없음) 선택기 대신 BYOK 섹션 안내를 보여 준다. */
    groups: readonly ApiModelOptionGroup[];
    /** 저장된 기본 모델의 표시 이름(선택지에 없을 때 안내 문구에 쓴다). */
    defaultModelLabel: string | null;
    /** AI 모델 API 키(BYOK) 섹션으로 가는 앵커. */
    byokHref: string;
    /** 키를 등록하면 모델을 고를 수 있는 회사 이름 목록(`listApiKeyProviderLabels`). */
    keyProviderLabels: string;
}

const STATUS_ID = 'siglens-api-default-model-status';

/**
 * "API 기본 모델" 선택. 선택지는 등록한 BYOK provider의 모델뿐이고(서버 액션이 같은 기준으로 다시
 * 검증한다), 빈 값을 저장하면 설정이 해제된다. 등록한 키가 없으면 선택기 자리에 BYOK 섹션 안내가 나온다.
 */
export function DefaultModelForm({
    defaultModel,
    groups,
    defaultModelLabel,
    byokHref,
    keyProviderLabels,
}: DefaultModelFormProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const { state, formAction } = useApiDefaultModelForm();
    const selectable = groups.flatMap(group =>
        group.options.map(option => option.id)
    );
    const savedIsSelectable =
        defaultModel !== null && selectable.includes(defaultModel);
    const savedIsStale = defaultModel !== null && !savedIsSelectable;

    return (
        <div
            className="space-y-3 border-t border-secondary-700 pt-4"
            data-testid="siglens-api-default-model"
        >
            <div>
                <h3 className="text-sm font-semibold text-secondary-100">
                    {t('DefaultModelForm.title')}
                </h3>
                <p className="mt-1 text-sm text-secondary-400">
                    {t('DefaultModelForm.description')}
                </p>
            </div>

            {groups.length === 0 ? (
                <p className="text-sm text-secondary-300">
                    {t('DefaultModelForm.noKeys', { v0: keyProviderLabels })}{' '}
                    {/* 같은 페이지 안의 앵커라 next/link가 아니라 일반 앵커다. */}
                    <a
                        href={byokHref}
                        className="text-primary-300 underline underline-offset-2 hover:text-primary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('DefaultModelForm.goToByok')}
                    </a>
                </p>
            ) : (
                <form
                    action={formAction}
                    className="flex flex-col gap-2 sm:flex-row sm:items-end"
                    noValidate
                >
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-secondary-300">
                        {t('DefaultModelForm.selectLabel')}
                        <select
                            // 저장된 값이 바뀌면(저장 후 재렌더) 비제어 select를 새 값으로 다시 맞춘다.
                            key={savedIsSelectable ? defaultModel : ''}
                            name="model"
                            defaultValue={savedIsSelectable ? defaultModel : ''}
                            aria-describedby={STATUS_ID}
                            className="h-10 w-full rounded-lg border border-border-control bg-secondary-950 px-3 text-sm text-secondary-50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 focus:outline-none"
                        >
                            <option value="">
                                {t('DefaultModelForm.notSetOption')}
                            </option>
                            {groups.map(group => (
                                <optgroup
                                    key={group.provider}
                                    label={group.providerLabel}
                                >
                                    {group.options.map(option => (
                                        <option
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </label>
                    <SubmitButton
                        label={t('DefaultModelForm.saveButton')}
                        pendingLabel={t('DefaultModelForm.saving')}
                        className={cn(
                            BUTTON_PRIMARY,
                            'h-10 shrink-0 px-4 text-sm'
                        )}
                    />
                </form>
            )}

            {groups.length > 0 && (
                <p className="text-xs text-secondary-500">
                    {t('DefaultModelForm.hint')}
                </p>
            )}

            <div
                id={STATUS_ID}
                role="status"
                aria-live="polite"
                className="min-h-5 text-sm"
            >
                {state.status === 'saved' && (
                    <span className="text-ui-success-text">
                        {state.model === null
                            ? t('DefaultModelForm.cleared')
                            : t('DefaultModelForm.saved')}
                    </span>
                )}
                {state.status === 'error' && (
                    <span className="text-ui-danger-text">{state.message}</span>
                )}
                {savedIsStale && state.status !== 'saved' && (
                    <span className="text-ui-warning-text">
                        {t('DefaultModelForm.unavailable', {
                            v0: defaultModelLabel ?? defaultModel,
                        })}
                    </span>
                )}
            </div>
        </div>
    );
}
