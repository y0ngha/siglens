'use client';

import {
    startTransition,
    useCallback,
    useEffect,
    useEffectEvent,
    useState,
} from 'react';
import { DEEPSEEK_V4_FLASH_MODEL, type ModelId } from '@y0ngha/siglens-core';
import { LOCAL_STORAGE_ANALYSIS_MODEL_KEY } from '@/shared/lib/storageKeys';
import { migrateLegacyAnalysisModel } from '../lib/migrateAnalysisModel';

const DEFAULT_MODEL: ModelId = DEEPSEEK_V4_FLASH_MODEL;

export function useSelectedModel(
    allowedModels: readonly ModelId[]
): [ModelId, (m: ModelId) => void, boolean] {
    const [selectedModel, setSelectedModelState] =
        useState<ModelId>(DEFAULT_MODEL);
    const [isHydrated, setIsHydrated] = useState(false);

    const setSelectedModel = useCallback((model: ModelId): void => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, model);
        }
        setSelectedModelState(model);
    }, []);

    const readFromStorage = useEffectEvent((): void => {
        if (typeof window === 'undefined') return;
        // Run the one-time legacy-default migration BEFORE reading, so the read
        // below picks up the migrated value for users still on gemini-2.5-flash-lite.
        migrateLegacyAnalysisModel();
        const stored = localStorage.getItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY
        ) as ModelId | null;
        const resolved =
            stored !== null && allowedModels.includes(stored)
                ? stored
                : DEFAULT_MODEL;
        startTransition(() => {
            setSelectedModelState(resolved);
            setIsHydrated(true);
        });
    });

    useEffect(() => {
        readFromStorage();
    }, []);

    // Re-validate when tier changes (e.g., user logs in/out)
    useEffect(() => {
        if (
            allowedModels.length > 0 &&
            !allowedModels.includes(selectedModel)
        ) {
            const fallback = allowedModels.includes(DEFAULT_MODEL)
                ? DEFAULT_MODEL
                : (allowedModels[0] ?? DEFAULT_MODEL);
            startTransition(() => setSelectedModelState(fallback));
        }
    }, [allowedModels, selectedModel]);

    return [selectedModel, setSelectedModel, isHydrated];
}
