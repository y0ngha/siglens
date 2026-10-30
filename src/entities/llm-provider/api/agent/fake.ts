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
 * core의 `composeAgentUserMessage`가 턴별 `## Now` 메모와 사용자 본인의 말 사이에 넣는 제목
 * (core 2.14.0+). core가 export하지 않아 여기에 미러링했다. core가 이름을 바꾸면 `userWords`가
 * 전체 content로 폴백하고 e2e 에코 단언이 눈에 띄게 실패한다.
 */
const TURN_MESSAGE_HEADING = '\n## Message\n';

/**
 * 마지막 user 메시지에서 사용자 본인의 말만 뽑는다. core 2.14.0부터 provider는 그 메시지 앞에
 * 시계 메모("## Now", UTC·ET·KST 시각)가 붙은 채 받는다 — 전체 content를 읽으면 "UTC"를 티커로
 * 집어 메모를 그대로 에코한다. SIGLENS는 평문만 저장하므로 입력을 에코하는 이 fake만 메모를 본다.
 */
function userWords(content: string): string {
    const at = content.indexOf(TURN_MESSAGE_HEADING);
    return at === -1
        ? content
        : content.slice(at + TURN_MESSAGE_HEADING.length);
}

/** 결정적인 E2E provider: 처음 나온 대문자 티커로 get_quote를 한 번 부른 뒤 고정 답변을 돌려준다. */
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
