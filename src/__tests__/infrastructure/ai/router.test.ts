jest.mock('@/infrastructure/ai/anthropic', () => ({
    callAnthropicChat: jest.fn(),
}));

jest.mock('@/infrastructure/ai/openai', () => ({
    callOpenaiChat: jest.fn(),
}));

jest.mock('@/infrastructure/ai/gemini', () => ({
    callGeminiChat: jest.fn(),
}));

jest.mock('@y0ngha/siglens-core', () => {
    const actual = jest.requireActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        MODEL_SPECS: actual.MODEL_SPECS,
        getProviderForModel: jest
            .fn()
            .mockImplementation(actual.getProviderForModel),
    };
});

import { callAnthropicChat } from '@/infrastructure/ai/anthropic';
import { callGeminiChat } from '@/infrastructure/ai/gemini';
import { callOpenaiChat } from '@/infrastructure/ai/openai';
import { callAiProviderRouter } from '@/infrastructure/ai/router';
import type { LlmProvider } from '@y0ngha/siglens-core';
import { getProviderForModel } from '@y0ngha/siglens-core';

const mockCallAnthropicChat = callAnthropicChat as jest.MockedFunction<
    typeof callAnthropicChat
>;
const mockCallOpenaiChat = callOpenaiChat as jest.MockedFunction<
    typeof callOpenaiChat
>;
const mockCallGeminiWithKeyFallback =
    callGeminiChat as jest.MockedFunction<
        typeof callGeminiChat
    >;
const mockGetProviderForModel = getProviderForModel as jest.MockedFunction<
    typeof getProviderForModel
>;

const BASE_OPTIONS = {
    userApiKey: 'pk',
    serverApiKey: 'fk',
    contents: 'Hello',
} as const;

describe('callAiProviderRouter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCallAnthropicChat.mockResolvedValue('anthropic response');
        mockCallOpenaiChat.mockResolvedValue('openai response');
        mockCallGeminiWithKeyFallback.mockResolvedValue('gemini response');
        mockGetProviderForModel.mockImplementation(
            jest.requireActual<typeof import('@y0ngha/siglens-core')>(
                '@y0ngha/siglens-core'
            ).getProviderForModel
        );
    });

    describe('Anthropic 모델 라우팅', () => {
        it('claude-haiku-3-5 모델은 callAnthropicChat에 위임하고 다른 어댑터는 호출하지 않는다', async () => {
            const options = { ...BASE_OPTIONS, model: 'claude-haiku-3-5' };

            const result = await callAiProviderRouter(options);

            expect(result).toBe('anthropic response');
            expect(mockCallAnthropicChat).toHaveBeenCalledTimes(1);
            expect(mockCallAnthropicChat).toHaveBeenCalledWith({
                ...options,
                model: 'claude-haiku-3-5-20251001',
            });
            expect(mockCallOpenaiChat).not.toHaveBeenCalled();
            expect(mockCallGeminiWithKeyFallback).not.toHaveBeenCalled();
        });
    });

    describe('Google 모델 라우팅', () => {
        it('gemini-2.5-flash 모델은 callGeminiChat에 위임하고 다른 어댑터는 호출하지 않는다', async () => {
            const options = { ...BASE_OPTIONS, model: 'gemini-2.5-flash' };

            const result = await callAiProviderRouter(options);

            expect(result).toBe('gemini response');
            expect(mockCallGeminiWithKeyFallback).toHaveBeenCalledTimes(1);
            expect(mockCallGeminiWithKeyFallback).toHaveBeenCalledWith({
                ...options,
                model: 'gemini-2.5-flash',
            });
            expect(mockCallAnthropicChat).not.toHaveBeenCalled();
            expect(mockCallOpenaiChat).not.toHaveBeenCalled();
        });
    });

    describe('OpenAI 모델 라우팅', () => {
        it('gpt-5-mini 모델은 callOpenaiChat에 위임하고 다른 어댑터는 호출하지 않는다', async () => {
            const options = { ...BASE_OPTIONS, model: 'gpt-5-mini' };

            const result = await callAiProviderRouter(options);

            expect(result).toBe('openai response');
            expect(mockCallOpenaiChat).toHaveBeenCalledTimes(1);
            expect(mockCallOpenaiChat).toHaveBeenCalledWith({
                ...options,
                model: 'gpt-5-mini',
            });
            expect(mockCallAnthropicChat).not.toHaveBeenCalled();
            expect(mockCallGeminiWithKeyFallback).not.toHaveBeenCalled();
        });
    });

    describe('알 수 없는 provider 처리', () => {
        it('알 수 없는 provider이면 에러를 던진다', async () => {
            mockGetProviderForModel.mockReturnValueOnce(
                'unknown' as unknown as LlmProvider
            );

            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'gemini-2.5-flash',
                })
            ).rejects.toThrow('Unhandled AI provider');
        });
    });
});
