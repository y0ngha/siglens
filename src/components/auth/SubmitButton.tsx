'use client';

import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
    label: string;
    pendingLabel?: string;
}

export function SubmitButton({
    label,
    pendingLabel = '처리 중…',
}: SubmitButtonProps) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 font-semibold text-white transition-colors hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 motion-reduce:transition-none"
        >
            {pending ? (
                <>
                    <span
                        aria-hidden
                        className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
                    />
                    <span>{pendingLabel}</span>
                </>
            ) : (
                label
            )}
        </button>
    );
}
