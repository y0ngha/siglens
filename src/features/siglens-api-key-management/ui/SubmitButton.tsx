'use client';

import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
    label: string;
    pendingLabel: string;
    className: string;
    disabled?: boolean;
    'aria-label'?: string;
    buttonRef?: React.Ref<HTMLButtonElement>;
}

export function SubmitButton({
    label,
    pendingLabel,
    className,
    disabled = false,
    'aria-label': ariaLabel,
    buttonRef,
}: SubmitButtonProps) {
    const { pending } = useFormStatus();
    return (
        <button
            ref={buttonRef}
            type="submit"
            // 포커스를 쥔 채 진행 중이 되는 버튼은 disabled가 아니라 aria-disabled다(REACT.md#AX-3) —
            // disabled가 되면 포커스가 body로 떨어진다. 클릭은 직접 막는다.
            aria-disabled={pending || undefined}
            disabled={disabled}
            aria-busy={pending}
            aria-label={ariaLabel}
            className={className}
            onClick={event => {
                if (pending) event.preventDefault();
            }}
        >
            {pending ? pendingLabel : label}
        </button>
    );
}
