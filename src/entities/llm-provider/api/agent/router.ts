import 'server-only';
import type {
    AgentProviderResult,
    CallAgentProvider,
    CallAgentProviderOptions,
    ModelId,
} from '@y0ngha/siglens-core';
import { MODEL_SPECS, getProviderForModel } from '@y0ngha/siglens-core';
import { getServerPrimaryKey } from '../serverKeys';
import { callDeepseekAgent } from './deepseek';
import { callGeminiAgent } from './gemini';
import { AGENT_PROVIDER_STALLED } from './openAiCompatibleStream';

/**
 * 파일럿(spec R12): agent 모델은 서버에서 고정한다. 클라이언트/core가 넘기는 `model`은 무시한다.
 *
 * core의 `DEEPSEEK_V4_1_FLASH_MODEL`이 아니라 리터럴이다: 이 모듈을 로드하는 기존 테스트가 많고
 * 그들은 `@y0ngha/siglens-core`를 부분 factory로 mock한다 — 모듈 로드 시점에 core 값을 읽으면
 * 거기서 던진다. 라우터 테스트가 이 리터럴을 core 상수에 고정해 어긋나지 않게 한다.
 */
export const AGENT_MODEL = 'deepseek-v4.1-flash' satisfies ModelId;

/**
 * agent의 자동 폴백 모델(ai.siglens.io에는 모델 선택기가 없어 사용자가 직접 바꿀 수 없다).
 * `AGENT_MODEL`과 같은 "리터럴, core 값 아님" 규칙이며, 라우터 테스트가 core의 스펙 표에 고정한다.
 */
export const AGENT_FALLBACK_MODEL = 'gemini-3.6-flash' satisfies ModelId;

/**
 * 한 턴이 실제로 `AGENT_FALLBACK_MODEL`에서 돌았는지 알리는 대역 외 신호.
 * `CallAgentProvider`(core 타입)는 스텝별 결과만 돌려주고 어느 모델이 만들었는지는 알려주지 않아,
 * 호출자가 알 방법이 없다 — 이 객체로 route.ts가 항상 `AGENT_MODEL`이 아니라 실제로 답한 모델을
 * 저장·로깅한다. 호출자가 턴마다 인스턴스 하나를 만들어 모든 스텝에 같은 객체를 넘기고,
 * `createAgentProvider`는 DeepSeek이 실패해 Gemini가 넘겨받은 스텝에서 최대 한 번 뒤집는다.
 */
export interface AgentProviderState {
    fallbackUsed: boolean;
}

/**
 * provider 문제는 다른 벤더에서 한 번 더 시도할 가치가 있다: 429, 5xx, HTTP 상태가 없는
 * 오류(네트워크), 스톨 감시. 그 외 4xx는 두 번째 벤더도 거절할 잘못된 요청이다.
 */
function isFallbackEligible(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return true;
    if ((error as { code?: unknown }).code === AGENT_PROVIDER_STALLED)
        return true;
    const status = (error as { status?: unknown }).status;
    if (typeof status !== 'number') return true;
    return status === 429 || status >= 500;
}

/** 폴백 모델의 서버 키. 없으면 `undefined`다(키 값은 로그에 싣지 않는다). */
function readFallbackKey(): string | undefined {
    return getServerPrimaryKey(getProviderForModel(AGENT_FALLBACK_MODEL));
}

/** 같은 턴을 서버 키로 `AGENT_FALLBACK_MODEL`(Gemini)에서 돌린다. */
function callFallback(
    o: CallAgentProviderOptions,
    apiKey: string
): Promise<AgentProviderResult> {
    return callGeminiAgent({
        ...o,
        model: AGENT_FALLBACK_MODEL,
        apiKey,
        apiModelId: MODEL_SPECS[AGENT_FALLBACK_MODEL].apiModelId,
    });
}

/**
 * 턴마다 `AGENT_MODEL`(DeepSeek)에 묶인 provider. DeepSeek이 사용자에게 보이는 출력이 나가기 전에
 * provider 사유로 실패하면, 같은 턴을 서버 키로 `AGENT_FALLBACK_MODEL`(Gemini)에서 한 번 재시도한다.
 *
 * 폴백은 턴 단위로 고정된다: 같은 다중 스텝 턴의 앞 스텝이 `state.fallbackUsed`를 `true`로 세팅했으면
 * 이후 스텝은 곧장 Gemini로 가고 DeepSeek은 다시 부르지 않는다. 이게 없으면 스톨하는 DeepSeek이
 * 이미 폴백한 턴의 남은 스텝마다 스톨 타임아웃을 다시 태운다.
 *
 * 폴백하지 않는 경우: 호출자가 abort했을 때, `text`/`tool_call` 이벤트가 이미 전달됐을 때(재시도하면
 * 출력이 중복된다), 오류가 429가 아닌 4xx일 때, Gemini 서버 키가 설정되지 않았을 때. 이들은 DeepSeek
 * 오류를 다시 던지고, 그것이 `server_busy`/`server_error`로 드러난다. P3에서 모델 선택과 BYOK 키가 다시 도입된다.
 */
export function createAgentProvider(
    state?: AgentProviderState
): CallAgentProvider {
    return async (
        o: CallAgentProviderOptions
    ): Promise<AgentProviderResult> => {
        if (state?.fallbackUsed) {
            const fallbackKey = readFallbackKey();
            if (!fallbackKey)
                throw new Error(
                    `[agent-router] No API key for model: ${AGENT_FALLBACK_MODEL}`
                );
            return callFallback(o, fallbackKey);
        }
        const apiKey = getServerPrimaryKey(getProviderForModel(AGENT_MODEL));
        if (apiKey === undefined)
            throw new Error(
                `[agent-router] No API key for model: ${AGENT_MODEL}`
            );
        let emitted = false;
        try {
            return await callDeepseekAgent({
                ...o,
                onEvent: e => {
                    if (e.type === 'text' || e.type === 'tool_call')
                        emitted = true;
                    o.onEvent(e);
                },
                model: AGENT_MODEL,
                apiKey,
                apiModelId: MODEL_SPECS[AGENT_MODEL].apiModelId,
            });
        } catch (err) {
            const fallbackKey = readFallbackKey();
            if (
                o.signal.aborted ||
                emitted ||
                !isFallbackEligible(err) ||
                !fallbackKey
            )
                throw err;
            console.warn(
                JSON.stringify({
                    tag: '[agent-router] deepseek failed, falling back',
                    fallbackModel: AGENT_FALLBACK_MODEL,
                    message: err instanceof Error ? err.message : String(err),
                })
            );
            if (state) state.fallbackUsed = true;
            return callFallback(o, fallbackKey);
        }
    };
}
