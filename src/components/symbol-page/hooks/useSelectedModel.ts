'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import { GEMINI_2_5_FLASH_LITE_MODEL, type ModelId } from '@y0ngha/siglens-core';
import { LOCAL_STORAGE_ANALYSIS_MODEL_KEY } from '@/lib/storageKeys';

const DEFAULT_MODEL: ModelId = GEMINI_2_5_FLASH_LITE_MODEL;

export function useSelectedModel(
    allowedModels: readonly ModelId[]
): [ModelId, (m: ModelId) => void] {
    const [selectedModel, setSelectedModelState] =
        useState<ModelId>(DEFAULT_MODEL);

    const setSelectedModel = useCallback((model: ModelId): void => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, model);
        }
        setSelectedModelState(model);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored = localStorage.getItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY
        ) as ModelId | null;
        const resolved =
            stored !== null && allowedModels.includes(stored)
                ? stored
                : DEFAULT_MODEL;
        startTransition(() => setSelectedModelState(resolved));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-validate when tier changes (e.g., user logs in/out)
    useEffect(() => {
        if (allowedModels.length > 0 && !allowedModels.includes(selectedModel)) {
            const fallback = allowedModels.includes(DEFAULT_MODEL)
                ? DEFAULT_MODEL
                : (allowedModels[0] ?? DEFAULT_MODEL);
            startTransition(() => setSelectedModelState(fallback));
        }
    }, [allowedModels, selectedModel]);

    return [selectedModel, setSelectedModel];
}
