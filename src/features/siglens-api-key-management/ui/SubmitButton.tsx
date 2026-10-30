'use client';

import type { MouseEvent, Ref } from 'react';
import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
    label: string;
    /** 전송 중에 `label` 대신 보이는 문구. */
    pendingLabel: string;
    /** 톤 상수와 크기. */
    className: string;
    /** 제출 자체가 막힌 상태(이메일 미인증·상한 도달). 전송 중 잠금과는 별개다. */
    disabled?: boolean;
    /** 버튼만으로는 알 수 없는 사정(확인 문구 등)을 읽히게 할 요소의 id. */
    'aria-describedby'?: string;
    /** 포커스를 옮기거나 확인 모달을 통과한 제출의 submitter로 쓴다. */
    buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * 이 슬라이스 폼들의 제출 버튼. 전송 중에는 문구가 바뀌고 다시 누를 수 없다.
 *
 * 전송 중 잠금은 `disabled`가 아니라 `aria-disabled`다(REACT.md#AX-3) — 포커스를 쥔 버튼이
 * `disabled`가 되면 포커스가 `<body>`로 떨어진다. 중복 제출은 클릭(Enter의 암묵 제출 포함)의
 * 기본 동작을 막아 대신 차단한다.
 */
export function SubmitButton({
    label,
    pendingLabel,
    className,
    disabled = false,
    'aria-describedby': ariaDescribedby,
    buttonRef,
}: SubmitButtonProps) {
    const { pending } = useFormStatus();
    const blockWhilePending = (event: MouseEvent<HTMLButtonElement>): void => {
        if (pending) event.preventDefault();
    };
    return (
        <button
            ref={buttonRef}
            type="submit"
            aria-disabled={pending || undefined}
            disabled={disabled}
            aria-busy={pending}
            aria-describedby={ariaDescribedby}
            className={className}
            onClick={blockWhilePending}
        >
            {pending ? pendingLabel : label}
        </button>
    );
}
