/**
 * @file provider별 "기본 모델 후보" 우선순위 테이블.
 *
 * ⚠️ **이 파일의 어떤 export도 현재 production 소비처가 없다.**
 * `FALLBACK_MODEL_ID`, 네 개의 `*_MODEL_PRIORITY`, `resolveDefaultModelForProvider`
 * 모두 barrel(`entities/llm-provider`)로 공개돼 있을 뿐 `src/` 어디에서도 호출되지
 * 않는다 — 분석 모델 기본값은 `useSelectedModel`의 `DEEPSEEK_V4_FLASH_MODEL`이,
 * BYOK 게이트는 `shared/lib/byokGate`가 `TIER_CONFIG`를 직접 읽어 처리한다.
 * 따라서 순서를 바꿔도 지금은 런타임 동작이 변하지 않는다.
 *
 * 그럼에도 목록을 최신으로 유지하는 이유: 나중에 "이 provider 키만 등록한 사용자에게
 * 어떤 모델을 기본으로 줄 것인가"를 소비하는 코드가 붙었을 때, 낡은 목록이면 신규
 * 모델이 조용히 후보에서 빠진다. `providerDefaults.test.ts`의 coverage 테스트가
 * MODEL_SPECS와의 누락을 감시한다.
 *
 * **정렬은 기계적 규칙이 아니라 판단이다.** "그 키만 가진 사용자에게 기본으로 주기
 * 가장 적절한 모델" 순이며, 라인 등급(pro/flash/lite 같은 성능 계층)과 세대 중
 * 어느 쪽도 항상 이기지 않는다. 그래서 목록마다 근거를 한 줄씩 남긴다 — 새 모델을
 * 끼워 넣을 때는 그 근거에 맞춰 위치를 정하고, 근거가 바뀌면 주석도 함께 고칠 것.
 */
import {
    MODEL_SPECS,
    type AIProvider,
    type ModelId,
} from '@y0ngha/siglens-core';

/** 어떤 provider별 모델도 해석되지 않았을 때 쓰는 최종 기본값. */
export const FALLBACK_MODEL_ID = 'claude-haiku-4-5' as const satisfies ModelId;

/** 세대 우선 — Anthropic은 세대 갭이 라인 갭보다 크다고 보고 5세대를 모두 앞에 둔다. */
export const CLAUDE_MODEL_PRIORITY: readonly ModelId[] = [
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
];

/**
 * 라인 우선(Pro → Flash → Flash-Lite), 라인 안에서 세대 우선.
 * Gemini는 최신 세대(3.6/3.5)가 Flash·Flash-Lite 라인에만 있고 Pro 라인은 3.1이
 * 최상위다. 세대를 앞세우면 Pro 3.1이 Flash 3.6·Flash-Lite 3.5 뒤로 밀려 추론
 * 성능이 필요한 상황에서도 Flash 계열이 먼저 잡힌다 — 그래서 Pro 3.1을 신세대
 * Flash보다 앞에 둔다.
 */
export const GEMINI_MODEL_PRIORITY: readonly ModelId[] = [
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro',
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
];

/** 세대 우선, 같은 세대 안에서는 상위 변형 우선(sol → terra). */
export const CHATGPT_MODEL_PRIORITY: readonly ModelId[] = [
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5-mini',
];

/**
 * 유일하게 성능 역순 — v4-pro가 상위(`thinking: true`)지만 flash가 앱 전역
 * 기본 모델(`DEEPSEEK_V4_FLASH_MODEL`)이라 기본값 후보로도 flash를 먼저 둔다.
 */
export const DEEPSEEK_MODEL_PRIORITY: readonly ModelId[] = [
    'deepseek-v4-flash',
    'deepseek-v4-pro',
];

const PROVIDER_PRIORITY_MAP: Record<AIProvider, readonly ModelId[]> = {
    claude: CLAUDE_MODEL_PRIORITY,
    gemini: GEMINI_MODEL_PRIORITY,
    chatgpt: CHATGPT_MODEL_PRIORITY,
    deepseek: DEEPSEEK_MODEL_PRIORITY,
};

export function resolveDefaultModelForProvider(
    provider: AIProvider,
    allowedModels: readonly ModelId[]
): ModelId | null {
    const priorityList = PROVIDER_PRIORITY_MAP[provider];
    const allowedSet = new Set(allowedModels);

    const match = priorityList.find(
        modelId =>
            allowedSet.has(modelId) &&
            modelId in MODEL_SPECS &&
            // PROVIDER_PRIORITY_MAP only contains keys defined in MODEL_SPECS, so the cast is safe
            MODEL_SPECS[modelId as keyof typeof MODEL_SPECS].provider ===
                provider
    );

    return match ?? null;
}
