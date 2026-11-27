'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { CheckboxBox } from './CheckboxBox';

interface OptionalConsentCheckboxProps {
    /** 입력 id. 생략하면 자동으로 만든다. */
    id?: string;
    /** 스크린 리더가 묶음을 읽는 이름(`legend`, 화면에는 보이지 않는다). */
    legend: string;
    label: string;
    /** 체크 전에 알아야 할 내용. `aria-describedby`로 체크박스에 연결된다. */
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

/**
 * `min-w-0`: fieldset은 기본이 `min-inline-size: min-content`라 긴 문장이 있으면 열보다 넓어진다.
 * ja·zh 줄바꿈은 전역(`globals.css`의 `:lang(ja)`·`:lang(zh)`)이 맡는다.
 *
 * 필수 약관 묶음과 따로 두는 **선택** 동의 한 줄. 필수 표시(`required`·`aria-required`)가 없고,
 * "모두 동의" 같은 묶음 컨트롤이 다루지 않는다 — 선택 동의를 필수 동의에 끼워 한 번에 받으면
 * 자유로운 선택이 아니게 된다. 도메인 문구는 호출하는 쪽이 넘긴다.
 */
export function OptionalConsentCheckbox({
    id,
    legend,
    label,
    description,
    checked,
    onChange,
}: OptionalConsentCheckboxProps) {
    const t = useTranslations('shared.ui');
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const descriptionId = `${inputId}-description`;

    return (
        <fieldset className="min-w-0 touch-manipulation space-y-2 border-b border-secondary-700 pb-4 [-webkit-tap-highlight-color:transparent]">
            <legend className="sr-only">{legend}</legend>
            <label
                htmlFor={inputId}
                className="flex min-h-11 cursor-pointer items-start gap-2 py-1"
            >
                <CheckboxBox
                    checked={checked}
                    invalid={false}
                    inputProps={{
                        id: inputId,
                        'aria-describedby': descriptionId,
                        onChange: event => onChange(event.target.checked),
                    }}
                />
                <span className="min-w-0 text-sm text-secondary-300">
                    <span className="mr-1 text-xs text-secondary-400">
                        {t('OptionalConsentCheckbox.optional')}
                    </span>
                    {label}
                </span>
            </label>
            <p id={descriptionId} className="text-xs text-secondary-400">
                {description}
            </p>
        </fieldset>
    );
}
