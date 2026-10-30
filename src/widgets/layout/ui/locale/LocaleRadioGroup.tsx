'use client';

import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
    LOCALES,
    LOCALE_NATIVE_LABEL,
    type Locale,
} from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { SURFACE_FLOATING } from '@/shared/lib/surfaceStyles';
import { CheckIcon } from '@/shared/ui/StrokeIcons';

/** 화살표 키 → 포커스 이동 방향. 목록 양 끝에서는 순환한다. */
const ARROW_DELTA: Record<string, number> = {
    ArrowDown: 1,
    ArrowRight: 1,
    ArrowUp: -1,
    ArrowLeft: -1,
};

interface LocaleRadioGroupProps {
    readonly id: string;
    readonly locale: Locale;
    /** 패널을 트리거의 어느 쪽에 붙일지. 트리거가 왼쪽에 있는 자리는 `start`. */
    readonly align: 'start' | 'end';
    readonly onSelect: (next: Locale) => void;
}

/**
 * 언어 라디오그룹 팝오버.
 *
 * WAI-ARIA APG의 라디오 그룹은 **단일 탭 스톱**이다(선택 항목만 `tabIndex=0`). 화살표는
 * 포커스만 옮기고 선택은 Enter/Space가 맡는다 — 언어는 라우터 이동이라 화살표 한 번에
 * 페이지가 바뀌고 메뉴도 사라지기 때문이다(테마 토글과 다른 점).
 * 언어 이름은 번역하지 않고 항목마다 `lang`을 달아 스크린리더가 해당 음성으로 읽게 한다.
 * 선택 표시는 색뿐 아니라 체크 도형으로도 말한다(WCAG 1.4.1).
 */
export function LocaleRadioGroup({
    id,
    locale,
    align,
    onSelect,
}: LocaleRadioGroupProps) {
    const t = useTranslations('widgets.layout');
    const groupRef = useRef<HTMLDivElement>(null);

    const moveFocus = (from: number, delta: number) => {
        const next = (from + delta + LOCALES.length) % LOCALES.length;
        const radios =
            groupRef.current?.querySelectorAll<HTMLButtonElement>(
                '[role="radio"]'
            );
        radios?.[next]?.focus();
    };

    const onKeyDown = (event: ReactKeyboardEvent, index: number) => {
        const delta = ARROW_DELTA[event.key];
        if (delta === undefined) return;
        event.preventDefault();
        moveFocus(index, delta);
    };

    return (
        <div
            ref={groupRef}
            id={id}
            role="radiogroup"
            aria-label={t('localeSwitcher.label')}
            className={cn(
                SURFACE_FLOATING,
                'absolute top-full z-10 mt-1 w-max min-w-44 p-1 shadow-lg',
                align === 'start' ? 'left-0' : 'right-0'
            )}
        >
            {LOCALES.map((option, index) => {
                const selected = option === locale;
                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        lang={option}
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onKeyDown={event => onKeyDown(event, index)}
                        onClick={() => onSelect(option)}
                        className={cn(
                            'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                            selected
                                ? 'bg-secondary-700 text-secondary-100'
                                : 'text-secondary-300 hover:bg-secondary-700/60 hover:text-secondary-100'
                        )}
                    >
                        <span className="flex-1 whitespace-nowrap">
                            {LOCALE_NATIVE_LABEL[option]}
                        </span>
                        {selected && <CheckIcon className="size-4 shrink-0" />}
                    </button>
                );
            })}
        </div>
    );
}
