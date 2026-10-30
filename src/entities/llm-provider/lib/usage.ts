/**
 * 챗·번역·agent provider 어댑터의 토큰 사용량 정규화.
 *
 * `@y0ngha/siglens-core`는 자체 provider 클라이언트에서 동일한 `[Usage]` 줄을 내보내지만
 * **분석** 경로에서만이다. 챗·번역은 이 슬라이스의 어댑터를 거치므로 텔레메트리가 없었고,
 * "우리 키로 누가 Opus 5를 태우나?"를 로그에서 답할 수 없었다.
 *
 * core의 추출기는 공개 API가 아니고 deep import도 금지라 여기에 미러링했다. **필드 이름과
 * `[Usage]` 태그는 core와 의도적으로 같다** — CloudWatch Logs Insights 쿼리 하나가 두 경로를
 * 함께 집계한다. core의 shape가 바뀌면 같은 커밋에서 여기도 바꾼다.
 */

/**
 * 호출당 정규화된 토큰 수.
 *
 * 세 입력 버킷은 서로 겹치지 않으며 합이 provider가 보고한 전체 입력이다:
 * `promptTokens + cachedTokens + cacheWriteTokens`.
 *
 * - `promptTokens` — 표준 가격(1x)의 비캐시 입력.
 * - `cachedTokens` — 캐시 **읽기**. Anthropic은 약 0.1x로 과금한다.
 * - `cacheWriteTokens` — 캐시 **쓰기**(약 1.25x). Claude만 따로 보고하고 나머지는 항상 0이다.
 *   쓰기 할증이 표준 가격 버킷을 부풀리지 않도록 `promptTokens`와 분리했다.
 */
export interface NormalizedUsage {
    promptTokens: number;
    cachedTokens: number;
    cacheWriteTokens: number;
    outputTokens: number;
}

const ZERO_USAGE: NormalizedUsage = Object.freeze({
    promptTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
});

/** `callAiProviderRouter`로 보낸 호출의 기본 `jobId`. 직접 호출하는 어댑터 사용처는 자기 라벨을 넘긴다. */
export const CHAT_JOB_ID = 'chat';

/** Anthropic Messages API usage (`@anthropic-ai/sdk` `Message.usage`). */
export interface ClaudeUsageLike {
    input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    output_tokens?: number | null;
}

/** Claude 응답 usage를 정규화한다. 캐시 읽기·쓰기를 각자 버킷으로 나눈다. usage가 없으면 0이다. */
export function extractClaudeUsage(
    usage: ClaudeUsageLike | undefined | null
): NormalizedUsage {
    if (!usage) return { ...ZERO_USAGE };
    return {
        promptTokens: usage.input_tokens ?? 0,
        cachedTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
    };
}

/** Gemini `GenerateContentResponse.usageMetadata` (`@google/genai`). */
export interface GeminiUsageLike {
    promptTokenCount?: number;
    cachedContentTokenCount?: number;
    candidatesTokenCount?: number;
}

/** Gemini usage를 정규화한다. `promptTokenCount`가 캐시분을 포함하므로 빼서 버킷을 겹치지 않게 한다. */
export function extractGeminiUsage(
    usage: GeminiUsageLike | undefined | null
): NormalizedUsage {
    if (!usage) return { ...ZERO_USAGE };
    return {
        promptTokens: Math.max(
            0,
            (usage.promptTokenCount ?? 0) - (usage.cachedContentTokenCount ?? 0)
        ),
        cachedTokens: usage.cachedContentTokenCount ?? 0,
        // Gemini는 캐시 쓰기 지표를 따로 보고하지 않는다.
        cacheWriteTokens: 0,
        outputTokens: usage.candidatesTokenCount ?? 0,
    };
}

/**
 * OpenAI **Responses API** usage (`openai.ts`가 `client.responses.create`를 부른다).
 *
 * Responses API는 `input_tokens` / `input_tokens_details.cached_tokens` / `output_tokens`를
 * 보고한다 — Chat Completions 이름(`prompt_tokens` / `completion_tokens`)이 아니다.
 * 후자를 쓰면 조용히 전부 0이 추출된다.
 */
export interface OpenAIUsageLike {
    input_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens?: number;
}

/** OpenAI Responses usage를 정규화한다. 캐시 읽기분은 표준 가격 버킷에서 뺀다. */
export function extractOpenAIUsage(
    usage: OpenAIUsageLike | undefined | null
): NormalizedUsage {
    if (!usage) return { ...ZERO_USAGE };
    const cached = usage.input_tokens_details?.cached_tokens ?? 0;
    return {
        promptTokens: Math.max(0, (usage.input_tokens ?? 0) - cached),
        cachedTokens: cached,
        // OpenAI는 캐시 쓰기 지표를 따로 보고하지 않는다.
        cacheWriteTokens: 0,
        outputTokens: usage.output_tokens ?? 0,
    };
}

/**
 * OpenAI 호환 `chat.completions` usage — 위 Responses 모양이 아닌 고전적 Chat Completions
 * 모양이다. 이 repo의 OpenAI 호환 클라이언트로 `chat.completions.create`를 부르는 모든
 * provider를 덮는다: DeepSeek(`deepseek.ts`, `prompt_cache_hit_tokens`)와 Gemini의 OpenAI
 * 호환 엔드포인트(`agent/openAiCompatibleStream.ts`, `prompt_tokens_details.cached_tokens`).
 *
 * 캐시 읽기는 DeepSeek 고유의 `prompt_cache_hit_tokens`(`prompt_tokens = hit + miss`) 또는
 * OpenAI 호환 `prompt_tokens_details.cached_tokens`로 오며, 둘 다 표준 가격 버킷에서 뺀다.
 */
export interface OpenAiCompatibleUsageLike {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
}

/** OpenAI 호환 chat.completions usage를 정규화한다. DeepSeek 고유 캐시 필드를 우선한다. */
export function extractOpenAiCompatibleUsage(
    usage: OpenAiCompatibleUsageLike | undefined | null
): NormalizedUsage {
    if (!usage) return { ...ZERO_USAGE };
    const cached =
        usage.prompt_cache_hit_tokens ??
        usage.prompt_tokens_details?.cached_tokens ??
        0;
    return {
        promptTokens: Math.max(0, (usage.prompt_tokens ?? 0) - cached),
        cachedTokens: cached,
        // DeepSeek은 캐시 쓰기를 일반 미스로 과금한다 — 따로 보고하는 지표가 없다.
        cacheWriteTokens: 0,
        outputTokens: usage.completion_tokens ?? 0,
    };
}
