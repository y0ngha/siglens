import type {
    AgentProviderResult,
    CallAgentProviderOptions,
} from '@y0ngha/siglens-core';

const ZERO = {
    promptTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
};

/**
 * Heading core's `composeAgentUserMessage` puts between its per-turn `## Now`
 * note and the user's own words (core 2.14.0+). Core does not export it, so
 * it is mirrored here; if core renames it, `userWords` falls back to the
 * whole content and the e2e echo assertions fail loudly.
 */
const TURN_MESSAGE_HEADING = '\n## Message\n';

/**
 * The user's own words from the latest user message. Since core 2.14.0 the
 * provider sees that message prefixed with a clock note ("## Now", UTC·ET·KST
 * times) — reading the whole content would pick "UTC" as the ticker and echo
 * the note back. SIGLENS persists the plain text, so only this fake (which
 * echoes its input) ever saw the note.
 */
function userWords(content: string): string {
    const at = content.indexOf(TURN_MESSAGE_HEADING);
    return at === -1
        ? content
        : content.slice(at + TURN_MESSAGE_HEADING.length);
}

/** Deterministic E2E provider: one get_quote call for the first uppercase ticker, then a fixed answer. */
export async function fakeAgentProvider(
    o: CallAgentProviderOptions
): Promise<AgentProviderResult> {
    const lastUser = userWords(
        [...o.messages].reverse().find(m => m.role === 'user')?.content ?? ''
    );
    const hasToolResult = o.messages.some(m => m.role === 'tool');
    const symbol = /\b[A-Z]{2,5}\b/.exec(lastUser)?.[0];
    if (symbol && !hasToolResult && o.tools.some(t => t.name === 'get_quote')) {
        const call = {
            id: 'fake_1',
            name: 'get_quote',
            args: { symbols: [symbol] },
        };
        o.onEvent({ type: 'tool_call', call });
        o.onEvent({ type: 'stop', reason: 'tool_use' });
        return {
            text: '',
            toolCalls: [call],
            stopReason: 'tool_use',
            usage: ZERO,
        };
    }
    const text = `[E2E agent] "${lastUser}"에 대한 테스트 답변입니다.`;
    o.onEvent({ type: 'text', delta: text });
    o.onEvent({ type: 'stop', reason: 'end' });
    return { text, toolCalls: [], stopReason: 'end', usage: ZERO };
}
