import { describe, expect, it } from 'vitest';
import type { ChatMessageView } from '@/entities/chat-conversation/model';
import { fromViews } from '@/features/agent-chat/lib/fromViews';

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

function rowView(
    seq: number,
    role: ChatMessageView['role'],
    content: string
): ChatMessageView {
    return {
        id: `m${seq}`,
        seq,
        role,
        content,
        toolCalls: null,
        toolName: null,
        status: 'complete',
        createdAt: new Date(2026, 0, 1).toISOString(),
    };
}

function toolCallsView(
    seq: number,
    toolCalls: { id: string; name: string; args: Record<string, unknown> }[]
): ChatMessageView {
    return {
        id: `m${seq}`,
        seq,
        role: 'assistant',
        content: '',
        toolCalls,
        toolName: null,
        status: 'complete',
        createdAt: new Date(2026, 0, 1).toISOString(),
    };
}

function toolResultView(
    seq: number,
    toolName: string | null,
    content: string
): ChatMessageView {
    return {
        id: `m${seq}`,
        seq,
        role: 'tool',
        content,
        toolCalls: null,
        toolName,
        status: 'complete',
        createdAt: new Date(2026, 0, 1).toISOString(),
    };
}

describe('fromViews — tool rows, statuses and follow-ups', () => {
    it('drops a tool row that has no preceding assistant bubble to attach to', () => {
        expect(fromViews([toolResultView(1, 'get_quote', 'result')])).toEqual(
            []
        );
    });

    it('a tool row with no matching tool call by name is appended as a new chip (not merged)', () => {
        const out = fromViews([
            toolCallsView(1, [{ id: 't1', name: 'search', args: {} }]),
            toolResultView(2, 'weird', 'result'),
        ]);
        expect(out[0]!.tools.map(t => [t.name, t.summary])).toEqual([
            ['search', undefined],
            ['weird', 'result'],
        ]);
    });

    it('a tool row with a null toolName falls back to the literal name "tool", both when matching and when pushed fresh', () => {
        const out = fromViews([
            toolCallsView(1, [{ id: 't1', name: 'search', args: {} }]),
            toolResultView(2, null, 'result'),
        ]);
        // No existing call named "tool" — pushed as a new chip named "tool".
        expect(out[0]!.tools.map(t => [t.name, t.summary])).toEqual([
            ['search', undefined],
            ['tool', 'result'],
        ]);
    });

    it('a second empty-content assistant tool-call bubble merges an aborted status', () => {
        const out = fromViews([
            toolCallsView(1, [{ id: 't1', name: 'search', args: {} }]),
            {
                id: 'm2',
                seq: 2,
                role: 'assistant',
                content: 'partial answer',
                toolCalls: null,
                toolName: null,
                status: 'aborted',
                createdAt: new Date(2026, 0, 1).toISOString(),
            },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0]!.content).toBe('partial answer');
        expect(out[0]!.status).toBe('aborted');
    });

    it('a standalone aborted assistant row (no merge) keeps the aborted status', () => {
        const out = fromViews([
            {
                id: 'm1',
                seq: 1,
                role: 'assistant',
                content: 'partial',
                toolCalls: null,
                toolName: null,
                status: 'aborted',
                createdAt: new Date(2026, 0, 1).toISOString(),
            },
        ]);
        expect(out).toEqual([
            expect.objectContaining({ content: 'partial', status: 'aborted' }),
        ]);
    });

    it('저장된 대화의 followUps(서버가 나눈 값)를 메시지에 싣는다', () => {
        const answer = {
            ...rowView(2, 'assistant', '본문'),
            followUps: ['A', 'B'],
        };
        expect(fromViews([rowView(1, 'user', 'q'), answer])[1]).toMatchObject({
            content: '본문',
            followUps: ['A', 'B'],
        });
    });
});
