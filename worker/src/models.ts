import { TIER_CONFIG } from '@y0ngha/siglens-core';
import type { TierModel } from '@y0ngha/siglens-core';

/**
 * siglens-core가 backward-compatibility로 type union에 남겨둔 deprecated 식별자.
 * TIER_CONFIG.models 런타임 값에는 포함되지 않으므로 worker는 거절한다.
 */
type DeprecatedAIModel = 'claude-sonnet-4' | 'claude-opus-4';

/**
 * Worker가 지원하는 AI 모델 식별자.
 * siglens-core의 `TierModel`에서 deprecated 식별자를 제외한 active set.
 */
export type AIModel = Exclude<TierModel, DeprecatedAIModel>;

export type ClaudeModel = Extract<AIModel, `claude-${string}`>;
export type GeminiModel = Extract<AIModel, `gemini-${string}`>;
export type ChatGPTModel = Extract<AIModel, `gpt-${string}`>;

/**
 * 모든 tier에 등장한 모델의 합집합 = worker가 받을 수 있는 전체 모델 집합.
 * 런타임 모델 검증에만 사용한다.
 */
const ALL_MODELS: ReadonlySet<string> = new Set<string>(
    Object.values(TIER_CONFIG.models).flat()
);

/** Runtime guard for model values received over HTTP. */
export function isSupportedModel(value: unknown): value is AIModel {
    return typeof value === 'string' && ALL_MODELS.has(value);
}

/**
 * siglens가 server API key로 직접 제공하는 모델.
 * siglens-core의 tier-free와는 의미가 다르다 — 여기는 "키 제공", tier-free는 "접근 권한".
 * 정책상 둘이 같은 집합이라 `TIER_CONFIG.models.free`를 그대로 사용한다.
 *
 * `TIER_CONFIG.models.free`는 `readonly TierModel[]`로 타입이 추론되어 deprecated 식별자가
 * 포함될 수 있으나, 런타임 값에는 deprecated가 없으므로 `readonly AIModel[]`로 cast한다.
 */
export const SIGLENS_PROVIDED_MODELS: readonly AIModel[] =
    TIER_CONFIG.models.free as readonly AIModel[];

const SIGLENS_PROVIDED_MODELS_LOOKUP: ReadonlySet<string> = new Set<string>(
    SIGLENS_PROVIDED_MODELS
);

/** True when siglens가 server key로 제공하는 모델 — user key 불필요. */
export function isSiglensProvided(model: AIModel): boolean {
    return SIGLENS_PROVIDED_MODELS_LOOKUP.has(model);
}

export type AIProvider = 'claude' | 'gemini' | 'chatgpt';

/** model 식별자에서 호출 provider를 결정한다. */
export function getProvider(model: AIModel): AIProvider {
    if (isClaudeModel(model)) return 'claude';
    if (isGeminiModel(model)) return 'gemini';
    return 'chatgpt';
}

export function isClaudeModel(model: AIModel): model is ClaudeModel {
    return model.startsWith('claude-');
}

export function isGeminiModel(model: AIModel): model is GeminiModel {
    return model.startsWith('gemini-');
}

export function isChatGPTModel(model: AIModel): model is ChatGPTModel {
    return model.startsWith('gpt-');
}

// ──────────────────────────────────────────────────────────────────────────
// 모델별 max output tokens
// ──────────────────────────────────────────────────────────────────────────
//
// Claude (Anthropic API 표준 max output, SDK 0.92.0 기준):
//   - claude-haiku-3-5:  8K
//   - claude-sonnet-4-6: 128K
//   - claude-opus-4-7:   128K
//
// Gemini (단일 65K로 통일 — 기존 worker 정책 유지):
//   - 모든 모델: 65,536
//
// OpenAI (GPT-5 계열 기준):
//   - 모든 모델: 128K
// ──────────────────────────────────────────────────────────────────────────

export const CLAUDE_MODEL_MAX_TOKENS: Record<ClaudeModel, number> = {
    'claude-haiku-3-5': 8_192,
    'claude-sonnet-4-6': 128_000,
    'claude-opus-4-7': 128_000,
};

/**
 * 모델별 thinking 초기 budget.
 * 0이면 thinking 미지원 (claude-haiku-3-5).
 * `budget_tokens`는 반드시 `< max_tokens`이어야 한다.
 */
export const CLAUDE_MODEL_THINKING_BUDGET: Record<ClaudeModel, number> = {
    'claude-haiku-3-5': 0,
    'claude-sonnet-4-6': 32_000,
    'claude-opus-4-7': 32_000,
};

export const GEMINI_MODEL_MAX_TOKENS: Record<GeminiModel, number> = {
    'gemini-2.5-flash': 65_536,
    'gemini-2.5-flash-lite': 65_536,
    'gemini-2.5-pro': 65_536,
    'gemini-3-flash-preview': 65_536,
    'gemini-3.1-pro-preview': 65_536,
};

/** flash-lite: 24576 / 그 외 flash·pro: 32768 (기존 worker config 정책 유지). */
export const GEMINI_MODEL_THINKING_BUDGET: Record<GeminiModel, number> = {
    'gemini-2.5-flash': 32_768,
    'gemini-2.5-flash-lite': 24_576,
    'gemini-2.5-pro': 32_768,
    'gemini-3-flash-preview': 32_768,
    'gemini-3.1-pro-preview': 32_768,
};

export const CHATGPT_MODEL_MAX_TOKENS: Record<ChatGPTModel, number> = {
    'gpt-5-mini': 128_000,
    'gpt-5.4': 128_000,
    'gpt-5.5': 128_000,
};
