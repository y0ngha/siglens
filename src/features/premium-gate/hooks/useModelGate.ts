'use client';

import { useState } from 'react';
import {
    getProviderForModel,
    type ModelId,
    type LlmProvider,
} from '@y0ngha/siglens-core';
import type { GateMode } from '@/entities/api-key';
import { currentUserAction } from '@/entities/auth/actions';
import { getRegisteredProvidersAction } from '@/entities/api-key/actions';
import { useQuery } from '@tanstack/react-query';
import {
    CURRENT_USER_STALE_TIME_MS,
    QUERY_KEYS,
    REGISTERED_PROVIDERS_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { resolveGateAccess } from '@/shared/lib/modelAccess';

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
     * `resolveTierAndByok` in `shared/lib/byokGate.ts`:
     * - free models always pass, anonymous included
     * - member and byok models both require auth (auth gate)
     * - member models then pass on the server key — no BYOK key needed
     * - byok models additionally require a registered provider key, unless the
     *   caller is pro tier (server covers the cost)
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
    const isHydrated = useHydrated();

    const { data: currentUser } = useQuery({
        queryKey: QUERY_KEYS.currentUser(),
        queryFn: currentUserAction,
        enabled: isHydrated,
        staleTime: CURRENT_USER_STALE_TIME_MS,
    });

    const { data: registeredProviders = [] } = useQuery({
        queryKey: QUERY_KEYS.registeredProviders(),
        queryFn: getRegisteredProvidersAction,
        enabled: isHydrated,
        staleTime: REGISTERED_PROVIDERS_STALE_TIME_MS,
    });

    const handleModelChange = (model: ModelId): void => {
        // 알 수 없는 ID는 가장 제한적인 등급으로 접는다 — throw하면 핸들러가
        // 죽어 모델 선택 자체가 먹통이 된다. `resolveGateAccess` JSDoc 참고.
        const access = resolveGateAccess(model);
        if (access !== 'free') {
            const requiredProvider = getProviderForModel(model);
            if (!currentUser) {
                setGateModal({ mode: 'auth', provider: requiredProvider });
                return;
            }
            // member 모델은 로그인만으로 열린다 — 서버 키가 요금을 낸다.
            // byok 게이트는 byok 등급에만 적용한다.
            if (access === 'byok' && currentUser.tier !== 'pro') {
                if (
                    !registeredProviders.some(
                        p => p.provider === requiredProvider
                    )
                ) {
                    setGateModal({ mode: 'byok', provider: requiredProvider });
                    return;
                }
            }
        }
        onAllow(model);
    };

    const dismissGate = (): void => {
        setGateModal(null);
    };

    const showGate = (state: ModelGateState): void => {
        setGateModal(state);
    };

    return { gateModal, dismissGate, handleModelChange, showGate };
}
