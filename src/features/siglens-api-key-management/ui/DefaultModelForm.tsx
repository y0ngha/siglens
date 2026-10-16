'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ModelId } from '@y0ngha/siglens-core';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
import { ModelListbox } from '@/shared/ui/ModelListbox';
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
const LABEL_ID = 'siglens-api-default-model-label';
const VALUE_ID = 'siglens-api-default-model-value';

interface ModelFieldProps {
    initial: string | null;
    groups: readonly ApiModelOptionGroup[];
}

/**
 * 모델 선택 listbox + 서버 액션이 읽는 `model` 필드. 선택 상태는 제어 state이고 폼에는 숨김
 * input으로 실어 보낸다(빈 문자열 = "설정 안 함" → 서버가 해제로 처리한다).
 */
function ModelField({ initial, groups }: ModelFieldProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const { isOpen, toggle, close } = usePopoverToggle([
        triggerRef,
        listboxRef,
    ]);
    const [selected, setSelected] = useState<ModelId | null>(
        () =>
            groups
                .flatMap(group => group.options)
                .find(option => option.id === initial)?.id ?? null
    );

    const closeToTrigger = () => {
        close();
        triggerRef.current?.focus();
    };

    return (
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-secondary-300">
            <span id={LABEL_ID}>{t('DefaultModelForm.selectLabel')}</span>
            <input type="hidden" name="model" value={selected ?? ''} />
            <div className="relative">
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={toggle}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-labelledby={`${LABEL_ID} ${VALUE_ID}`}
                    aria-describedby={STATUS_ID}
                    className="flex h-10 w-full touch-manipulation items-center justify-between gap-2 rounded-lg border border-border-control bg-secondary-950 px-3 text-sm text-secondary-50 transition-colors hover:bg-secondary-900 focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:outline-none"
                >
                    <span id={VALUE_ID} className="truncate">
                        {selected === null
                            ? t('DefaultModelForm.notSetOption')
                            : getModelDisplay(selected).fullName}
                    </span>
                    <span
                        className={cn(
                            'shrink-0 text-xs text-secondary-500 transition-transform duration-150',
                            isOpen && 'rotate-180'
                        )}
                        aria-hidden="true"
                    >
                        ▾
                    </span>
                </button>
                {isOpen && (
                    <ModelListbox
                        ref={listboxRef}
                        groups={groups.map(group => ({
                            label: group.providerLabel,
                            models: group.options.map(option => option.id),
                        }))}
                        selected={selected}
                        onChange={setSelected}
                        none={{
                            label: t('DefaultModelForm.notSetOption'),
                            onSelect: () => setSelected(null),
                        }}
                        onClose={closeToTrigger}
                        ariaLabel={t('DefaultModelForm.selectLabel')}
                        className="top-full left-0 mt-1 w-full min-w-44"
                    />
                )}
            </div>
        </div>
    );
}

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
        defaultModel !== null && selectable.some(id => id === defaultModel);
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
                    {/* 저장된 값이 바뀌면(저장 후 재렌더) 선택 상태를 새 값으로 다시 맞춘다. */}
                    <ModelField
                        key={savedIsSelectable ? defaultModel : ''}
                        initial={savedIsSelectable ? defaultModel : null}
                        groups={groups}
                    />
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
