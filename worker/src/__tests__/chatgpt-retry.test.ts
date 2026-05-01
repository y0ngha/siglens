import { callChatGPT } from '../chatgpt';
import { callChatGPTWithRetry } from '../chatgpt-retry';
import type { ChatGPTModel } from '../models';
import { AI_RETRY_DELAY_MS, withRetry } from '../retry';

jest.mock('../chatgpt', () => ({
    callChatGPT: jest.fn(),
}));

jest.mock('../retry', () => ({
    withRetry: jest.fn(async <T>(fn: () => Promise<T>): Promise<T> => fn()),
    AI_RETRY_MAX_ATTEMPTS: 5,
    AI_RETRY_DELAY_MS: 5000,
}));

const mockCallChatGPT = callChatGPT as jest.MockedFunction<typeof callChatGPT>;
const mockWithRetry = withRetry as jest.MockedFunction<typeof withRetry>;

const MODEL: ChatGPTModel = 'gpt-5-mini';

describe('callChatGPTWithRetry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('delegates to withRetry with the configured retry policy', async () => {
        mockCallChatGPT.mockResolvedValueOnce('result');

        await callChatGPTWithRetry('prompt', MODEL, 'key', {
            maxAttempts: 7,
            abortIfCumulativeDelayReachesMs: 15000,
        });

        expect(mockWithRetry).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                maxAttempts: 7,
                baseDelayMs: AI_RETRY_DELAY_MS,
                abortIfCumulativeDelayReachesMs: 15000,
            })
        );
    });

    it('forwards model, apiKey, and signal to callChatGPT', async () => {
        mockCallChatGPT.mockResolvedValueOnce('result');

        const signal = new AbortController().signal;
        await callChatGPTWithRetry('prompt', MODEL, 'paid-key', { signal });

        expect(mockCallChatGPT).toHaveBeenCalledWith('prompt', {
            model: MODEL,
            apiKey: 'paid-key',
            signal,
        });
    });

    it('returns result from callChatGPT through withRetry', async () => {
        mockCallChatGPT.mockResolvedValueOnce('chat-result');

        const result = await callChatGPTWithRetry('prompt', MODEL, 'key');

        expect(result).toBe('chat-result');
    });

    it('propagates errors from callChatGPT', async () => {
        const error = new Error('upstream failure');
        mockCallChatGPT.mockRejectedValueOnce(error);

        await expect(
            callChatGPTWithRetry('prompt', MODEL, 'key')
        ).rejects.toThrow('upstream failure');
    });

    it('uses default maxAttempts when not provided', async () => {
        mockCallChatGPT.mockResolvedValueOnce('result');

        await callChatGPTWithRetry('prompt', MODEL, 'key');

        expect(mockWithRetry).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                maxAttempts: 5,
                baseDelayMs: AI_RETRY_DELAY_MS,
            })
        );
    });
});
