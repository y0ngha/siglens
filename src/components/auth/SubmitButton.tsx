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
            className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-900 active:bg-primary-800 flex h-12 w-full items-center justify-center gap-2 rounded-md font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 motion-reduce:transition-none"
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
