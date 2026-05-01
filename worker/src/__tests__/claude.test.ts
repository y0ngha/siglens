import Anthropic from '@anthropic-ai/sdk';
import { MAX_TOKENS_CODE, callClaude } from '../claude';
import type { ClaudeModel } from '../models';

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
    __esModule: true,
    default: jest.fn(() => ({
        messages: {
            create: mockCreate,
        },
    })),
}));

// jest.mocked는 import된 default가 mock 함수임을 type 시스템에 알려준다.
const mockedAnthropic = jest.mocked(Anthropic);

const MODEL_WITH_THINKING: ClaudeModel = 'claude-opus-4-7';
const MODEL_WITHOUT_THINKING: ClaudeModel = 'claude-haiku-3-5';

describe('callClaude', () => {
    beforeEach(() => {
        mockCreate.mockClear();
    });

    it('returns text from end_turn response', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'analysis result' }],
        });

        const result = await callClaude('prompt', {
            model: MODEL_WITH_THINKING,
            apiKey: 'key',
        });

        expect(result).toBe('analysis result');
    });

    it('extracts text block from mixed content (thinking + text)', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'end_turn',
            content: [
                {
                    type: 'thinking',
                    thinking: 'reasoning...',
                    signature: 'sig',
                },
                { type: 'text', text: 'final answer' },
            ],
        });

        const result = await callClaude('prompt', {
            model: MODEL_WITH_THINKING,
            apiKey: 'key',
        });

        expect(result).toBe('final answer');
    });

    it('enables thinking config when model supports it and option is default (true)', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'ok' }],
        });

        await callClaude('prompt', {
            model: MODEL_WITH_THINKING,
            apiKey: 'key',
        });

        const call = mockCreate.mock.calls[0][0];
        expect(call.thinking).toEqual({
            type: 'enabled',
            budget_tokens: 32000,
        });
        // thinking 활성 시 temperature/top_p 미지정
        expect(call).not.toHaveProperty('temperature');
        expect(call).not.toHaveProperty('top_p');
    });

    it('omits thinking config when model does not support thinking', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'ok' }],
        });

        await callClaude('prompt', {
            model: MODEL_WITHOUT_THINKING,
            apiKey: 'key',
        });

        const call = mockCreate.mock.calls[0][0];
        expect(call).not.toHaveProperty('thinking');
        expect(call.temperature).toBe(0);
        expect(call.top_p).toBe(0.95);
    });

    it('disables thinking when option.thinking is false even on supported model', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'ok' }],
        });

        await callClaude('prompt', {
            model: MODEL_WITH_THINKING,
            apiKey: 'key',
            thinking: false,
        });

        const call = mockCreate.mock.calls[0][0];
        expect(call).not.toHaveProperty('thinking');
        expect(call.temperature).toBe(0);
    });

    it('uses provided thinkingBudget when specified', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'ok' }],
        });

        await callClaude('prompt', {
            model: MODEL_WITH_THINKING,
            apiKey: 'key',
            thinkingBudget: 8000,
        });

        const call = mockCreate.mock.calls[0][0];
        expect(call.thinking).toEqual({
            type: 'enabled',
            budget_tokens: 8000,
        });
    });

    it('disables thinking when requested budget is zero', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'ok' }],
        });

        await callClaude('prompt', {
            model: MODEL_WITH_THINKING,
            apiKey: 'key',
            thinking: true,
            thinkingBudget: 0,
        });

        const call = mockCreate.mock.calls[0][0];
        expect(call).not.toHaveProperty('thinking');
        expect(call.temperature).toBe(0);
    });

    it('throws MAX_TOKENS_CODE error when stop_reason is max_tokens', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'max_tokens',
            content: [],
        });

        await expect(
            callClaude('prompt', {
                model: MODEL_WITH_THINKING,
                apiKey: 'key',
            })
        ).rejects.toMatchObject({ code: MAX_TOKENS_CODE });
    });

    it('throws non-retryable error when stop_reason is refusal', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'refusal',
            content: [],
        });

        const promise = callClaude('prompt', {
            model: MODEL_WITH_THINKING,
            apiKey: 'key',
        });

        await expect(promise).rejects.toThrow(/refused/);
        await expect(promise).rejects.not.toMatchObject({ retryable: true });
    });

    it('throws retryable error for unexpected stop_reason', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'tool_use',
            content: [],
        });

        await expect(
            callClaude('prompt', {
                model: MODEL_WITH_THINKING,
                apiKey: 'key',
            })
        ).rejects.toMatchObject({ retryable: true });
    });

    it('throws retryable error when end_turn returns no text block', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'end_turn',
            content: [
                {
                    type: 'thinking',
                    thinking: 'thoughts',
                    signature: 'sig',
                },
            ],
        });

        await expect(
            callClaude('prompt', {
                model: MODEL_WITH_THINKING,
                apiKey: 'key',
            })
        ).rejects.toMatchObject({ retryable: true });
    });

    it('passes max_tokens from CLAUDE_MODEL_MAX_TOKENS map', async () => {
        mockCreate.mockResolvedValueOnce({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'ok' }],
        });

        await callClaude('prompt', {
            model: MODEL_WITH_THINKING,
            apiKey: 'key',
        });

        const call = mockCreate.mock.calls[0][0];
        // claude-opus-4-7 max output = 128000
        expect(call.max_tokens).toBe(128_000);
    });

    it('propagates abort from external signal to underlying SDK call', async () => {
        // mockCreate가 호출되는 동안 외부 signal abort → 내부 controller signal로 전파 확인
        let receivedSignal: AbortSignal | undefined;
        mockCreate.mockImplementationOnce(async (_params, options) => {
            receivedSignal = options?.signal;
            // 호출 시점에 외부 controller abort
            externalController.abort();
            return {
                stop_reason: 'end_turn',
                content: [{ type: 'text', text: 'ok' }],
            };
        });

        const externalController = new AbortController();
        await callClaude('prompt', {
            model: MODEL_WITH_THINKING,
            apiKey: 'key',
            signal: externalController.signal,
        });

        // mockCreate에 전달된 내부 controller.signal은 외부 signal abort 시 함께 aborted 상태가 됨
        expect(receivedSignal).toBeDefined();
        expect(receivedSignal!.aborted).toBe(true);
    });

    it('reuses cached client across calls with the same apiKey', async () => {
        mockedAnthropic.mockClear();
        mockCreate.mockResolvedValue({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'ok' }],
        });

        await callClaude('prompt1', {
            model: MODEL_WITH_THINKING,
            apiKey: 'shared-key',
        });
        await callClaude('prompt2', {
            model: MODEL_WITH_THINKING,
            apiKey: 'shared-key',
        });

        // 동일 apiKey로 두 번 호출했지만 client는 한 번만 생성
        // (이전 테스트에서 이미 'shared-key'로 client가 캐시된 경우를 위해 정확한 횟수가 아닌 ≤1 검증)
        expect(mockedAnthropic.mock.calls.length).toBeLessThanOrEqual(1);
    });
});
