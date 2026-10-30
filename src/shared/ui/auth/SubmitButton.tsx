'use client';

import { useTranslations } from 'next-intl';
import type { MouseEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { BUTTON_DANGER, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { Spinner } from '@/shared/ui/Spinner';

type SubmitButtonTone = 'primary' | 'danger';

const SUBMIT_TONE_CLASS: Record<SubmitButtonTone, string> = {
    primary: BUTTON_PRIMARY,
    danger: BUTTON_DANGER,
};

// 톤의 `disabled:` 변형은 `aria-disabled`에 걸리지 않아 같은 비활성 외형을 직접 건다.
const PENDING_CLASS =
    'cursor-not-allowed bg-secondary-700 text-secondary-500 hover:bg-secondary-700 active:bg-secondary-700';

interface SubmitButtonProps {
    label: string;
    pendingLabel?: string;
    tone?: SubmitButtonTone;
    /** 제출 조건 미충족(예: 확인 입력 불일치). 전송 중에는 이 값과 무관하게 제출이 막힌다. */
    disabled?: boolean;
}

/**
 * 폼 전폭 제출 버튼. 전송 상태는 감싼 `<form>`에서 `useFormStatus`로 읽는다.
 *
 * 전송 중에는 `disabled` 대신 `aria-disabled`를 쓴다 — 제출 버튼이 포커스를 쥔 채
 * `disabled`가 되면 포커스가 `<body>`로 떨어진다. 대신 클릭(Enter 암묵 제출 포함)을
 * 직접 막아 이중 제출을 방지한다.
 */
export function SubmitButton({
    label,
    pendingLabel,
    tone = 'primary',
    disabled = false,
}: SubmitButtonProps) {
    // 기본값을 파라미터 자리에 둘 수 없다 — 컴포넌트 본문 밖이라 훅이 아직 없다.
    const tMisc = useTranslations('shared.ui.misc');
    const resolvedPendingLabel = pendingLabel ?? tMisc('submitting');
    const { pending } = useFormStatus();
    const handleClick = (e: MouseEvent<HTMLButtonElement>): void => {
        if (pending) e.preventDefault();
    };
    return (
        <button
            type="submit"
            disabled={disabled}
            aria-disabled={pending || undefined}
            aria-busy={pending}
            onClick={handleClick}
            className={cn(
                SUBMIT_TONE_CLASS[tone],
                pending && PENDING_CLASS,
                'flex h-12 w-full focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900'
            )}
        >
            {pending ? (
                <>
                    <Spinner tone="onFill" />
                    <span>{resolvedPendingLabel}</span>
                </>
            ) : (
                label
            )}
        </button>
    );
}
