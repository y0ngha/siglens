import { vi, type MockedFunction } from 'vitest';
vi.mock('@/entities/llm-provider/api/anthropic', () => ({
    callAnthropicChat: vi.fn(),
}));

vi.mock('@/entities/llm-provider/api/openai', () => ({
    callOpenaiChat: vi.fn(),
}));

vi.mock('@/entities/llm-provider/api/gemini', () => ({
    callGeminiChat: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        MODEL_SPECS: actual.MODEL_SPECS,
        getProviderForModel: vi
            .fn()
            .mockImplementation(actual.getProviderForModel),
    };
});

import { callAnthropicChat } from '@/entities/llm-provider/api/anthropic';
import { callGeminiChat } from '@/entities/llm-provider/api/gemini';
import { callOpenaiChat } from '@/entities/llm-provider/api/openai';
import { callAiProviderRouter } from '@/entities/llm-provider/api/router';
import type { LlmProvider } from '@y0ngha/siglens-core';
import { getProviderForModel } from '@y0ngha/siglens-core';

const mockCallAnthropicChat = callAnthropicChat as MockedFunction<
    typeof callAnthropicChat
>;
const mockCallOpenaiChat = callOpenaiChat as MockedFunction<
    typeof callOpenaiChat
>;
const mockCallGeminiWithKeyFallback = callGeminiChat as MockedFunction<
    typeof callGeminiChat
>;
const mockGetProviderForModel = getProviderForModel as MockedFunction<
    typeof getProviderForModel
>;

const BASE_OPTIONS = {
    userApiKey: 'pk',
    serverApiKey: 'fk',
    contents: 'Hello',
} as const;

describe('callAiProviderRouter', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mockCallAnthropicChat.mockResolvedValue('anthropic response');
        mockCallOpenaiChat.mockResolvedValue('openai response');
        mockCallGeminiWithKeyFallback.mockResolvedValue('gemini response');
        const actual = await vi.importActual<
            typeof import('@y0ngha/siglens-core')
        >('@y0ngha/siglens-core');
        mockGetProviderForModel.mockImplementation(actual.getProviderForModel);
    });

    describe('Anthropic 모델 라우팅', () => {
        it('claude-haiku-4-5 모델은 callAnthropicChat에 위임하고 다른 어댑터는 호출하지 않는다', async () => {
            const options = { ...BASE_OPTIONS, model: 'claude-haiku-4-5' };

            const result = await callAiProviderRouter(options);

            expect(result).toBe('anthropic response');
            expect(mockCallAnthropicChat).toHaveBeenCalledTimes(1);
            expect(mockCallAnthropicChat).toHaveBeenCalledWith({
                ...options,
                model: 'claude-haiku-4-5-20251001',
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

    describe('알 수 없는 모델 처리 (isActiveModelId 가드)', () => {
        it('MODEL_SPECS에 없는 모델이면 [router] Unknown model 에러를 던진다', async () => {
            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'totally-fake-model',
                })
            ).rejects.toThrow('[router] Unknown model: totally-fake-model');

            // 가드가 getProviderForModel 호출 전에 throw하므로 provider 조회 자체가 시도되지 않아야 한다
            expect(mockGetProviderForModel).not.toHaveBeenCalled();
            expect(mockCallAnthropicChat).not.toHaveBeenCalled();
            expect(mockCallOpenaiChat).not.toHaveBeenCalled();
            expect(mockCallGeminiWithKeyFallback).not.toHaveBeenCalled();
        });
    });
});
