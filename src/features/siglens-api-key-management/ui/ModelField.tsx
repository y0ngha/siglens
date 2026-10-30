'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ModelId } from '@y0ngha/siglens-core';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
import { ModelListbox } from '@/shared/ui/ModelListbox';
import type { ApiModelOptionGroup } from '../lib/buildApiModelOptions';

const LABEL_ID = 'siglens-api-default-model-label';
const VALUE_ID = 'siglens-api-default-model-value';

interface ModelFieldProps {
    /** 처음 선택된 모델 — 선택지에 있는 저장값이거나 `null`(설정 안 함). */
    initial: ModelId | null;
    groups: readonly ApiModelOptionGroup[];
    /** 저장 결과·안내가 뜨는 상태 영역의 id. 트리거가 `aria-describedby`로 가리킨다(늘 렌더된다). */
    statusId: string;
}

/**
 * `DefaultModelForm`의 모델 선택 listbox + 서버 액션이 읽는 `model` 필드. 선택 상태는 제어
 * state이고 폼에는 숨김 input으로 실어 보낸다(빈 문자열 = "설정 안 함" → 서버가 해제로 처리한다).
 * `initial`은 마운트 때만 읽으므로, 저장값이 바뀌면 부모가 `key`로 다시 마운트한다.
 */
export function ModelField({ initial, groups, statusId }: ModelFieldProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const [selected, setSelected] = useState<ModelId | null>(initial);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const { isOpen, toggle, close } = usePopoverToggle([
        triggerRef,
        listboxRef,
    ]);

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
                    aria-describedby={statusId}
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
                        // API에서는 등급과 상관없이 모든 모델이 내 키로 돈다 — 등급 배지는 오해를 부른다.
                        showAccessBadge={false}
                        className="top-full left-0 mt-1 w-full min-w-44"
                    />
                )}
            </div>
        </div>
    );
}
