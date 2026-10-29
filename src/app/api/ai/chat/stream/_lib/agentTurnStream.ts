import {
    findUngroundedNumbers,
    runAgentTurn,
    splitAgentFollowUps,
    type Tier,
} from '@y0ngha/siglens-core';
import type { NewChatMessage } from '@/entities/chat-conversation/model';
import { getAgentProvider } from '@/entities/llm-provider/api/agent/getAgentProvider';
import {
    AGENT_FALLBACK_MODEL,
    AGENT_MODEL,
    type AgentProviderState,
} from '@/entities/llm-provider/api/agent/router';
import type { Locale } from '@/shared/i18n/locales';
import {
    AgentTurnError,
    agentEventStream,
} from '@/app/api/ai/chat/agentEventStream';
import {
    agentGlobalLimitsFromEnv,
    createAgentCounters,
} from '@/app/api/ai/chat/counters';
import {
    availableToolNames,
    createToolExecutor,
} from '@/app/api/ai/chat/tools/chatTools';
import { createFollowUpTextFilter } from '@/app/api/ai/chat/followUps';
import { persistedStatusFor } from './persistedStatus';
import { isConversationGone, type ReadyTurn } from './prepareTurn';

/**
 * Answer length cap per provider call. Core's default (4,096) cut long
 * multi-symbol summaries mid-sentence; DeepSeek accepts far more, and a turn
 * rarely needs more than this.
 */
const AGENT_MAX_OUTPUT_TOKENS = 8_192;

/**
 * 행 저장이 대화 삭제 경합(FK 위반)으로 실패하면 원본 드라이버 오류 대신
 * `AgentTurnError('not_found')`로 바꿔 던진다 — 클라이언트에 SQL·바인딩 값이
 * 새지 않고, 이미 끝난 턴이 모호한 `server_error`로 보이지 않는다.
 */
export async function appendOrNotFound(
    repo: NonNullable<ReadyTurn['repo']>,
    conversationId: string,
    rows: NewChatMessage[]
): Promise<Awaited<ReturnType<typeof repo.appendMessages>>> {
    try {
        return await repo.appendMessages(conversationId, rows);
    } catch (error) {
        if (isConversationGone(error)) throw new AgentTurnError('not_found');
        throw error;
    }
}

export interface AgentTurnStreamParams {
    turn: ReadyTurn;
    /** 쿼터·락·도구 실행기가 보는 주체 — 회원 id 또는 `guest:<cookie id>`. */
    subject: string;
    guest: boolean;
    tier: Tier;
    locale: Locale;
    /** 클라이언트가 보낸 시간대 헤더 값. 신뢰하지 않는다 — core가 검증한다. */
    timeZone: string | undefined;
    /** 턴이 끝나면(성공·실패·중단) 정확히 한 번 불리는 슬롯·락 반납. */
    release: () => Promise<void>;
}

/**
 * 한 번의 에이전트 턴을 SSE 스트림으로 실행한다. 클라이언트가 끊으면
 * `agentEventStream`의 `onAbort`가 provider/도구 signal을 중단시키고, 부분
 * 답변은 저장한 뒤 `release`가 불린다.
 */
export function agentTurnStream({
    turn,
    subject,
    guest,
    tier,
    locale,
    timeZone,
    release,
}: AgentTurnStreamParams): ReadableStream<Uint8Array> {
    const {
        repo,
        conversationId,
        title,
        userMessage,
        userMessageId,
        userMessageSeq,
        history,
        portfolioSymbols,
    } = turn;

    const controller = new AbortController();
    const executeTool = createToolExecutor({ analysisModel: AGENT_MODEL });
    const toolTimings: Array<{
        name: string;
        ms: number;
        status: string;
    }> = [];
    // Shared across every provider call this turn makes; the router flips
    // `fallbackUsed` if/when DeepSeek fails and Gemini answers instead.
    const providerState: AgentProviderState = { fallbackUsed: false };
    // 후속 질문 마커 줄은 클라이언트로 보내지 않는다 — 칩 항목은 `done`이 싣는다.
    const followUpFilter = createFollowUpTextFilter();

    return agentEventStream({
        meta: {
            conversationId,
            userMessageId,
            userMessageSeq,
            // Always AGENT_MODEL: this frame goes out before the turn runs,
            // so the fallback state isn't known yet.
            model: AGENT_MODEL,
            ...(title !== undefined ? { title } : {}),
        },
        onAbort: () => controller.abort(),
        work: async emit => {
            try {
                const result = await runAgentTurn(
                    {
                        userId: subject,
                        tier,
                        model: AGENT_MODEL,
                        locale,
                        history,
                        userMessage,
                        availableTools: availableToolNames(),
                        portfolioSymbols,
                        // Untrusted; core validates and falls back to the locale's zone.
                        timeZone,
                        signal: controller.signal,
                    },
                    {
                        callAgentProvider: getAgentProvider(providerState),
                        executeTool,
                        counters: createAgentCounters(),
                        globalLimits: agentGlobalLimitsFromEnv(),
                        maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS,
                        onEvent: event => {
                            if (event.type === 'tool_end')
                                toolTimings.push({
                                    name: event.name,
                                    ms: event.ms,
                                    status: event.status,
                                });
                            if (event.type === 'text') {
                                const delta = followUpFilter.push(event.delta);
                                if (delta) emit({ ...event, delta });
                                return;
                            }
                            if (event.type === 'tool_start')
                                followUpFilter.reset();
                            emit(event);
                        },
                    }
                );
                // Known only after the turn ran: which model actually answered.
                const effectiveModel = providerState.fallbackUsed
                    ? AGENT_FALLBACK_MODEL
                    : AGENT_MODEL;
                if (!result.ok) {
                    const partial = result.partialText?.trim();
                    if (partial && repo && conversationId) {
                        await appendOrNotFound(repo, conversationId, [
                            {
                                role: 'assistant',
                                content: partial,
                                modelId: effectiveModel,
                                status: persistedStatusFor(result.error),
                            },
                        ]);
                    }
                    throw new AgentTurnError(result.error);
                }
                // Log-only grounding check: flags numbers in the final
                // answer that don't trace back to any tool result this
                // turn. Never alters the answer and must never throw —
                // a false positive/negative here is a telemetry gap, not
                // a reason to fail an otherwise-successful turn.
                try {
                    const toolResults = result.intermediate
                        .filter(m => m.role === 'tool')
                        .map(m => m.content);
                    const ungrounded = findUngroundedNumbers(
                        result.assistant.content,
                        toolResults
                    );
                    if (ungrounded.length > 0) {
                        // Serialize before logging: passing a plain object lets
                        // Node's util.inspect pretty-print it over several lines,
                        // and CloudWatch stores each line as its own event
                        // (observed 2026-09-14), breaking Logs Insights parsing.
                        // Same single-JSON shape as `[Usage]`; `[Agent]` passes a
                        // pre-stringified second argument, which also stays on
                        // one line.
                        console.warn(
                            JSON.stringify({
                                tag: '[agent] ungrounded numbers',
                                count: ungrounded.length,
                                sample: ungrounded.slice(0, 5),
                                promptVersion: result.promptVersion,
                            })
                        );
                    }
                } catch (error) {
                    console.error('[agent] grounding check failed:', error);
                }
                const rowsToSave: NewChatMessage[] = [
                    ...result.intermediate.map(m => ({
                        role: m.role,
                        content: m.content,
                        toolCalls: m.toolCalls,
                        toolCallId: m.toolCallId,
                        toolName: m.toolName,
                    })),
                    {
                        role: 'assistant',
                        content: result.assistant.content,
                        modelId: effectiveModel,
                        usage: {
                            ...result.usage,
                            toolsUsed: result.toolsUsed,
                            promptVersion: result.promptVersion,
                        },
                    },
                ];
                let assistantMessageId = '';
                if (repo && conversationId) {
                    const saved = await appendOrNotFound(
                        repo,
                        conversationId,
                        rowsToSave
                    );
                    assistantMessageId = saved.at(-1)?.id ?? '';
                }
                console.info(
                    '[Agent]',
                    JSON.stringify({
                        conversationId,
                        userId: subject,
                        guest,
                        model: effectiveModel,
                        fallbackUsed: providerState.fallbackUsed,
                        steps: result.usage.steps,
                        toolCalls: toolTimings,
                        promptVersion: result.promptVersion,
                        ms: result.usage.ms,
                        stopReason: result.stopReason,
                    })
                );
                emit({ type: 'usage', usage: result.usage });
                // 최종 본문과 칩 항목. 저장은 원문 그대로(모델이 읽을 기록), 화면용
                // 나누기는 여기서 한 번 — 클라이언트는 core를 싣지 않는다.
                const { body: answerBody, followUps } = splitAgentFollowUps(
                    result.assistant.content
                );
                return {
                    assistantMessageId,
                    body: answerBody,
                    followUps,
                    remaining: result.remaining,
                    stopReason: result.stopReason,
                    ...(title !== undefined ? { title } : {}),
                };
            } finally {
                await release();
            }
        },
    });
}
