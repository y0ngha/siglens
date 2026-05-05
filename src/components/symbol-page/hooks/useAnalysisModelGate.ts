'use client';

import { useCallback, useState } from 'react';
import {
    getProviderForModel,
    type ModelId,
    type LlmProvider,
} from '@y0ngha/siglens-core';
import { isFreeChatModel } from '@/domain/llm';
import type { GateMode } from '@/domain/llm';
import { currentUserAction } from '@/infrastructure/auth/currentUserAction';
import { getRegisteredProvidersAction } from '@/infrastructure/llm/getRegisteredProvidersAction';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { MS_PER_MINUTE } from '@/domain/constants/time';

export interface AnalysisGateModalState {
    mode: GateMode;
    provider: LlmProvider;
}

const CURRENT_USER_STALE_MS = 5 * MS_PER_MINUTE;
const REGISTERED_PROVIDERS_STALE_MS = MS_PER_MINUTE;

interface UseAnalysisModelGateOptions {
    setModel: (m: ModelId) => void;
}

interface UseAnalysisModelGateReturn {
    gateModal: AnalysisGateModalState | null;
    dismissGate: () => void;
    /**
     * Wraps setModel with a gate check.
     * PRO 모델을 선택할 때 사용자 인증 및 API 키 등록 여부를 검사한다.
     * 나중에 유료 구독제 도입 시 이 함수의 조건만 수정하면 된다.
     */
    handleModelChange: (model: ModelId) => void;
}

export function useAnalysisModelGate({
    setModel,
}: UseAnalysisModelGateOptions): UseAnalysisModelGateReturn {
    const [gateModal, setGateModal] = useState<AnalysisGateModalState | null>(
        null
    );

    const { data: currentUser } = useQuery({
        queryKey: QUERY_KEYS.currentUser(),
        queryFn: currentUserAction,
        staleTime: CURRENT_USER_STALE_MS,
    });

    const { data: registeredProviders = [] } = useQuery({
        queryKey: QUERY_KEYS.registeredProviders(),
        queryFn: getRegisteredProvidersAction,
        staleTime: REGISTERED_PROVIDERS_STALE_MS,
    });

    const handleModelChange = useCallback(
        (model: ModelId): void => {
            if (!isFreeChatModel(model)) {
                const requiredProvider = getProviderForModel(model);
                if (!currentUser) {
                    setGateModal({ mode: 'auth', provider: requiredProvider });
                    return;
                }
                if (
                    !registeredProviders.some(
                        p => p.provider === requiredProvider
                    )
                ) {
                    setGateModal({ mode: 'byok', provider: requiredProvider });
                    return;
                }
            }
            setModel(model);
        },
        [currentUser, registeredProviders, setModel]
    );

    const dismissGate = useCallback((): void => {
        setGateModal(null);
    }, []);

    return { gateModal, dismissGate, handleModelChange };
}
