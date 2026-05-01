import OpenAI from 'openai';
import { callChatGPT } from '../chatgpt';
import type { ChatGPTModel } from '../models';

const mockCreate = jest.fn();

jest.mock('openai', () => ({
    __esModule: true,
    default: jest.fn(() => ({
        chat: {
            completions: {
                create: mockCreate,
            },
        },
    })),
}));

// jest.mocked는 import된 default가 mock 함수임을 type 시스템에 알려준다.
const mockedOpenAI = jest.mocked(OpenAI);

const MODEL: ChatGPTModel = 'gpt-5.5';

describe('callChatGPT', () => {
    beforeEach(() => {
        mockCreate.mockClear();
    });

    it('returns text from stop finish_reason', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    finish_reason: 'stop',
                    message: { content: 'analysis result' },
                },
            ],
        });

        const result = await callChatGPT('prompt', {
            model: MODEL,
            apiKey: 'key',
        });

        expect(result).toBe('analysis result');
    });

    it('passes JSON object response_format and OpenAI-correct params', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    finish_reason: 'stop',
                    message: { content: '{"a":1}' },
                },
            ],
        });

        await callChatGPT('prompt', { model: MODEL, apiKey: 'key' });

        const call = mockCreate.mock.calls[0][0];
        expect(call.model).toBe(MODEL);
        expect(call.temperature).toBe(0);
        expect(call.top_p).toBe(0.95);
        expect(call.response_format).toEqual({ type: 'json_object' });
        expect(call.max_completion_tokens).toBe(128_000); // gpt-5.5 max
        expect(call.messages).toEqual([
            { role: 'system', content: expect.any(String) },
            { role: 'user', content: 'prompt' },
        ]);
    });

    it('throws non-retryable error when finish_reason is length (no mitigation possible)', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    finish_reason: 'length',
                    message: { content: '' },
                },
            ],
        });

        const promise = callChatGPT('prompt', {
            model: MODEL,
            apiKey: 'key',
        });

        await expect(promise).rejects.toThrow(/output token limit/);
        await expect(promise).rejects.not.toMatchObject({ retryable: true });
    });

    it('throws non-retryable error when finish_reason is content_filter', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    finish_reason: 'content_filter',
                    message: { content: '' },
                },
            ],
        });

        const promise = callChatGPT('prompt', {
            model: MODEL,
            apiKey: 'key',
        });

        await expect(promise).rejects.toThrow(/content filter/);
        await expect(promise).rejects.not.toMatchObject({ retryable: true });
    });

    it('throws retryable error when finish_reason is unknown (tool_calls)', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    finish_reason: 'tool_calls',
                    message: { content: '' },
                },
            ],
        });

        await expect(
            callChatGPT('prompt', { model: MODEL, apiKey: 'key' })
        ).rejects.toMatchObject({ retryable: true });
    });

    it('throws retryable error when stop returns empty content', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    finish_reason: 'stop',
                    message: { content: '' },
                },
            ],
        });

        await expect(
            callChatGPT('prompt', { model: MODEL, apiKey: 'key' })
        ).rejects.toMatchObject({ retryable: true });
    });

    it('uses model-specific max_completion_tokens', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    finish_reason: 'stop',
                    message: { content: 'ok' },
                },
            ],
        });

        await callChatGPT('prompt', {
            model: 'gpt-5-mini',
            apiKey: 'key',
        });

        // gpt-5-mini max output = 128000
        expect(mockCreate.mock.calls[0][0].max_completion_tokens).toBe(128_000);
    });

    it('propagates abort from external signal to underlying SDK call', async () => {
        let receivedSignal: AbortSignal | undefined;
        mockCreate.mockImplementationOnce(async (_params, options) => {
            receivedSignal = options?.signal;
            externalController.abort();
            return {
                choices: [
                    {
                        finish_reason: 'stop',
                        message: { content: 'ok' },
                    },
                ],
            };
        });

        const externalController = new AbortController();
        await callChatGPT('prompt', {
            model: MODEL,
            apiKey: 'key',
            signal: externalController.signal,
        });

        expect(receivedSignal).toBeDefined();
        expect(receivedSignal!.aborted).toBe(true);
    });

    it('reuses cached client across calls with the same apiKey', async () => {
        mockedOpenAI.mockClear();
        mockCreate.mockResolvedValue({
            choices: [
                {
                    finish_reason: 'stop',
                    message: { content: 'ok' },
                },
            ],
        });

        await callChatGPT('prompt1', {
            model: MODEL,
            apiKey: 'shared-key',
        });
        await callChatGPT('prompt2', {
            model: MODEL,
            apiKey: 'shared-key',
        });

        expect(mockedOpenAI.mock.calls.length).toBeLessThanOrEqual(1);
    });
});
