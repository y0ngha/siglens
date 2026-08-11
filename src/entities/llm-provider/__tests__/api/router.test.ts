import type { MockedFunction } from 'vitest';
vi.mock('@/entities/llm-provider/api/anthropic', () => ({
    callAnthropicChat: vi.fn(),
}));

vi.mock('@/entities/llm-provider/api/openai', () => ({
    callOpenaiChat: vi.fn(),
}));

vi.mock('@/entities/llm-provider/api/gemini', () => ({
    callGeminiChat: vi.fn(),
}));

vi.mock('@/entities/llm-provider/api/deepseek', () => ({
    callDeepseekChat: vi.fn(),
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
import { callDeepseekChat } from '@/entities/llm-provider/api/deepseek';
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
const mockCallDeepseekChat = callDeepseekChat as MockedFunction<
    typeof callDeepseekChat
>;
const mockGetProviderForModel = getProviderForModel as MockedFunction<
    typeof getProviderForModel
>;

const BASE_OPTIONS = {
    userApiKey: 'pk',
    serverApiKey: 'fk',
    contents: 'Hello',
} as const;

/**
 * Shape the router hands to an adapter: the `userApiKey`/`serverApiKey` pair is
 * collapsed into a single `apiKey` (BYOK key wins) and the internal model key is
 * translated to the provider's `apiModelId`.
 */
const expectedAdapterCall = (apiModelId: string) => ({
    contents: BASE_OPTIONS.contents,
    apiKey: BASE_OPTIONS.userApiKey,
    model: apiModelId,
});

describe('callAiProviderRouter', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mockCallAnthropicChat.mockResolvedValue('anthropic response');
        mockCallOpenaiChat.mockResolvedValue('openai response');
        mockCallGeminiWithKeyFallback.mockResolvedValue('gemini response');
        mockCallDeepseekChat.mockResolvedValue('deepseek response');
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
            expect(mockCallAnthropicChat).toHaveBeenCalledWith(
                expectedAdapterCall('claude-haiku-4-5-20251001')
            );
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
            expect(mockCallGeminiWithKeyFallback).toHaveBeenCalledWith(
                expectedAdapterCall('gemini-2.5-flash')
            );
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
            expect(mockCallOpenaiChat).toHaveBeenCalledWith(
                expectedAdapterCall('gpt-5-mini')
            );
            expect(mockCallAnthropicChat).not.toHaveBeenCalled();
            expect(mockCallGeminiWithKeyFallback).not.toHaveBeenCalled();
        });
    });

    describe('DeepSeek 모델 라우팅', () => {
        it('deepseek-v4-flash 모델은 callDeepseekChat에 위임하고 다른 어댑터는 호출하지 않는다', async () => {
            const options = { ...BASE_OPTIONS, model: 'deepseek-v4-flash' };

            const result = await callAiProviderRouter(options);

            expect(result).toBe('deepseek response');
            expect(mockCallDeepseekChat).toHaveBeenCalledTimes(1);
            expect(mockCallDeepseekChat).toHaveBeenCalledWith(
                expectedAdapterCall('deepseek-v4-flash')
            );
            expect(mockCallAnthropicChat).not.toHaveBeenCalled();
            expect(mockCallOpenaiChat).not.toHaveBeenCalled();
            expect(mockCallGeminiWithKeyFallback).not.toHaveBeenCalled();
        });
    });

    describe('API 키 라우팅', () => {
        it('BYOK 키가 있으면 서버 키가 아니라 사용자 키를 어댑터에 전달한다', async () => {
            await callAiProviderRouter({
                userApiKey: 'user-key',
                serverApiKey: 'server-key',
                contents: 'Hello',
                model: 'claude-haiku-4-5',
            });

            expect(mockCallAnthropicChat).toHaveBeenCalledWith(
                expect.objectContaining({ apiKey: 'user-key' })
            );
        });

        it('BYOK 키가 없으면 서버 키를 어댑터에 전달한다', async () => {
            await callAiProviderRouter({
                userApiKey: undefined,
                serverApiKey: 'server-key',
                contents: 'Hello',
                model: 'claude-haiku-4-5',
            });

            expect(mockCallAnthropicChat).toHaveBeenCalledWith(
                expect.objectContaining({ apiKey: 'server-key' })
            );
        });

        /**
         * 두 키가 모두 없을 때 어댑터를 호출하면 SDK가 `ANTHROPIC_API_KEY` 등
         * 환경변수로 폴백해 BYOK 요청이 조용히 서버 키로 과금된다. 라우터에서
         * 던져 그 폴백에 도달하지 못하게 한다.
         */
        it('키가 하나도 없으면 어댑터를 호출하지 않고 에러를 던진다', async () => {
            await expect(
                callAiProviderRouter({
                    userApiKey: undefined,
                    serverApiKey: undefined,
                    contents: 'Hello',
                    model: 'claude-haiku-4-5',
                })
            ).rejects.toThrow(
                '[router] No API key supplied for model: claude-haiku-4-5'
            );

            expect(mockCallAnthropicChat).not.toHaveBeenCalled();
            expect(mockCallOpenaiChat).not.toHaveBeenCalled();
            expect(mockCallGeminiWithKeyFallback).not.toHaveBeenCalled();
            expect(mockCallDeepseekChat).not.toHaveBeenCalled();
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
            expect(mockCallDeepseekChat).not.toHaveBeenCalled();
        });

        // `MODEL_SPECS`는 일반 객체 리터럴이라 `'constructor' in MODEL_SPECS`는
        // `Object.prototype`을 통해 상속된 값 때문에 `true`가 된다. `isActiveModelId`가
        // `in` 대신 `Object.hasOwn`을 쓰는 이유가 바로 이것 — own-property가 아닌
        // 프로토타입 체인의 키는 여전히 거부되어야 한다.
        it.each(['constructor', 'toString', 'valueOf', '__proto__'])(
            "프로토타입 체인 키 '%s'는 own-property가 아니므로 [router] Unknown model 에러를 던진다",
            async prototypeKey => {
                await expect(
                    callAiProviderRouter({
                        ...BASE_OPTIONS,
                        model: prototypeKey,
                    })
                ).rejects.toThrow(`[router] Unknown model: ${prototypeKey}`);

                expect(mockGetProviderForModel).not.toHaveBeenCalled();
                expect(mockCallAnthropicChat).not.toHaveBeenCalled();
                expect(mockCallOpenaiChat).not.toHaveBeenCalled();
                expect(mockCallGeminiWithKeyFallback).not.toHaveBeenCalled();
                expect(mockCallDeepseekChat).not.toHaveBeenCalled();
            }
        );
    });
});
