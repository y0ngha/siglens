import type { ChatMessageView } from '@/entities/chat-conversation/model';
import type { AgentUiMessage, ToolActivityItem } from '../model/types';

/** A `tool` row's result is shown as the chip's summary, clipped to this many characters. */
const TOOL_SUMMARY_MAX_CHARS = 120;

function replaceLast(
    out: readonly AgentUiMessage[],
    next: AgentUiMessage
): AgentUiMessage[] {
    return [...out.slice(0, -1), next];
}

function chipsOf(
    toolCalls: NonNullable<ChatMessageView['toolCalls']>
): ToolActivityItem[] {
    return toolCalls.map(c => ({
        id: c.id,
        name: c.name,
        args: c.args,
        status: 'ok',
    }));
}

/**
 * The assistant row's `toolCalls` already produced a chip for this call (with
 * its args); the `tool` row is that call's RESULT. Pushing it as a second chip
 * rendered every tool twice — once "get_quote AAPL" from the args and once bare
 * "get_quote" from here — so it merges into the first same-name chip that has
 * no result yet, and only becomes a new chip when there is none.
 */
function withToolResult(
    tools: readonly ToolActivityItem[],
    v: ChatMessageView
): ToolActivityItem[] {
    const name = v.toolName ?? 'tool';
    const summary = v.content.slice(0, TOOL_SUMMARY_MAX_CHARS);
    const index = tools.findIndex(
        t => t.name === name && t.summary === undefined
    );
    if (index < 0)
        return [...tools, { id: v.id, name, args: {}, status: 'ok', summary }];
    return tools.map((t, i) => (i === index ? { ...t, summary } : t));
}

function uiStatusOf(v: ChatMessageView): AgentUiMessage['status'] {
    return v.status === 'aborted' ? 'aborted' : 'complete';
}

function foldView(out: AgentUiMessage[], v: ChatMessageView): AgentUiMessage[] {
    const prev = out.at(-1);
    const prevIsEmptyAssistant =
        prev?.role === 'assistant' && prev.content === '';
    if (v.role === 'tool') {
        if (prev?.role !== 'assistant') return out;
        return replaceLast(out, {
            ...prev,
            tools: withToolResult(prev.tools, v),
        });
    }
    // A tool-carrying assistant row is a step, not an answer. Its `content`
    // is the model narrating what it is about to fetch ("I'll fetch the
    // quote…", often in English) — chat products hide that; rendering it
    // produced stray narration bubbles and detached the tool chips from the
    // final answer whenever DeepSeek talked before calling.
    if (v.role === 'assistant' && v.toolCalls && v.toolCalls.length > 0) {
        if (prev && prevIsEmptyAssistant)
            return replaceLast(out, {
                ...prev,
                tools: [...prev.tools, ...chipsOf(v.toolCalls)],
            });
        return [
            ...out,
            {
                id: v.id,
                seq: v.seq,
                role: 'assistant',
                content: '',
                tools: chipsOf(v.toolCalls),
                status: 'complete',
            },
        ];
    }
    if (v.role === 'assistant' && prev && prevIsEmptyAssistant)
        return replaceLast(out, {
            ...prev,
            id: v.id,
            seq: v.seq,
            content: v.content,
            status: uiStatusOf(v),
            ...(v.followUps ? { followUps: v.followUps } : {}),
        });
    return [
        ...out,
        {
            id: v.id,
            seq: v.seq,
            role: v.role,
            content: v.content,
            tools: [],
            status: uiStatusOf(v),
            ...(v.followUps ? { followUps: v.followUps } : {}),
        },
    ];
}

/**
 * DB rows → UI messages, for `useAgentStream`'s initial transcript: tool-call
 * steps and their `tool` result rows fold into the assistant bubble that
 * answers them, so a reloaded conversation renders like the live stream did.
 */
export function fromViews(views: readonly ChatMessageView[]): AgentUiMessage[] {
    return views.reduce<AgentUiMessage[]>(foldView, []);
}
