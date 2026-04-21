'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCopyToClipboardReturn {
    copied: boolean;
    copy: (text: string) => Promise<void>;
}

export const DEFAULT_RESET_MS = 2000;

export function useCopyToClipboard(
    resetMs = DEFAULT_RESET_MS
): UseCopyToClipboardReturn {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const copy = useCallback(
        async (text: string): Promise<void> => {
            if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
            await navigator.clipboard.writeText(text);
            setCopied(true);
            timeoutRef.current = setTimeout(() => setCopied(false), resetMs);
        },
        [resetMs]
    );

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        };
    }, []);

    return { copied, copy };
}
