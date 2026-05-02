'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import type { AIProvider } from '@y0ngha/siglens-core';
import { LOCAL_STORAGE_PROVIDER_KEY } from '@/lib/storageKeys';

const VALID_PROVIDERS: readonly AIProvider[] = ['claude', 'gemini', 'chatgpt'];
const DEFAULT_PROVIDER: AIProvider = 'claude';

function isValidProvider(value: string): value is AIProvider {
    // Widening AIProvider[] to string[] to use .includes(string) — safe since we only check membership
    return (VALID_PROVIDERS as string[]).includes(value);
}

export function useSelectedProvider(): [AIProvider, (p: AIProvider) => void] {
    const [selectedProvider, setSelectedProviderState] =
        useState<AIProvider>(DEFAULT_PROVIDER);

    const setSelectedProvider = useCallback((provider: AIProvider): void => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEY, provider);
        }
        setSelectedProviderState(provider);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored = localStorage.getItem(LOCAL_STORAGE_PROVIDER_KEY);
        if (stored !== null && isValidProvider(stored)) {
            startTransition(() => setSelectedProviderState(stored));
        }
    }, []);

    return [selectedProvider, setSelectedProvider];
}
