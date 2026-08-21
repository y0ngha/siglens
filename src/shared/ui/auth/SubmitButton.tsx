'use client';

import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
    label: string;
    pendingLabel?: string;
}

export function SubmitButton({ label, pendingLabel }: SubmitButtonProps) {
    // 기본값을 파라미터 자리에 둘 수 없다 — 컴포넌트 본문 밖이라 훅이 아직 없다.
    const tMisc = useTranslations('shared.ui.misc');
    const resolvedPendingLabel = pendingLabel ?? tMisc('submitting');
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary-600 font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none active:bg-primary-800 disabled:opacity-60 motion-reduce:transition-none"
        >
            {pending ? (
                <>
                    <span
                        aria-hidden
                        className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
                    />
                    <span>{resolvedPendingLabel}</span>
                </>
            ) : (
                label
            )}
        </button>
    );
}
