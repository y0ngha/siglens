jest.mock('@/infrastructure/ai/anthropic', () => ({
    callAnthropicChat: jest.fn(),
}));

jest.mock('@/infrastructure/ai/openai', () => ({
    callOpenaiChat: jest.fn(),
}));

jest.mock('@/infrastructure/ai/gemini', () => ({
    callGeminiWithKeyFallback: jest.fn(),
}));

import { callAiProviderRouter } from '@/infrastructure/ai/router';
import { callAnthropicChat } from '@/infrastructure/ai/anthropic';
import { callOpenaiChat } from '@/infrastructure/ai/openai';
import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';

const mockCallAnthropicChat = callAnthropicChat as jest.MockedFunction<
    typeof callAnthropicChat
>;
const mockCallOpenaiChat = callOpenaiChat as jest.MockedFunction<
    typeof callOpenaiChat
>;
const mockCallGeminiWithKeyFallback =
    callGeminiWithKeyFallback as jest.MockedFunction<
        typeof callGeminiWithKeyFallback
    >;

const BASE_OPTIONS = {
    primaryApiKey: 'pk',
    fallbackApiKey: 'fk',
    contents: 'Hello',
} as const;

describe('callAiProviderRouter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCallAnthropicChat.mockResolvedValue('anthropic response');
        mockCallOpenaiChat.mockResolvedValue('openai response');
        mockCallGeminiWithKeyFallback.mockResolvedValue('gemini response');
    });

    describe('Anthropic 모델 라우팅', () => {
        it('claude-haiku-3-5 모델은 callAnthropicChat에 위임하고 다른 어댑터는 호출하지 않는다', async () => {
            const options = { ...BASE_OPTIONS, model: 'claude-haiku-3-5' };

            const result = await callAiProviderRouter(options);

            expect(result).toBe('anthropic response');
            expect(mockCallAnthropicChat).toHaveBeenCalledTimes(1);
            expect(mockCallAnthropicChat).toHaveBeenCalledWith(options);
            expect(mockCallOpenaiChat).not.toHaveBeenCalled();
            expect(mockCallGeminiWithKeyFallback).not.toHaveBeenCalled();
        });
    });

    describe('Google 모델 라우팅', () => {
        it('gemini-2.5-flash 모델은 callGeminiWithKeyFallback에 위임하고 다른 어댑터는 호출하지 않는다', async () => {
            const options = { ...BASE_OPTIONS, model: 'gemini-2.5-flash' };

            const result = await callAiProviderRouter(options);

            expect(result).toBe('gemini response');
            expect(mockCallGeminiWithKeyFallback).toHaveBeenCalledTimes(1);
            expect(mockCallGeminiWithKeyFallback).toHaveBeenCalledWith(options);
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
            expect(mockCallOpenaiChat).toHaveBeenCalledWith(options);
            expect(mockCallAnthropicChat).not.toHaveBeenCalled();
            expect(mockCallGeminiWithKeyFallback).not.toHaveBeenCalled();
        });
    });
});
