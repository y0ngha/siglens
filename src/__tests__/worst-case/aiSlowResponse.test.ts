const mockAnthropicFinalMessage = vi.fn();
const mockOpenaiCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
    default: class MockAnthropic {
        messages = {
            stream: () => ({ finalMessage: mockAnthropicFinalMessage }),
        };
    },
}));

vi.mock('openai', () => ({
    default: class MockOpenAI {
        responses = { create: mockOpenaiCreate };
    },
}));

vi.mock('@y0ngha/siglens-core', () => ({
    MODEL_SPECS: {
        'claude-haiku-4-5': {
            apiModelId: 'claude-haiku-4-5-20251001',
            provider: 'anthropic',
            maxOutputTokens: 8192,
            temperature: 1.0,
        },
        'gpt-4.1-mini': {
            apiModelId: 'gpt-4.1-mini',
            provider: 'openai',
            maxOutputTokens: 16384,
            temperature: 1.0,
        },
    },
    getProviderForModel: (model: string) => {
        const map: Record<string, string> = {
            'claude-haiku-4-5': 'anthropic',
            'gpt-4.1-mini': 'openai',
        };
        return map[model];
    },
    pollAnalysis: vi.fn(),
}));

import { callAiProviderRouter } from '@/entities/llm-provider/api/router';
import { pollAnalysisAction } from '@/entities/analysis/actions/pollAnalysisAction';
import { pollAnalysis } from '@y0ngha/siglens-core';

const mockPollAnalysis = pollAnalysis as ReturnType<typeof vi.fn>;

describe('AI slow response and timeout handling', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Anthropic timeout error is propagated to caller', async () => {
        mockAnthropicFinalMessage.mockRejectedValue(
            new Error('Request timed out after 10000ms')
        );

        await expect(
            callAiProviderRouter({
                serverApiKey: 'test-key',
                userApiKey: undefined,
                model: 'claude-haiku-4-5',
                contents: 'Hello',
            })
        ).rejects.toThrow('Request timed out');
    });

    it('OpenAI timeout error is propagated to caller', async () => {
        mockOpenaiCreate.mockRejectedValue(
            new Error('Request timed out after 30000ms')
        );

        await expect(
            callAiProviderRouter({
                serverApiKey: 'test-key',
                userApiKey: undefined,
                model: 'gpt-4.1-mini',
                contents: 'Hello',
            })
        ).rejects.toThrow('Request timed out');
    });

    it('Anthropic connection error is propagated', async () => {
        mockAnthropicFinalMessage.mockRejectedValue(
            new Error('Connection error')
        );

        await expect(
            callAiProviderRouter({
                serverApiKey: 'test-key',
                userApiKey: undefined,
                model: 'claude-haiku-4-5',
                contents: 'Hello',
            })
        ).rejects.toThrow('Connection error');
    });

    describe('pollAnalysisAction', () => {
        it('returns error status from core', async () => {
            mockPollAnalysis.mockResolvedValue({
                status: 'error',
                message: 'Analysis failed',
            });

            const result = await pollAnalysisAction('job-123');

            expect(result.status).toBe('error');
        });

        it('returns pending status while processing', async () => {
            mockPollAnalysis.mockResolvedValue({ status: 'pending' });

            const result = await pollAnalysisAction('job-456');

            expect(result.status).toBe('pending');
        });

        it('returns completed result with data', async () => {
            mockPollAnalysis.mockResolvedValue({
                status: 'completed',
                data: { summary: 'test' },
            });

            const result = await pollAnalysisAction('job-789');

            expect(result.status).toBe('completed');
        });
    });
});
