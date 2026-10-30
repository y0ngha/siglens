import type { ModelId } from '@y0ngha/siglens-core';

/** 등급 목록을 운영자가 꺼 둔 모델 기준으로 나눈 결과. */
export interface SelectableModels {
    /** 등급 목록 중 꺼진 모델 — 목록에 "일시 중단"으로 남겨 보인다. */
    unavailableModels: readonly ModelId[];
    /** 등급 목록 중 지금 고를 수 있는 모델 — 저장된 선택은 이 목록으로 검증한다. */
    selectableModels: readonly ModelId[];
}

/**
 * 등급이 보는 모델(`allowedModels`)을 꺼진 서버 키 모델(`disabledModels`) 기준으로 나눈다.
 * 등급 목록에 없는 꺼진 모델은 어느 쪽에도 넣지 않는다.
 *
 * 등급 목록 안에 꺼진 모델이 없으면 `selectableModels`로 `allowedModels`를 **그대로** 돌려준다 —
 * `useSelectedModel`의 재검증 effect가 목록의 identity를 deps로 보므로, 같은 목록에서
 * 매번 새 배열을 만들면 재검증이 불필요하게 다시 돈다.
 */
export function splitSelectableModels(
    allowedModels: readonly ModelId[],
    disabledModels: readonly ModelId[]
): SelectableModels {
    const disabled = new Set(disabledModels);
    const unavailableModels = allowedModels.filter(model =>
        disabled.has(model)
    );
    const selectableModels =
        unavailableModels.length === 0
            ? allowedModels
            : allowedModels.filter(model => !disabled.has(model));
    return { unavailableModels, selectableModels };
}
