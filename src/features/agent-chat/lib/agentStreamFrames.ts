import { isPlainRecord } from '@/shared/lib/isPlainRecord';
import type { AgentUiMessage } from '../model/types';

/** Parsed `data:` payload of one SSE frame (`parseSseFrame`), untrusted until narrowed. */
type FrameData = Record<string, unknown>;

/**
 * Text before a tool call shorter than this is narration ("시세를 확인해
 * 볼게요") and is dropped; longer text is a real answer the model went back
 * on, and becomes a `draft`.
 * Known limit: length heuristic; a model-side "answer started" signal would be exact.
 */
export const DRAFT_MIN_CHARS = 120;

/** `done` 프레임의 `followUps` — 문자열 배열만 받는다(그 밖의 값은 칩 없음). */
export function followUpsOf(raw: unknown): string[] {
    return Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === 'string')
        : [];
}

/** Appends one batch of streamed `text` deltas to the answer being written. */
export function withText(m: AgentUiMessage, delta: string): AgentUiMessage {
    return { ...m, content: m.content + delta };
}

/**
 * `tool_start`: adds a running chip. Text streamed before a tool call is
 * narration, not the answer (see `fromViews`) — it is dropped so the bubble
 * shows the tool steps and then the real reply, unless it is long enough to be
 * an abandoned answer, which is kept as `draft` until `done` clears it (the UI
 * hides it once new text arrives).
 */
export function withToolStarted(
    m: AgentUiMessage,
    data: FrameData
): AgentUiMessage {
    return {
        ...m,
        content: '',
        draft: m.content.trim().length >= DRAFT_MIN_CHARS ? m.content : m.draft,
        tools: [
            ...m.tools,
            {
                id: String(data.id),
                name: String(data.name),
                args: isPlainRecord(data.args) ? data.args : {},
                status: 'running',
                estimatedSeconds:
                    typeof data.estimatedSeconds === 'number'
                        ? data.estimatedSeconds
                        : undefined,
            },
        ],
    };
}

/** `tool_end`: settles the chip with that id; a frame for an unknown id changes nothing. */
export function withToolEnded(
    m: AgentUiMessage,
    data: FrameData
): AgentUiMessage {
    return {
        ...m,
        tools: m.tools.map(t =>
            t.id === data.id
                ? {
                      ...t,
                      status: data.status === 'ok' ? 'ok' : 'error',
                      ms: Number(data.ms),
                      summary: String(data.summary ?? ''),
                  }
                : t
        ),
    };
}

/** `done`: the stored id, the server's final body and follow-up chips, and the completed status. */
export function withDone(m: AgentUiMessage, data: FrameData): AgentUiMessage {
    return {
        ...m,
        // Not `?? m.id`: a guest turn is never stored, so the server sends
        // `assistantMessageId: ''`. Taking that gave every guest answer the same
        // React key ("Encountered two children with the same key").
        id:
            typeof data.assistantMessageId === 'string' &&
            data.assistantMessageId !== ''
                ? data.assistantMessageId
                : m.id,
        // 서버가 후속 질문 마커 줄을 뗀 최종 본문. 스트리밍 중엔 마커일 수 있는 끝줄을
        // 보류했으므로, 여기서 확정값으로 맞춘다.
        content: typeof data.body === 'string' ? data.body : m.content,
        followUps: followUpsOf(data.followUps),
        draft: undefined,
        status: 'complete',
        truncated: data.stopReason === 'max_tokens',
    };
}

/**
 * `meta`: attaches the stored user row's `seq` to the optimistic user bubble
 * `send`/`edit` appended right before the pending assistant bubble — without
 * it, Edit has nothing to key off of until a reload re-hydrates from
 * `ChatMessageView[]`. A bubble that already has a seq keeps it.
 */
export function withUserSeq(
    messages: AgentUiMessage[],
    seq: number
): AgentUiMessage[] {
    const userIndex = messages.length - 2;
    const target = messages[userIndex];
    if (!target || target.role !== 'user' || target.seq !== undefined)
        return messages;
    return messages.map((m, i) => (i === userIndex ? { ...m, seq } : m));
}

/** Applies `fn` to the last bubble — the one the current turn is streaming into. */
export function patchLastMessage(
    messages: AgentUiMessage[],
    fn: (m: AgentUiMessage) => AgentUiMessage
): AgentUiMessage[] {
    const last = messages.at(-1);
    return last === undefined ? messages : [...messages.slice(0, -1), fn(last)];
}

/**
 * Marks the bubble `id` aborted if it is still streaming. Used for a turn
 * that a newer call replaced: that turn's bubble is no longer last, so
 * `patchLastMessage` cannot reach it, and without this it would show a live
 * streaming state forever.
 */
export function abortStreamingMessage(
    messages: AgentUiMessage[],
    id: string
): AgentUiMessage[] {
    return messages.map(m =>
        m.id === id && m.status === 'streaming'
            ? { ...m, status: 'aborted' }
            : m
    );
}
