const { mockCreate, MockOpenAI } = vi.hoisted(() => {
    const mockCreate = vi.fn();
    const MockOpenAI = vi.fn().mockImplementation(function () {
        return { chat: { completions: { create: mockCreate } } };
    });
    return { mockCreate, MockOpenAI };
});

vi.mock('openai', () => ({
    default: MockOpenAI,
}));

import { callDeepseekChat } from '@/entities/llm-provider/api/deepseek';

const FLASH_OPTIONS = {
    serverApiKey: 'server-key',
    userApiKey: undefined,
    model: 'deepseek-v4-flash', // apiModelId, non-thinking
    contents: 'Hello',
} as const;

const PRO_OPTIONS = {
    ...FLASH_OPTIONS,
    model: 'deepseek-v4-pro', // apiModelId, thinking
} as const;

function okResponse(content: string) {
    return { choices: [{ message: { content } }] };
}

describe('callDeepseekChat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('API 키 및 baseURL 라우팅', () => {
        it('serverApiKey와 DeepSeek baseURL로 클라이언트를 생성한다', async () => {
            mockCreate.mockResolvedValue(okResponse('Hi'));

            const result = await callDeepseekChat(FLASH_OPTIONS);

            expect(result).toBe('Hi');
            expect(MockOpenAI).toHaveBeenCalledWith({
                apiKey: 'server-key',
                baseURL: 'https://api.deepseek.com',
            });
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        it('userApiKey가 있어도 serverApiKey만 사용한다', async () => {
            mockCreate.mockResolvedValue(okResponse('Hi'));

            await callDeepseekChat({
                ...FLASH_OPTIONS,
                userApiKey: 'user-key',
            });

            expect(MockOpenAI).toHaveBeenCalledWith({
                apiKey: 'server-key',
                baseURL: 'https://api.deepseek.com',
            });
            expect(MockOpenAI).toHaveBeenCalledTimes(1);
        });

        it('호출이 실패하면 에러가 전파된다', async () => {
            mockCreate.mockRejectedValue(new Error('api error'));

            await expect(callDeepseekChat(FLASH_OPTIONS)).rejects.toThrow(
                'api error'
            );
        });
    });

    describe('chat.completions API 파라미터', () => {
        it('chat.completions.create를 messages와 함께 호출한다', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat(FLASH_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call.model).toBe('deepseek-v4-flash');
            expect(call.messages).toEqual([{ role: 'user', content: 'Hello' }]);
        });

        it('response_format을 강제하지 않는다 (챗봇은 자연 텍스트 반환)', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat(FLASH_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            // Chat must return conversational prose, not JSON — no response_format
            // (DeepSeek defaults to `text`), matching the openai/gemini chat adapters.
            expect(call.response_format).toBeUndefined();
        });

        it('max_tokens로 spec.maxOutputTokens를 전달한다', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat(FLASH_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call.max_tokens).toBe(393216);
        });

        it('systemInstruction을 system 메시지로 선두에 추가한다', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat({
                ...FLASH_OPTIONS,
                systemInstruction: 'Be concise',
            });

            const call = mockCreate.mock.calls[0][0];
            expect(call.messages[0]).toEqual({
                role: 'system',
                content: 'Be concise',
            });
            expect(call.messages[1]).toEqual({
                role: 'user',
                content: 'Hello',
            });
        });

        it('systemInstruction이 없으면 system 메시지를 추가하지 않는다', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat(FLASH_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call.messages).toHaveLength(1);
            expect(call.messages[0].role).not.toBe('system');
        });
    });

    describe('thinking 토글', () => {
        it('non-thinking 모델(flash)은 thinking:{type:"disabled"}를 전달한다', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat(FLASH_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call.thinking).toEqual({ type: 'disabled' });
        });

        it('thinking 모델(pro)은 thinking:{type:"enabled", reasoning_effort:"high"}를 전달한다', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat(PRO_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call.thinking).toEqual({
                type: 'enabled',
                reasoning_effort: 'high',
            });
        });
    });

    describe('temperature 적용 규칙', () => {
        it('non-thinking 모델(flash)은 spec.temperature를 전달한다', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat(FLASH_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call.temperature).toBe(0);
        });

        it('thinking 모델(pro)은 temperature를 전달하지 않는다', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat(PRO_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call).not.toHaveProperty('temperature');
        });
    });

    describe('모델 검증', () => {
        it('알 수 없는 model이면 에러를 던진다', async () => {
            await expect(
                callDeepseekChat({
                    ...FLASH_OPTIONS,
                    model: 'unknown-model-123',
                })
            ).rejects.toThrow('Unknown model: unknown-model-123');
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('DeepSeek가 아닌 provider의 apiModelId면 에러를 던진다', async () => {
            await expect(
                callDeepseekChat({
                    ...FLASH_OPTIONS,
                    model: 'gpt-5-mini',
                })
            ).rejects.toThrow('[deepseek] Non-DeepSeek model spec: gpt-5-mini');
            expect(mockCreate).not.toHaveBeenCalled();
        });
    });

    describe('다중 턴 입력', () => {
        it('배열 형태의 contents를 messages로 변환한다', async () => {
            mockCreate.mockResolvedValue(okResponse('ok'));

            await callDeepseekChat({
                ...FLASH_OPTIONS,
                contents: [
                    { role: 'user', text: 'Hello' },
                    { role: 'assistant', text: 'Hi' },
                    { role: 'user', text: 'How are you?' },
                ],
            });

            const call = mockCreate.mock.calls[0][0];
            expect(call.messages).toHaveLength(3);
            expect(call.messages[0]).toEqual({
                role: 'user',
                content: 'Hello',
            });
            expect(call.messages[1]).toEqual({
                role: 'assistant',
                content: 'Hi',
            });
        });
    });

    describe('응답 파싱', () => {
        it('content가 빈 문자열이면 경고 로그 후 그대로 반환한다', async () => {
            mockCreate.mockResolvedValue(okResponse(''));
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = await callDeepseekChat(FLASH_OPTIONS);

            expect(result).toBe('');
            expect(warnSpy).toHaveBeenCalledWith(
                '[deepseek] Provider returned empty string'
            );
            warnSpy.mockRestore();
        });

        it('content가 null이면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({
                choices: [{ message: { content: null } }],
            });

            await expect(callDeepseekChat(FLASH_OPTIONS)).rejects.toThrow(
                '[deepseek] Provider returned null/undefined response'
            );
        });

        it('content가 undefined이면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({
                choices: [{ message: { content: undefined } }],
            });

            await expect(callDeepseekChat(FLASH_OPTIONS)).rejects.toThrow(
                '[deepseek] Provider returned null/undefined response'
            );
        });
    });
});
