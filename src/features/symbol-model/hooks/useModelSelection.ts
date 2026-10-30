'use client';

import { useMemo } from 'react';
import {
    getAllowedModels,
    type ModelId,
    type Tier,
} from '@y0ngha/siglens-core';
import { pickFallbackModel } from '../lib/pickFallbackModel';
import { splitSelectableModels } from '../lib/selectableModels';
import { useDisabledServerKeyModels } from './useDisabledServerKeyModels';
import { useSelectedModel } from './useSelectedModel';
import { useUserTier } from './useUserTier';

/** {@link useModelSelection}의 결과. `SymbolModelProvider`가 컨텍스트 값으로 그대로 옮긴다. */
export interface ModelSelection {
    tier: Tier;
    isTierHydrated: boolean;
    /** 이 등급이 목록에서 보는 모델 전부. 일시 중단된 모델도 들어 있다. */
    allowedModels: readonly ModelId[];
    /** `allowedModels` 중 운영자가 꺼 둔 서버 키 모델. */
    unavailableModels: readonly ModelId[];
    /** 저장된 선택을 고를 수 없을 때 떨어지는 모델(고를 수 있는 모델에 `pickFallbackModel` 적용). */
    fallbackModel: ModelId;
    modelId: ModelId;
    /** 선택을 바꾸고 저장한다. 게이트(`useModelGate`)를 통과한 선택만 여기로 온다. */
    setModelId: (model: ModelId) => void;
    /** 저장된 선택을 읽었는지. 그 전의 `modelId`는 기본값이라 분석 요청에 쓰지 않는다. */
    isHydrated: boolean;
}

/**
 * 종목 페이지의 분석 모델 선택 — 등급 목록(core `getAllowedModels`)에서 꺼진 서버 키 모델을
 * 빼고, 남은 목록으로 저장된 선택을 검증한다. 등급·모델 정책 판정은 core가 하고 이 훅은
 * 그 결과를 조합만 한다.
 *
 * 선택 검증은 고를 수 있는 모델로만 한다 — 꺼진 모델 저장값은 기본 모델로 떨어진다.
 * 저장값(localStorage)은 지우지 않으므로 스위치를 다시 켜면 다음 로드에 되살아난다.
 */
export function useModelSelection(): ModelSelection {
    const { tier, isLoading: isTierLoading } = useUserTier();
    const { models: disabledModels, isSettled: isAvailabilitySettled } =
        useDisabledServerKeyModels();
    const allowedModels = useMemo(() => getAllowedModels(tier), [tier]);
    const { unavailableModels, selectableModels } = useMemo(
        () => splitSelectableModels(allowedModels, disabledModels),
        [allowedModels, disabledModels]
    );
    const fallbackModel = useMemo(
        () => pickFallbackModel(selectableModels),
        [selectableModels]
    );
    const isTierHydrated = !isTierLoading;
    // REACT.md#HK-1 예외: 아래 훅의 입력이 바로 위 파생값(`isTierHydrated`)이다.
    // 저장된 선택은 등급과 꺼진 모델 목록이 **둘 다** 확정된 뒤에 읽는다. 목록보다 먼저
    // 읽으면 꺼진 모델로 첫 분석이 나간 뒤 강등돼 같은 분석이 한 번 더 나간다.
    const [modelId, setModelId, isHydrated] = useSelectedModel(
        selectableModels,
        isTierHydrated && isAvailabilitySettled
    );

    return {
        tier,
        isTierHydrated,
        allowedModels,
        unavailableModels,
        fallbackModel,
        modelId,
        setModelId,
        isHydrated,
    };
}
