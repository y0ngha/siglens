'use client';

import { useId, type Ref } from 'react';

interface MailAlertFieldProps {
    readonly name: string;
    readonly label: string;
    readonly type: 'email' | 'text';
    readonly inputMode: 'email' | 'numeric';
    readonly autoComplete: string;
    readonly inputRef?: Ref<HTMLInputElement>;
    readonly maxLength?: number;
    readonly pattern?: string;
    readonly defaultValue?: string;
    readonly readOnly?: boolean;
    /** 이 필드의 오류 문구. 있으면 `aria-invalid`와 `aria-describedby`로 입력에 묶인다. */
    readonly error?: string | null;
}

/**
 * 라벨·입력·오류 문구 한 벌. 공용 `TextField`가 모르는 `inputMode`·`readOnly`·포커스 ref를 받는다
 * (코드 칸은 숫자 키패드와 한 번용 코드 자동 완성이 필요하고, 인증 전 회원의 주소는 고정이다).
 * 오류 문구 자리(`aria-live`)는 늘 렌더해 두어 내용이 바뀔 때 읽히게 한다.
 */
export function MailAlertField({
    name,
    label,
    type,
    inputMode,
    autoComplete,
    inputRef,
    maxLength,
    pattern,
    defaultValue,
    readOnly = false,
    error = null,
}: MailAlertFieldProps) {
    const id = useId();
    const errorId = `${id}-error`;
    return (
        <div className="space-y-2">
            <label
                htmlFor={id}
                className="block text-sm font-medium text-secondary-200"
            >
                {label}
            </label>
            <input
                id={id}
                ref={inputRef}
                name={name}
                type={type}
                inputMode={inputMode}
                autoComplete={autoComplete}
                maxLength={maxLength}
                pattern={pattern}
                defaultValue={defaultValue}
                readOnly={readOnly}
                required
                aria-invalid={error !== null}
                aria-describedby={error !== null ? errorId : undefined}
                className="h-12 w-full rounded-lg border border-border-control bg-secondary-950 px-4 text-sm text-secondary-50 placeholder:text-secondary-500 read-only:text-secondary-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none aria-invalid:border-ui-danger"
            />
            <p
                id={errorId}
                aria-live="polite"
                className="min-h-5 text-sm text-ui-danger-text"
            >
                {error}
            </p>
        </div>
    );
}
