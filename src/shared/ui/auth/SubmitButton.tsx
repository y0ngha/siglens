'use client';

import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';
import { BUTTON_DANGER, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { Spinner } from '@/shared/ui/Spinner';

type SubmitButtonTone = 'primary' | 'danger';

const SUBMIT_TONE_CLASS: Record<SubmitButtonTone, string> = {
    primary: BUTTON_PRIMARY,
    danger: BUTTON_DANGER,
};

interface SubmitButtonProps {
    label: string;
    pendingLabel?: string;
    tone?: SubmitButtonTone;
    /** 제출 조건 미충족(예: 확인 입력 불일치). 전송 중에는 이 값과 무관하게 잠긴다. */
    disabled?: boolean;
}

/** 폼 전폭 제출 버튼. 전송 상태는 감싼 `<form>`에서 `useFormStatus`로 읽는다. */
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
    return (
        <button
            type="submit"
            disabled={disabled || pending}
            aria-busy={pending}
            className={cn(
                SUBMIT_TONE_CLASS[tone],
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
