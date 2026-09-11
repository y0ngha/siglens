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

/** Deterministic E2E provider: one get_quote call for the first uppercase ticker, then a fixed answer. */
export async function fakeAgentProvider(
    o: CallAgentProviderOptions
): Promise<AgentProviderResult> {
    const lastUser =
        [...o.messages].reverse().find(m => m.role === 'user')?.content ?? '';
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
