'use client';

import type { MouseEvent } from 'react';
import { useFormStatus } from 'react-dom';

interface PendingLabelSubmitProps {
    label: string;
    /** 전송 중에 `label` 대신 보이는 문구. */
    pendingLabel: string;
    /** 톤 상수와 크기. 전송 중 모양은 `aria-disabled:` 변형으로 준다. */
    className: string;
    'aria-describedby'?: string;
}

/**
 * 카드 안의 작은 아웃라인 제출 버튼. 공용 `SubmitButton`은 전폭 채움 + 흰 스피너라
 * 이 자리(인라인 아웃라인, 문구만 바뀜)에 맞지 않아 톤 상수만 공유한다.
 *
 * 전송 중에는 `disabled`가 아니라 `aria-disabled`로 잠근다. 포커스를 쥔 버튼에
 * `disabled`를 걸면 포커스가 `<body>`로 떨어져, 실패한 뒤 키보드 사용자가 처음부터
 * 다시 Tab을 눌러야 한다. 중복 제출은 클릭(Enter·암묵 제출 포함)을 막아 대신 차단한다.
 */
export function PendingLabelSubmit({
    label,
    pendingLabel,
    className,
    'aria-describedby': ariaDescribedby,
}: PendingLabelSubmitProps) {
    const { pending } = useFormStatus();
    const blockWhilePending = (event: MouseEvent<HTMLButtonElement>): void => {
        if (pending) event.preventDefault();
    };
    return (
        <button
            type="submit"
            onClick={blockWhilePending}
            aria-disabled={pending || undefined}
            aria-busy={pending}
            aria-describedby={ariaDescribedby}
            className={className}
        >
            {pending ? pendingLabel : label}
        </button>
    );
}
