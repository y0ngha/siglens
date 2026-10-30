'use client';

import { useState } from 'react';
import {
    getProviderForModel,
    type ModelId,
    type LlmProvider,
} from '@y0ngha/siglens-core';
import type { GateMode } from '@/shared/lib/types';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import { useAuthHint } from '@/entities/auth/hooks/useAuthHint';
import { getRegisteredProvidersAction } from '@/entities/api-key/actions/getRegisteredProvidersAction';
import { useQuery } from '@tanstack/react-query';
import {
    QUERY_KEYS,
    REGISTERED_PROVIDERS_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { resolveGateAccess } from '@/shared/lib/modelAccess';
import { resolveGateMode, type GatedModelAccess } from '../lib/resolveGateMode';

/** 열려 있는 게이트 모달의 내용. */
export interface ModelGateState {
    mode: GateMode;
    provider: LlmProvider;
    /** 고른 모델의 등급. auth 모달이 API 키 안내를 붙일지 정한다. */
    access: GatedModelAccess;
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
}

/**
 * 모델 선택기의 변경 핸들러에 게이트를 씌운다. 통과하면 `onAllow`를 부르고, 막히면
 * 게이트 모달 상태를 연다. 판정은 `resolveGateMode`가 하고, 이 훅은 회원·등록 키 조회와
 * 모달 상태, 퍼널 기록만 소유한다.
 */
export function useModelGate({
    onAllow,
}: UseModelGateOptions): UseModelGateReturn {
    const [gateModal, setGateModal] = useState<ModelGateState | null>(null);
    const isHydrated = useHydrated();

    // 헤더·넛지와 같은 `currentUser` 쿼리 정의를 써서 재조회 기준을 맞춘다.
    const { data: currentUser } = useCurrentUser();
    const hasAuthHint = useAuthHint();

    // 등록한 API 키는 회원에게만 있다. 게스트에게는 요청하지 않는다 — Server Action은
    // 한 번에 하나씩만 나가서, 답이 항상 빈 목록인 이 요청도 뒤에 줄 선 요청을 한 번의
    // 왕복(운영 실측 ~0.3s)만큼 늦춘다. 힌트 쿠키가 있으면 즉시, 없으면
    // `currentUser`가 회원으로 확정된 뒤에 요청한다.
    const { data: registeredProviders = [] } = useQuery({
        queryKey: QUERY_KEYS.registeredProviders(),
        queryFn: getRegisteredProvidersAction,
        enabled: isHydrated && (hasAuthHint || currentUser != null),
        staleTime: REGISTERED_PROVIDERS_STALE_TIME_MS,
    });

    const handleModelChange = (model: ModelId): void => {
        // 알 수 없는 ID는 가장 제한적인 등급으로 접는다 — throw하면 핸들러가
        // 죽어 모델 선택 자체가 먹통이 된다. `resolveGateAccess` JSDoc 참고.
        const access = resolveGateAccess(model);
        if (access === 'free') {
            onAllow(model);
            return;
        }
        const provider = getProviderForModel(model);
        const mode = resolveGateMode({
            access,
            provider,
            user: currentUser,
            registeredProviders: registeredProviders.map(p => p.provider),
        });
        if (mode === null) {
            onAllow(model);
            return;
        }
        // 잠긴 모델 선택 = 비회원이 게이트를 여는 클릭. 모달 노출은 모달이 따로 센다.
        // byok 게이트는 회원 전용 API 키 안내라 기록하지 않는다.
        if (mode === 'auth') {
            trackFunnelEvent('gate_clicked', { gate: 'model' });
        }
        setGateModal({ mode, provider, access });
    };

    const dismissGate = (): void => {
        setGateModal(null);
    };

    return { gateModal, dismissGate, handleModelChange };
}
