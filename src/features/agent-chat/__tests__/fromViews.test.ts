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

    it('툴 호출 행의 내레이션("I\'ll fetch…")은 버리고 툴은 최종 답변에 붙인다', () => {
        // DeepSeek는 툴을 부르기 전에 영어로 설명을 뱉는다. 그 행을 답변으로 렌더하면
        // 내레이션 버블이 따로 뜨고 도구 칩이 최종 답변에서 떨어져 나간다(실측).
        const out = fromViews([
            view({
                id: 'u1',
                seq: 1,
                role: 'user',
                content: '삼성전자 얼마야',
            }),
            view({
                id: 'a1',
                seq: 2,
                role: 'assistant',
                content: "I'll fetch the Samsung Electronics quote first.",
                toolCalls: [
                    {
                        id: 't1',
                        name: 'search_ticker',
                        args: { query: '삼성전자' },
                    },
                ],
            }),
            view({
                id: 'm1',
                seq: 3,
                role: 'tool',
                content: '{"hits":[]}',
                toolName: 'search_ticker',
            }),
            view({
                id: 'a2',
                seq: 4,
                role: 'assistant',
                content:
                    'The index has no hit, so I will run a fresh analysis.',
                toolCalls: [
                    {
                        id: 't2',
                        name: 'run_fresh_analysis',
                        args: { symbol: '005930.KS' },
                    },
                ],
            }),
            view({
                id: 'm2',
                seq: 5,
                role: 'tool',
                content: '{"found":true}',
                toolName: 'run_fresh_analysis',
            }),
            view({
                id: 'a3',
                seq: 6,
                role: 'assistant',
                content: '# 삼성전자 요약',
            }),
        ]);
        const assistants = out.filter(m => m.role === 'assistant');
        expect(assistants).toHaveLength(1);
        expect(assistants[0]?.content).toBe('# 삼성전자 요약');
        expect(assistants[0]?.tools.map(t => t.name)).toEqual([
            'search_ticker',
            'run_fresh_analysis',
        ]);
        expect(out.some(m => m.content.includes("I'll fetch"))).toBe(false);
    });
});
