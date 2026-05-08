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
import {
    CURRENT_USER_STALE_TIME_MS,
    QUERY_KEYS,
    REGISTERED_PROVIDERS_STALE_TIME_MS,
} from '@/lib/queryConfig';

export interface ModelGateState {
    mode: GateMode;
    provider: LlmProvider;
}

interface UseModelGateOptions {
    /** Called when the model passes all gate checks. */
    onAllow: (model: ModelId) => void;
}

interface UseModelGateReturn {
    /** Active gate modal state, or null when no gate is triggered. */
    gateModal: ModelGateState | null;
    /** Dismiss the active gate modal. */
    dismissGate: () => void;
    /**
     * Wraps the model change with gate checks. Mirrors the server-side
     * resolveUserContext logic in chatAction.ts:
     * - free models always pass
     * - premium models require auth (auth gate)
     * - pro tier bypasses BYOK requirement (server covers cost)
     * - non-pro tier requires a registered provider key (byok gate)
     */
    handleModelChange: (model: ModelId) => void;
    /**
     * Programmatically open a gate, e.g. when the server returns
     * `user_api_key_required` after a chat send. The gate UI state is owned by
     * this hook so consumers should not maintain their own copy.
     */
    showGate: (state: ModelGateState) => void;
}

export function useModelGate({
    onAllow,
}: UseModelGateOptions): UseModelGateReturn {
    const [gateModal, setGateModal] = useState<ModelGateState | null>(null);

    const { data: currentUser } = useQuery({
        queryKey: QUERY_KEYS.currentUser(),
        queryFn: currentUserAction,
        staleTime: CURRENT_USER_STALE_TIME_MS,
    });

    const { data: registeredProviders = [] } = useQuery({
        queryKey: QUERY_KEYS.registeredProviders(),
        queryFn: getRegisteredProvidersAction,
        staleTime: REGISTERED_PROVIDERS_STALE_TIME_MS,
    });

    const handleModelChange = useCallback(
        (model: ModelId): void => {
            if (!isFreeChatModel(model)) {
                const requiredProvider = getProviderForModel(model);
                if (!currentUser) {
                    setGateModal({ mode: 'auth', provider: requiredProvider });
                    return;
                }
                if (currentUser.tier === 'pro') {
                    onAllow(model);
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
            onAllow(model);
        },
        [currentUser, registeredProviders, onAllow]
    );

    const dismissGate = useCallback((): void => {
        setGateModal(null);
    }, []);

    const showGate = useCallback((state: ModelGateState): void => {
        setGateModal(state);
    }, []);

    return { gateModal, dismissGate, handleModelChange, showGate };
}
