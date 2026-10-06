import { describe, expect, it, vi } from 'vitest';
import {
    buildAgentTurnContext,
    composeAgentUserMessage,
} from '@y0ngha/siglens-core';
import { fakeAgentProvider } from '@/entities/llm-provider/api/agent/fake';

const base = {
    apiKey: '',
    model: 'deepseek-v4.1-flash' as const,
    system: 's',
    tools: [
        {
            name: 'get_quote',
            description: 'd',
            costClass: 'free' as const,
            inputSchema: {
                type: 'object' as const,
                properties: {},
                additionalProperties: false as const,
            },
        },
    ],
    maxOutputTokens: 100,
    signal: new AbortController().signal,
};

describe('fakeAgentProvider', () => {
    it('대문자 심볼 + 툴 결과 없음 → get_quote 1회', async () => {
        const r = await fakeAgentProvider({
            ...base,
            onEvent: vi.fn(),
            messages: [{ role: 'user', content: 'AAPL 얼마야' }],
        });
        expect(r.stopReason).toBe('tool_use');
        expect(r.toolCalls).toEqual([
            { id: 'fake_1', name: 'get_quote', args: { symbols: ['AAPL'] } },
        ]);
    });

    it('툴 결과 있음 → 결정적 텍스트', async () => {
        const onEvent = vi.fn();
        const r = await fakeAgentProvider({
            ...base,
            onEvent,
            messages: [
                { role: 'user', content: 'AAPL 얼마야' },
                {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        {
                            id: 'fake_1',
                            name: 'get_quote',
                            args: { symbols: ['AAPL'] },
                        },
                    ],
                },
                {
                    role: 'tool',
                    content: '{"price":1}',
                    toolCallId: 'fake_1',
                    toolName: 'get_quote',
                },
            ],
        });
        expect(r.stopReason).toBe('end');
        expect(r.text).toContain('[E2E agent]');
        expect(onEvent).toHaveBeenCalledWith({
            type: 'text',
            delta: expect.stringContaining('[E2E agent]'),
        });
    });

    /**
     * core 2.14.0+ `runAgentTurn`은 마지막 user 메시지 앞에 `## Now` 시계 노트(UTC·ET·KST)를
     * 붙여 프로바이더에 보낸다. 손으로 만든 문자열이 아니라 core의 실제 조합 함수로
     * 만든 형태로 검증한다 — 노트의 "UTC"를 티커로 집거나 노트를 에코하면 안 된다.
     */
    const composed = (userText: string): string =>
        composeAgentUserMessage(
            buildAgentTurnContext({
                locale: 'ko',
                now: new Date('2026-10-06T14:00:00Z'),
                etSessionStatus: 'open',
            }),
            userText
        );

    it('시계 노트가 붙은 메시지 → 노트가 아니라 사용자 문장에서 티커를 고른다', async () => {
        const r = await fakeAgentProvider({
            ...base,
            onEvent: vi.fn(),
            messages: [{ role: 'user', content: composed('AAPL 지금 얼마야') }],
        });
        expect(r.toolCalls).toEqual([
            { id: 'fake_1', name: 'get_quote', args: { symbols: ['AAPL'] } },
        ]);
    });

    it('시계 노트가 붙은 메시지 → 노트 없이 사용자 문장만 에코한다', async () => {
        const r = await fakeAgentProvider({
            ...base,
            onEvent: vi.fn(),
            messages: [{ role: 'user', content: composed('이어하기 첫 질문') }],
        });
        expect(r.stopReason).toBe('end');
        expect(r.toolCalls).toEqual([]);
        expect(r.text).toBe(
            '[E2E agent] "이어하기 첫 질문"에 대한 테스트 답변입니다.'
        );
    });
});
