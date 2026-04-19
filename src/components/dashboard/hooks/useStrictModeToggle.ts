'use client';

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'siglens:strict-mode';

function readFromStorage(): boolean | null {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'strict') return true;
        if (v === 'loose') return false;
        return null;
    } catch {
        return null;
    }
}

function writeToStorage(strict: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, strict ? 'strict' : 'loose');
    } catch {
        // ignore quota errors, SecurityError, etc.
    }
}

export function useStrictModeToggle(
    initialStrict: boolean
): readonly [boolean, (next: boolean) => void] {
    const [strict, setStrict] = useState<boolean>(() => {
        if (typeof window === 'undefined') return initialStrict;
        const stored = readFromStorage();
        return stored ?? initialStrict;
    });

    const setStrictMode = useCallback((next: boolean) => {
        setStrict(next);
        writeToStorage(next);
    }, []);

    return [strict, setStrictMode] as const;
}
