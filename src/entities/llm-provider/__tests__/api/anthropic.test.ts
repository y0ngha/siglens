const { mockFinalMessage, mockStream, MockAnthropic } = vi.hoisted(() => {
    const mockFinalMessage = vi.fn();
    const mockStream = vi
        .fn()
        .mockReturnValue({ finalMessage: mockFinalMessage });
    const MockAnthropic = vi.fn().mockImplementation(function () {
        return { messages: { stream: mockStream } };
    });
    return { mockFinalMessage, mockStream, MockAnthropic };
});

vi.mock('@anthropic-ai/sdk', () => ({
    default: MockAnthropic,
}));

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        MODEL_SPECS: { ...actual.MODEL_SPECS },
    };
});

import {
    callAnthropicChat,
    withHistoryCacheBreakpoint,
} from '@/entities/llm-provider/api/anthropic';
import { ProviderCallTimeoutError } from '@/entities/llm-provider/api/callDeadline';
import type Anthropic from '@anthropic-ai/sdk';

const BASE_OPTIONS = {
    apiKey: 'server-key',
    model: 'claude-haiku-5-5', // haiku apiModelId
    contents: 'Hello',
} as const;

const SONNET_OPTIONS = {
    ...BASE_OPTIONS,
    model: 'claude-sonnet-5-5', // sonnet apiModelId — member 등급(기본 OFF)
} as const;

/** byok 등급 — `reasoning.default: 'on'`이라 adaptive 경로를 탄다. */
const OPUS_OPTIONS = {
    ...BASE_OPTIONS,
    model: 'claude-opus-5',
} as const;

describe('callAnthropicChat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStream.mockReturnValue({ finalMessage: mockFinalMessage });
    });

    describe('API 키 라우팅', () => {
        it('apiKey로 Anthropic을 호출한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'Hello' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat(BASE_OPTIONS);

            expect(result).toBe('Hello');
            expect(MockAnthropic).toHaveBeenCalledWith({
                apiKey: 'server-key',
            });
            expect(mockStream).toHaveBeenCalledTimes(1);
        });

        it('BYOK 키를 받으면 그 키로 호출한다 (환경변수 폴백 금지)', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'Hello' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat({
                ...BASE_OPTIONS,
                apiKey: 'user-key',
            });

            expect(MockAnthropic).toHaveBeenCalledWith({
                apiKey: 'user-key',
            });
            expect(MockAnthropic).toHaveBeenCalledTimes(1);
        });

        it('limits를 받으면 출력 상한·timeout·재시도를 그 값으로 건다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'Hello' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat({
                ...BASE_OPTIONS,
                limits: {
                    maxOutputTokens: 1500,
                    timeoutMs: 30_000,
                    maxRetries: 0,
                },
            });

            expect(MockAnthropic).toHaveBeenCalledWith({
                apiKey: 'server-key',
                timeout: 30_000,
                maxRetries: 0,
            });
            expect(mockStream.mock.calls[0][0].max_tokens).toBe(1500);
        });

        it('stream() 생성이 던져도 타이머를 정리해 마감 뒤에 abort되지 않는다', async () => {
            vi.useFakeTimers();
            try {
                let signal: AbortSignal | undefined;
                mockStream.mockImplementationOnce(
                    (_body: unknown, options?: { signal?: AbortSignal }) => {
                        signal = options?.signal;
                        throw new Error('connect failed');
                    }
                );

                await expect(
                    callAnthropicChat({
                        ...BASE_OPTIONS,
                        limits: { timeoutMs: 30_000 },
                    })
                ).rejects.toThrow('connect failed');
                await vi.advanceTimersByTimeAsync(60_000);

                expect(signal?.aborted).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });

        it('스트림이 마감을 넘기면 연결을 끊고 timeout 오류를 던진다', async () => {
            vi.useFakeTimers();
            try {
                mockFinalMessage.mockReturnValue(new Promise(() => {}));

                const pending = callAnthropicChat({
                    ...BASE_OPTIONS,
                    limits: { timeoutMs: 30_000, maxRetries: 0 },
                });
                const assertion = expect(pending).rejects.toBeInstanceOf(
                    ProviderCallTimeoutError
                );
                await vi.advanceTimersByTimeAsync(30_000);
                await assertion;

                const requestOptions = mockStream.mock.calls[0][1] as {
                    signal: AbortSignal;
                };
                expect(requestOptions.signal.aborted).toBe(true);
            } finally {
                vi.useRealTimers();
            }
        });

        it('응답 usage로 [Usage] 라인을 남긴다', async () => {
            const info = vi.spyOn(console, 'info').mockImplementation(() => {});
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'Hello' }],
                stop_reason: 'end_turn',
                usage: {
                    input_tokens: 120,
                    cache_read_input_tokens: 40,
                    cache_creation_input_tokens: 10,
                    output_tokens: 33,
                },
            });

            await callAnthropicChat(BASE_OPTIONS);

            const payload: unknown = JSON.parse(
                (info.mock.calls[0]?.[0] as string) ?? '{}'
            );
            expect(payload).toMatchObject({
                jobId: 'chat',
                model: 'claude-haiku-5-5',
                promptTokens: 120,
                cachedTokens: 40,
                cacheWriteTokens: 10,
                outputTokens: 33,
            });
            info.mockRestore();
        });

        it('호출이 실패하면 에러가 전파된다', async () => {
            mockFinalMessage.mockRejectedValue(new Error('api error'));

            await expect(callAnthropicChat(BASE_OPTIONS)).rejects.toThrow(
                'api error'
            );
        });
    });

    describe('haiku 5.5 — thinking disabled 모드', () => {
        it('thinking disabled로 호출하고 temperature는 보내지 않는다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat(BASE_OPTIONS);

            const call = mockStream.mock.calls[0][0];
            expect(call.thinking).toEqual({ type: 'disabled' });
            expect(call).not.toHaveProperty('output_config');
            // 5.5 세대는 temperature를 400으로 거부한다.
            expect(call).not.toHaveProperty('temperature');
        });
    });

    describe('5.5 세대 공통 계약 — temperature·forced tool_choice 금지', () => {
        // 세 모델 모두 temperature를 400으로 거부하고, sonnet·opus 5.5는 forced
        // tool_choice도 거부한다(2026-10-15 실측). core 스펙이 budget 경로로 바뀌는 등
        // 어느 한 모델이 temperature 분기로 새면 여기서 걸린다.
        it.each([
            'claude-haiku-5-5',
            'claude-sonnet-5-5',
            'claude-opus-5-5',
        ] as const)(
            '%s는 temperature·tool_choice를 보내지 않는다',
            async model => {
                mockFinalMessage.mockResolvedValue({
                    content: [{ type: 'text', text: 'ok' }],
                    stop_reason: 'end_turn',
                });

                await callAnthropicChat({ ...BASE_OPTIONS, model });

                const call = mockStream.mock.lastCall?.[0];
                expect(call).toBeDefined();
                expect(call).not.toHaveProperty('temperature');
                expect(call).not.toHaveProperty('tool_choice');
            }
        );
    });

    describe('Sonnet/Opus — adaptive thinking 모드', () => {
        it('member 등급 모델은 스펙 기본 상태(OFF)로 호출한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'deep answer' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat(SONNET_OPTIONS);

            expect(result).toBe('deep answer');
            const call = mockStream.mock.calls[0][0];
            // 챗은 추론 토글이 없어 스펙의 `reasoning.default`를 따른다.
            // claude-sonnet-5-5는 member 등급이라 기본 OFF이고, `disabled`를 400으로
            // 거부하므로 OFF는 `between_tools`다(display·effort 없이).
            expect(call.thinking).toEqual({ type: 'between_tools' });
            // between_tools는 output_config를 함께 보내지 않는다.
            expect(call).not.toHaveProperty('output_config');
            expect(call).not.toHaveProperty('temperature');
        });

        it('byok 등급 모델은 adaptive thinking과 effort로 호출한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'deep answer' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat(OPUS_OPTIONS);

            expect(result).toBe('deep answer');
            const call = mockStream.mock.calls[0][0];
            expect(call.thinking).toEqual({
                type: 'adaptive',
                display: 'omitted',
            });
            expect(call.output_config).toEqual({ effort: 'high' });
            expect(call).not.toHaveProperty('temperature');
        });

        it('opus-5-5는 adaptive thinking(effort high)으로 호출하고 temperature·between_tools는 보내지 않는다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat({
                ...BASE_OPTIONS,
                model: 'claude-opus-5-5',
            });

            const call = mockStream.mock.calls[0][0];
            expect(call.thinking).toEqual({
                type: 'adaptive',
                display: 'omitted',
            });
            expect(call.output_config).toEqual({ effort: 'high' });
            expect(call).not.toHaveProperty('temperature');
        });

        it('thinking + text 혼합 응답에서 text 블록을 추출한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [
                    {
                        type: 'thinking',
                        thinking: 'reasoning...',
                        signature: 'sig',
                    },
                    { type: 'text', text: 'final answer' },
                ],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat(SONNET_OPTIONS);

            expect(result).toBe('final answer');
        });
    });

    describe('응답 파싱', () => {
        it('content 배열이 비어있으면 에러를 던진다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [],
                stop_reason: 'end_turn',
            });

            await expect(callAnthropicChat(BASE_OPTIONS)).rejects.toThrow(
                'Anthropic returned no text content'
            );
        });

        it('content에 text 타입이 없으면 에러를 던진다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [
                    { type: 'tool_use', id: 'call_1', name: 'tool', input: {} },
                ],
                stop_reason: 'tool_use',
            });

            await expect(callAnthropicChat(BASE_OPTIONS)).rejects.toThrow(
                'Anthropic returned no text content'
            );
        });
    });

    describe('모델 검증', () => {
        it('알 수 없는 model 이면 에러를 던진다', async () => {
            await expect(
                callAnthropicChat({
                    ...BASE_OPTIONS,
                    model: 'unknown-model-xyz',
                })
            ).rejects.toThrow('Unknown model: unknown-model-xyz');
            expect(mockStream).not.toHaveBeenCalled();
        });
    });

    describe('systemInstruction', () => {
        it('systemInstruction이 있으면 ephemeral 캐시 브레이크포인트가 붙은 text 블록 배열로 전달한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat({
                ...BASE_OPTIONS,
                systemInstruction: 'Be concise',
            });

            const call = mockStream.mock.calls[0][0];
            expect(call.system).toEqual([
                {
                    type: 'text',
                    text: 'Be concise',
                    cache_control: { type: 'ephemeral' },
                },
            ]);
        });

        it('systemInstruction이 없으면 system 파라미터를 포함하지 않는다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat(BASE_OPTIONS);

            const call = mockStream.mock.calls[0][0];
            expect(call).not.toHaveProperty('system');
        });
    });

    describe('prompt caching — history 브레이크포인트', () => {
        it('멀티턴(>=2)이면 마지막 직전 history 메시지에 ephemeral 캐시 브레이크포인트를 붙이고 마지막 turn은 plain string으로 둔다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat({
                ...BASE_OPTIONS,
                contents: [
                    { role: 'user', text: 'first' },
                    { role: 'assistant', text: 'reply' },
                    { role: 'user', text: 'second' },
                ],
            });

            const call = mockStream.mock.calls[0][0];
            const msgs = call.messages;
            expect(msgs).toHaveLength(3);

            expect(msgs[0]).toEqual({ role: 'user', content: 'first' });

            expect(msgs[1]).toEqual({
                role: 'assistant',
                content: [
                    {
                        type: 'text',
                        text: 'reply',
                        cache_control: { type: 'ephemeral' },
                    },
                ],
            });

            expect(msgs[2]).toEqual({ role: 'user', content: 'second' });
        });

        it('정확히 2턴이면 첫 메시지(breakpointIdx === 0)에 캐시 브레이크포인트를 붙이고 마지막 turn은 plain string으로 둔다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat({
                ...BASE_OPTIONS,
                contents: [
                    { role: 'user', text: 'first' },
                    { role: 'assistant', text: 'reply' },
                ],
            });

            const call = mockStream.mock.calls[0][0];
            const msgs = call.messages;
            expect(msgs).toHaveLength(2);

            expect(msgs[0]).toEqual({
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'first',
                        cache_control: { type: 'ephemeral' },
                    },
                ],
            });

            expect(msgs[1]).toEqual({ role: 'assistant', content: 'reply' });
        });

        it('단일 메시지면 history 브레이크포인트를 추가하지 않고 system 브레이크포인트만 적용한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat({
                ...BASE_OPTIONS,
                contents: [{ role: 'user', text: 'only message' }],
                systemInstruction: 'Be concise',
            });

            const call = mockStream.mock.calls[0][0];
            expect(call.messages).toHaveLength(1);
            expect(call.messages[0]).toEqual({
                role: 'user',
                content: 'only message',
            });
            expect(call.system).toEqual([
                {
                    type: 'text',
                    text: 'Be concise',
                    cache_control: { type: 'ephemeral' },
                },
            ]);
        });

        it('string contents(단일 user 메시지)면 history 브레이크포인트가 없다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat(BASE_OPTIONS);

            const call = mockStream.mock.calls[0][0];
            expect(call.messages).toEqual([{ role: 'user', content: 'Hello' }]);
        });

        it('반환값은 캐싱 변경과 무관하게 동일하다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'final answer' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat({
                ...BASE_OPTIONS,
                contents: [
                    { role: 'user', text: 'first' },
                    { role: 'assistant', text: 'reply' },
                    { role: 'user', text: 'second' },
                ],
            });

            expect(result).toBe('final answer');
        });
    });

    describe('effort 검증', () => {
        it('유효한 effort(medium)는 통과한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await expect(callAnthropicChat(SONNET_OPTIONS)).resolves.toBe('ok');
        });
    });
});

describe('withHistoryCacheBreakpoint', () => {
    it('메시지가 2개 미만이면 원본을 그대로 반환한다 (히스토리 없음)', () => {
        const messages: Anthropic.MessageParam[] = [
            { role: 'user', content: 'only turn' },
        ];

        const result = withHistoryCacheBreakpoint(messages);

        expect(result).toBe(messages);
        expect(result).toEqual([{ role: 'user', content: 'only turn' }]);
    });

    it('second-to-last 메시지가 이미 block content면 그대로 반환한다 (중복 래핑 없음)', () => {
        const messages: Anthropic.MessageParam[] = [
            {
                role: 'user',
                content: [{ type: 'text', text: 'already block' }],
            },
            { role: 'assistant', content: 'reply' },
        ];

        const result = withHistoryCacheBreakpoint(messages);

        expect(result).toBe(messages);
        expect(result).toEqual([
            {
                role: 'user',
                content: [{ type: 'text', text: 'already block' }],
            },
            { role: 'assistant', content: 'reply' },
        ]);
    });
});
