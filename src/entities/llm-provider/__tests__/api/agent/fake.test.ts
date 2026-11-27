import {
    buildAgentTurnContext,
    composeAgentUserMessage,
} from '@y0ngha/siglens-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    it('이미지 턴은 대문자 티커가 있어도 도구 없이 장수를 확인한 답으로 끝난다', async () => {
        const onEvent = vi.fn();
        const r = await fakeAgentProvider({
            ...base,
            onEvent,
            messages: [
                {
                    role: 'user',
                    content: 'NVDA 어때?',
                    images: [{ mediaType: 'image/webp', data: 'AAAA' }],
                },
            ],
        });
        expect(r.toolCalls).toEqual([]);
        expect(r.text).toBe('[E2E agent] 이미지 1장을 확인했습니다.');
        expect(onEvent).toHaveBeenCalledWith({
            type: 'text',
            delta: r.text,
        });
    });

    it('"비교 차트"는 show_chart(compare)를 부르고, 도구 결과가 오면 고정 답으로 끝난다', async () => {
        const tools = [
            ...base.tools,
            ...base.tools.slice(0, 1).map(t => ({ ...t, name: 'show_chart' })),
        ];
        const asked = await fakeAgentProvider({
            ...base,
            tools,
            onEvent: vi.fn(),
            messages: [{ role: 'user', content: '애플 마소 비교 차트 그려줘' }],
        });
        expect(asked.toolCalls).toEqual([
            {
                id: 'fake_1',
                name: 'show_chart',
                args: { kind: 'compare', symbols: ['AAPL', 'MSFT'] },
            },
        ]);
        const answered = await fakeAgentProvider({
            ...base,
            tools,
            onEvent: vi.fn(),
            messages: [
                { role: 'user', content: '애플 마소 비교 차트 그려줘' },
                { role: 'assistant', content: '', toolCalls: asked.toolCalls },
                {
                    role: 'tool',
                    content: '{"rendered":true}',
                    toolCallId: 'fake_1',
                    toolName: 'show_chart',
                },
            ],
        });
        expect(answered.toolCalls).toEqual([]);
        expect(answered.text).toContain('[E2E agent]');
    });

    it('show_chart가 가용 목록에 없으면 "비교 차트"도 예전 경로로 간다', async () => {
        const r = await fakeAgentProvider({
            ...base,
            onEvent: vi.fn(),
            messages: [{ role: 'user', content: 'QQQ 비교 차트' }],
        });
        expect(r.toolCalls[0]?.name).toBe('get_quote');
    });

    it('"차트"를 물어도 get_bars_indicators가 없으면 get_quote로 답한다', async () => {
        const r = await fakeAgentProvider({
            ...base,
            onEvent: vi.fn(),
            messages: [{ role: 'user', content: 'QQQ 차트 보여줘' }],
        });
        expect(r.toolCalls).toEqual([
            { id: 'fake_1', name: 'get_quote', args: { symbols: ['QQQ'] } },
        ]);
    });

    it('질문에 "차트"가 있으면 get_bars_indicators 1회', async () => {
        const r = await fakeAgentProvider({
            ...base,
            tools: [
                ...base.tools,
                { ...base.tools[0]!, name: 'get_bars_indicators' },
            ],
            onEvent: vi.fn(),
            messages: [{ role: 'user', content: 'QQQ 차트 보여줘' }],
        });
        expect(r.toolCalls).toEqual([
            {
                id: 'fake_1',
                name: 'get_bars_indicators',
                args: { symbol: 'QQQ', timeframe: '1Day', bars: 30 },
            },
        ]);
    });

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

    describe('부하 시험 이음매', () => {
        const withTools = {
            ...base,
            tools: [
                ...base.tools,
                { ...base.tools[0], name: 'run_fresh_analysis' },
            ],
        };

        it('[e2e-fresh]는 첫 단계에서 run_fresh_analysis(AAPL, technical)를 부른다', async () => {
            const r = await fakeAgentProvider({
                ...withTools,
                onEvent: vi.fn(),
                messages: [{ role: 'user', content: '[e2e-fresh] 분석해줘' }],
            });
            expect(r.toolCalls).toEqual([
                {
                    id: 'fake_1',
                    name: 'run_fresh_analysis',
                    args: { symbol: 'AAPL', kind: 'technical' },
                },
            ]);
            expect(r.stopReason).toBe('tool_use');
        });

        it('도구 결과가 온 뒤에는 고정 답으로 끝난다', async () => {
            const r = await fakeAgentProvider({
                ...withTools,
                onEvent: vi.fn(),
                messages: [
                    { role: 'user', content: '[e2e-fresh] 분석해줘' },
                    { role: 'tool', content: '{}', toolCallId: 'fake_1' },
                ],
            });
            expect(r.toolCalls).toEqual([]);
            expect(r.text).toContain('[e2e-fresh] 분석해줘');
        });

        it('run_fresh_analysis가 가용 목록에 없으면 이음매를 쓰지 않는다', async () => {
            const r = await fakeAgentProvider({
                ...base,
                onEvent: vi.fn(),
                messages: [{ role: 'user', content: '[e2e-fresh] 분석해줘' }],
            });
            expect(r.toolCalls).toEqual([]);
        });

        describe('[e2e-hold:<ms>]', () => {
            beforeEach(() => vi.useFakeTimers());
            afterEach(() => vi.useRealTimers());

            const ask = (content: string, signal = base.signal) =>
                fakeAgentProvider({
                    ...base,
                    signal,
                    onEvent: vi.fn(),
                    messages: [{ role: 'user', content }],
                });

            it('최종 답을 지정한 시간만큼 미룬다', async () => {
                const done = vi.fn();
                void ask('[e2e-hold:10000]').then(done);
                await vi.advanceTimersByTimeAsync(9_999);
                expect(done).not.toHaveBeenCalled();
                await vi.advanceTimersByTimeAsync(1);
                expect(done).toHaveBeenCalledTimes(1);
            });

            it('180초를 넘는 값은 180초로 자른다', async () => {
                const done = vi.fn();
                void ask('[e2e-hold:99999999]').then(done);
                await vi.advanceTimersByTimeAsync(179_999);
                expect(done).not.toHaveBeenCalled();
                await vi.advanceTimersByTimeAsync(1);
                expect(done).toHaveBeenCalledTimes(1);
            });

            it('signal이 중단되면 곧바로 풀린다', async () => {
                const abort = new AbortController();
                const done = vi.fn();
                void ask('[e2e-hold:60000]', abort.signal).then(done);
                await vi.advanceTimersByTimeAsync(10);
                expect(done).not.toHaveBeenCalled();
                abort.abort();
                await vi.advanceTimersByTimeAsync(0);
                expect(done).toHaveBeenCalledTimes(1);
            });

            it('토큰이 없으면 미루지 않는다', async () => {
                const r = await ask('그냥 질문');
                expect(r.text).toContain('그냥 질문');
            });
        });
    });
});
