import {
    findUngroundedNumbers,
    runAgentTurn,
    splitAgentFollowUps,
    type Tier,
} from '@y0ngha/siglens-core';
import type {
    ChatMessageRecord,
    NewChatMessage,
} from '@/entities/chat-conversation/model';
import { getAgentProvider } from '@/entities/llm-provider/api/agent/getAgentProvider';
import {
    AGENT_FALLBACK_MODEL,
    AGENT_MODEL,
    type AgentProviderState,
} from '@/entities/llm-provider/api/agent/router';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
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
import { createTurnCharts } from './turnCharts';

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
): Promise<ChatMessageRecord[]> {
    try {
        return await repo.appendMessages(conversationId, rows);
    } catch (error) {
        if (isConversationGone(error)) throw new AgentTurnError('not_found');
        throw error;
    }
}

/**
 * 턴의 시계 메모를 만든 시각을 user 행에 저장한다(시각만 — 메모 문구에는 사용자의 현지 시각·시간대가 들어
 * 있어 저장하지 않는다). 실패해도 턴은 계속한다 — 시각이 없으면 다음 턴의 provider 캐시가 한 번 빗나갈 뿐이고,
 * 이미 끝난 (과금된) 턴을 저장 오류로 잃을 이유가 없다.
 */
async function persistTurnAt(
    repo: NonNullable<ReadyTurn['repo']>,
    conversationId: string,
    messageId: string,
    turnAt: string
): Promise<void> {
    try {
        await repo.setTurnAt(conversationId, messageId, turnAt);
    } catch (error) {
        console.warn('[agent] turn time save failed:', error);
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
        userImages,
        userMessageId,
        userMessageSeq,
        turnAtRowId,
        history,
        portfolioSymbols,
    } = turn;

    const controller = new AbortController();
    const charts = createTurnCharts();
    const executeTool = createToolExecutor(
        { analysisModel: AGENT_MODEL },
        { onChart: charts.register }
    );
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
                        // 이번 턴 이미지만 모델에 보낸다 — core가 기록 속 과거 이미지는 싣지 않는다.
                        ...(userImages.length > 0
                            ? {
                                  userImages: userImages.map(image => ({
                                      mediaType: image.mediaType,
                                      data: image.bytes.toString('base64'),
                                  })),
                              }
                            : {}),
                        availableTools: availableToolNames(),
                        portfolioSymbols,
                        // Untrusted; core validates and falls back to the locale's zone.
                        timeZone,
                        // The KRX holiday list lives in the app on purpose (core has no KRX calendar).
                        krSession: KR_EQUITY_SESSION,
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
                            if (event.type === 'tool_start') {
                                followUpFilter.reset();
                                charts.started(
                                    event.id,
                                    event.name,
                                    event.args
                                );
                            }
                            emit(event);
                            if (
                                event.type === 'tool_end' &&
                                event.status === 'ok'
                            )
                                charts.ended(event.id, block =>
                                    emit({ type: 'chart', id: event.id, block })
                                );
                        },
                    }
                );
                // Success and failure both: the note was sent to the provider either way, and the
                // next turn must rebuild it byte for byte (core does, from this instant) to keep the
                // provider's prefix cache.
                if (repo && conversationId && turnAtRowId && result.turnAt)
                    await persistTurnAt(
                        repo,
                        conversationId,
                        turnAtRowId,
                        result.turnAt
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
                // 차트 프레임이 모두 나가고 나서 저장·`done`으로 간다 — 블록은 그 도구 행에 붙는다.
                const chartsByCall = await charts.settled();
                const rowsToSave: NewChatMessage[] = [
                    ...result.intermediate.map(m => {
                        const chart =
                            m.role === 'tool' && m.toolCallId
                                ? chartsByCall.get(m.toolCallId)
                                : undefined;
                        return {
                            role: m.role,
                            content: m.content,
                            toolCalls: m.toolCalls,
                            toolCallId: m.toolCallId,
                            toolName: m.toolName,
                            ...(chart ? { chart } : {}),
                        };
                    }),
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
