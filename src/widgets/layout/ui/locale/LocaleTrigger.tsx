'use client';

import { useTranslations } from 'next-intl';
import { LOCALE_NATIVE_LABEL, type Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { GlobeIcon } from '@/shared/ui/StrokeIcons';
import type { Ref } from 'react';

interface LocaleTriggerProps {
    readonly ref: Ref<HTMLButtonElement>;
    readonly locale: Locale;
    readonly isOpen: boolean;
    readonly isPending: boolean;
    /** 팝오버 요소 id. 열려 있을 때만 `aria-controls`로 가리킨다. */
    readonly menuId: string;
    readonly showLabel: boolean;
    readonly onClick: () => void;
}

/**
 * 언어 전환 트리거. 이름에 **현재 선택**을 적는다 — 결과가 넷이므로 동작이 아니라 지금
 * 상태를 말해야 한다. 보이는 글자(현재 언어 이름)는 이 이름에 포함된다.
 */
export function LocaleTrigger({
    ref,
    locale,
    isOpen,
    isPending,
    menuId,
    showLabel,
    onClick,
}: LocaleTriggerProps) {
    const t = useTranslations('widgets.layout');
    const currentLabel = t('localeSwitcher.current', {
        v0: LOCALE_NATIVE_LABEL[locale],
    });
    return (
        <button
            ref={ref}
            type="button"
            onClick={onClick}
            disabled={isPending}
            aria-expanded={isOpen}
            aria-controls={isOpen ? menuId : undefined}
            aria-label={currentLabel}
            title={currentLabel}
            className={cn(
                'flex h-11 items-center justify-center gap-1.5 rounded-lg text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:text-secondary-500',
                // 라벨이 보일 때는 정사각 고정을 푼다. 아이콘만 남는 모바일 헤더는 44px
                // 정사각으로 형제(검색·햄버거)와 폭을 맞추지만, 라벨을 강제한 자리에서
                // 그 폭을 유지하면 아이콘+글자가 44px 안에 갇혀 왼쪽 벽에 달라붙는다.
                showLabel ? 'px-2' : 'w-11 px-0 sm:w-auto sm:px-2'
            )}
        >
            {/* 지구본이 언어 선택의 일반 관용구다 — 특정 서비스의 식별 표지는 쓰지 않는다. */}
            <GlobeIcon className="size-5 shrink-0" />
            <span
                className={cn(
                    'text-sm',
                    showLabel ? 'inline' : 'hidden sm:inline'
                )}
            >
                {LOCALE_NATIVE_LABEL[locale]}
            </span>
        </button>
    );
}
