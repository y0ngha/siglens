'use client';

import { useMemo } from 'react';
import {
    DEFAULT_TIER,
    getAllowedModels,
    type ModelId,
} from '@y0ngha/siglens-core';
import { useSelectedProvider } from '@/components/symbol-page/hooks/useSelectedProvider';
import {
    FALLBACK_MODEL_ID,
    resolveDefaultModelForProvider,
} from '@/domain/llm/providerDefaults';

const ALLOWED_MODELS = getAllowedModels(DEFAULT_TIER);

// AI 분석 컴포넌트들이 selectedProvider에서 modelId를 derive하는 패턴 공통화.
export function useDefaultModelId(): ModelId {
    const [selectedProvider] = useSelectedProvider();
    return useMemo(
        () =>
            resolveDefaultModelForProvider(selectedProvider, ALLOWED_MODELS) ??
            FALLBACK_MODEL_ID,
        [selectedProvider]
    );
}
