import { describe, expect, it } from 'vitest';
import type { ChatMessageView } from '@/entities/chat-conversation';
import { fromViews } from '@/features/agent-chat';

const view = (v: Partial<ChatMessageView>): ChatMessageView =>
    ({
        id: 'x',
        seq: 1,
        role: 'user',
        content: '',
        status: 'complete',
        ...v,
    }) as ChatMessageView;

describe('fromViews', () => {
    it('한 툴 호출을 칩 하나로 합친다(assistant.toolCalls + tool 행 중복 금지)', () => {
        // 재빌드가 두 소스를 각각 칩으로 만들면 같은 호출이 "get_quote AAPL"과
        // 인자 없는 "get_quote"로 두 번 렌더된다(e2e strict mode 위반의 원인).
        const out = fromViews([
            view({ id: 'u1', seq: 1, role: 'user', content: 'AAPL 얼마야' }),
            view({
                id: 'a1',
                seq: 2,
                role: 'assistant',
                content: '',
                toolCalls: [
                    {
                        id: 't1',
                        name: 'get_quote',
                        args: { symbols: ['AAPL'] },
                    },
                ],
            }),
            view({
                id: 'm1',
                seq: 3,
                role: 'tool',
                content: '{"price":1}',
                toolName: 'get_quote',
            }),
            view({ id: 'a2', seq: 4, role: 'assistant', content: '231.42' }),
        ]);
        const assistant = out.find(m => m.role === 'assistant');
        expect(assistant?.tools).toHaveLength(1);
        expect(assistant?.tools[0]?.name).toBe('get_quote');
        expect(assistant?.tools[0]?.args).toEqual({ symbols: ['AAPL'] });
        expect(assistant?.tools[0]?.summary).toContain('price');
    });
});
