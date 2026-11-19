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

/**
 * 결정적인 E2E provider: 처음 나온 대문자 티커로 도구를 한 번 부른 뒤 고정 답변을 돌려준다. 질문에 "차트"가 있으면
 * 답변 안 차트(봉 지표 도구의 차트 블록)를 검증하도록 `get_bars_indicators`를, 아니면 `get_quote`를 부른다.
 */
export async function fakeAgentProvider(
    o: CallAgentProviderOptions
): Promise<AgentProviderResult> {
    const lastUser = userWords(
        [...o.messages].reverse().find(m => m.role === 'user')?.content ?? ''
    );
    // 이미지 턴은 도구 없이 장수만 확인한 고정 답변으로 끝낸다 — E2E가 "이미지가 모델까지 갔다"를
    // 결정적으로 확인한다(대문자 티커가 글에 있어도 도구 경로로 새지 않는다).
    const imageCount =
        [...o.messages].reverse().find(m => m.role === 'user')?.images
            ?.length ?? 0;
    if (imageCount > 0) {
        const text = `[E2E agent] 이미지 ${imageCount}장을 확인했습니다.`;
        o.onEvent({ type: 'text', delta: text });
        o.onEvent({ type: 'stop', reason: 'end' });
        return { text, toolCalls: [], stopReason: 'end', usage: ZERO };
    }
    const hasToolResult = o.messages.some(m => m.role === 'tool');
    // "비교 차트"는 시각화 블록(show_chart compare)을 검증한다 — 대문자 티커 규칙보다 먼저 본다.
    if (
        lastUser.includes('비교 차트') &&
        !hasToolResult &&
        o.tools.some(t => t.name === 'show_chart')
    ) {
        const call = {
            id: 'fake_1',
            name: 'show_chart',
            args: { kind: 'compare', symbols: ['AAPL', 'MSFT'] },
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
    const symbol = /\b[A-Z]{2,5}\b/.exec(lastUser)?.[0];
    // "차트"를 물었어도 봉 지표 도구가 없으면(가용 목록에서 빠진 실행) 예전처럼 시세로 답한다.
    const wantsChart =
        lastUser.includes('차트') &&
        o.tools.some(t => t.name === 'get_bars_indicators');
    const toolName = wantsChart ? 'get_bars_indicators' : 'get_quote';
    if (symbol && !hasToolResult && o.tools.some(t => t.name === toolName)) {
        const call = {
            id: 'fake_1',
            name: toolName,
            args: wantsChart
                ? { symbol, timeframe: '1Day', bars: 30 }
                : { symbols: [symbol] },
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
