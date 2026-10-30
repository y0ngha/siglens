import 'server-only';
import OpenAI from 'openai';
import type {
    AgentProviderResult,
    CallAgentProviderOptions,
} from '@y0ngha/siglens-core';
import {
    accumulateToolCallDeltas,
    buildToolCalls,
    holdNarration,
    mapStopReason,
    type PartialToolCall,
} from '../../lib/agentStream';
import {
    extractOpenAiCompatibleUsage,
    type OpenAiCompatibleUsageLike,
} from '../../lib/usage';
import { logUsage } from '../logUsage';

const AGENT_JOB_ID = 'agent';

/** `CallAgentProviderOptions`에 라우터가 해석한 provider별 모델 ID를 더한 옵션. */
export type AgentAdapterOptions = CallAgentProviderOptions & {
    apiModelId: string;
};

/**
 * 응답 헤더도 청크도 이 시간 동안 없으면 호출을 abort한다. 조용한 provider는 10분짜리
 * 스트림 마감까지 턴을 붙잡고, 멈춘 호출은 다른 모델로 폴백할 수도 없다. 90초는 flash 티어에서
 * 관찰된 가장 느린 첫 토큰 지연보다 한참 크다.
 */
export const AGENT_STALL_TIMEOUT_MS = 90_000;
/** 스톨 감시가 abort한 호출의 `error.code`. 라우터가 폴백 대상 여부를 이 값으로 가른다. */
export const AGENT_PROVIDER_STALLED = 'AGENT_PROVIDER_STALLED';

/** OpenAI 호환 chat.completions 요청 중 provider별로 다른 부분. */
export interface OpenAiCompatibleRequest {
    baseURL: string;
    /** system 프롬프트를 뺀 transcript (루프가 `o.system`을 앞에 붙인다). */
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    /** provider 전용 최상위 본문 필드 (예: DeepSeek `thinking`). */
    extraBody: Record<string, unknown>;
    /**
     * 샘플링 temperature. `undefined`면 본문에서 뺀다. Gemini는 넣지 않는다:
     * Google은 3.6 Flash부터 커스텀 샘플링을 무시하고, 앞으로 나올 모델은 400을 낸다고 공지했다.
     */
    temperature?: number;
}

function stalledError(): Error {
    return Object.assign(
        new Error(
            `[agent] provider stalled: no response for ${AGENT_STALL_TIMEOUT_MS}ms`
        ),
        { code: AGENT_PROVIDER_STALLED }
    );
}

/** 호출자 signal의 abort를 내부 controller로 전달하고, 리스너를 푸는 함수를 돌려준다. */
function linkAbortSignal(
    source: AbortSignal,
    controller: AbortController
): () => void {
    const forwardAbort = (): void => controller.abort(source.reason);
    if (source.aborted) forwardAbort();
    else source.addEventListener('abort', forwardAbort, { once: true });
    return () => source.removeEventListener('abort', forwardAbort);
}

interface StallWatchdog {
    /** 타이머를 (재)무장한다. 응답·청크가 올 때마다 부른다. */
    arm(): void;
    /** 감시가 직접 abort를 걸었는가. 호출자 abort와 구분하는 데 쓴다. */
    isStalled(): boolean;
    dispose(): void;
}

/** `AGENT_STALL_TIMEOUT_MS` 동안 `arm()`이 없으면 `controller`를 abort하는 감시자. */
function createStallWatchdog(controller: AbortController): StallWatchdog {
    let stalled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
        arm: () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                stalled = true;
                controller.abort();
            }, AGENT_STALL_TIMEOUT_MS);
        },
        isStalled: () => stalled,
        dispose: () => clearTimeout(timer),
    };
}

/** 스트리밍 chat.completions 요청 본문. 도구가 없으면 `tools`·`tool_choice`를 싣지 않는다. */
function buildRequestBody(
    o: AgentAdapterOptions,
    req: OpenAiCompatibleRequest
): OpenAI.Chat.ChatCompletionCreateParamsStreaming {
    return {
        model: o.apiModelId,
        messages: [{ role: 'system', content: o.system }, ...req.messages],
        ...(o.tools.length > 0
            ? {
                  tools: o.tools.map(t => ({
                      type: 'function' as const,
                      function: {
                          name: t.name,
                          description: t.description,
                          // core의 `JsonSchemaObject`는 인덱스 시그니처가 없는 닫힌 모양이고
                          // openai SDK의 `FunctionParameters`는 `Record<string, unknown>`을 요구해 펼쳐서 넘긴다.
                          parameters: { ...t.inputSchema },
                      },
                  })),
                  tool_choice: o.toolChoice ?? 'auto',
              }
            : {}),
        max_tokens: o.maxOutputTokens,
        ...(req.temperature !== undefined
            ? { temperature: req.temperature }
            : {}),
        ...req.extraBody,
        stream: true,
        stream_options: { include_usage: true },
    };
}

/**
 * OpenAI 호환 스트리밍 루프(DeepSeek, Gemini)를 공유한다: 요청, 도구 호출 누적, 종료 사유
 * 매핑, usage 텔레메트리, 스톨 감시.
 *
 * 감시자는 `o.signal`에 연결된 내부 controller로 abort하므로, 스톨은 `code: AGENT_PROVIDER_STALLED`로
 * reject하고 호출자 abort는 평범한 abort 오류로 드러난다. 도구가 제공되는 스텝은 텍스트 앞부분을
 * 보류한다(`AGENT_NARRATION_HOLD_CHARS`). 이벤트(`text`/`tool_call`/`usage`/`stop`)는 `o.onEvent`로 내보낸다.
 */
export async function streamOpenAiCompatibleAgent(
    o: AgentAdapterOptions,
    req: OpenAiCompatibleRequest
): Promise<AgentProviderResult> {
    const client = new OpenAI({ apiKey: o.apiKey, baseURL: req.baseURL });
    const controller = new AbortController();
    const unlinkAbort = linkAbortSignal(o.signal, controller);
    const watchdog = createStallWatchdog(controller);

    const startedAt = Date.now();
    let text = '';
    // 아직 내보내지 않은 보류 텍스트. 이 스텝의 보류가 풀리면 `null`이다.
    let held: string | null = o.tools.length > 0 ? '' : null;
    const emitText = (delta: string): void => {
        text += delta;
        o.onEvent({ type: 'text', delta });
    };
    let finish: string | null | undefined;
    let usage: OpenAiCompatibleUsageLike | undefined;
    const partial = new Map<number, PartialToolCall>();
    try {
        watchdog.arm();
        const stream = await client.chat.completions.create(
            buildRequestBody(o, req),
            { signal: controller.signal }
        );
        for await (const chunk of stream) {
            watchdog.arm();
            const choice = chunk.choices[0];
            const delta = choice?.delta;
            if (delta?.content) {
                const step = holdNarration(held, delta.content);
                held = step.held;
                if (step.emit) emitText(step.emit);
            }
            // 도구 호출 앞에 보류된 텍스트는 답이 아니라 예고 문장이다.
            if (held !== null && delta?.tool_calls?.length) held = '';
            accumulateToolCallDeltas(partial, delta?.tool_calls ?? []);
            if (choice?.finish_reason) finish = choice.finish_reason;
            if (chunk.usage) usage = chunk.usage;
        }
        // openai SDK는 스트림 도중 signal이 abort되면 `for await`를 조용히 끝낸다. 포트 계약은
        // upstream 오류를 전파하라는 것이므로 부분 결과로 resolve하지 않는다.
        o.signal.throwIfAborted();
        if (watchdog.isStalled()) throw stalledError();
    } catch (err) {
        if (watchdog.isStalled() && !o.signal.aborted) throw stalledError();
        throw err;
    } finally {
        watchdog.dispose();
        unlinkAbort();
    }

    const toolCalls = buildToolCalls(partial);
    const stopReason = mapStopReason(finish, toolCalls.length > 0);
    if (held && stopReason !== 'tool_use') emitText(held);
    // core는 `tool_use`일 때만 호출을 실행한다. 그 외에 알리면 실행되지 않을 호출의 칩이 보인다.
    if (stopReason === 'tool_use') {
        for (const call of toolCalls) o.onEvent({ type: 'tool_call', call });
    }

    const normalized = extractOpenAiCompatibleUsage(usage);
    logUsage({
        jobId: AGENT_JOB_ID,
        model: o.apiModelId,
        latencyMs: Date.now() - startedAt,
        ...normalized,
    });
    o.onEvent({ type: 'usage', usage: normalized });

    o.onEvent({ type: 'stop', reason: stopReason });

    return { text, toolCalls, stopReason, usage: normalized };
}
