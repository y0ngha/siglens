import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDeepseek } = vi.hoisted(() => ({ mockDeepseek: vi.fn() }));
vi.mock('@/entities/llm-provider/api/agent/deepseek', () => ({
    callDeepseekAgent: mockDeepseek,
    AGENT_JOB_ID: 'agent',
}));

import {
    AGENT_MODEL,
    createAgentProvider,
} from '@/entities/llm-provider/api/agent/router';
import {
    DEEPSEEK_V4_1_FLASH_MODEL,
    type AgentProviderResult,
} from '@y0ngha/siglens-core';

const OK: AgentProviderResult = {
    text: 'ok',
    toolCalls: [],
    stopReason: 'end',
    usage: {
        promptTokens: 1,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 1,
    },
};
const base = {
    system: 's',
    messages: [],
    tools: [],
    maxOutputTokens: 100,
    signal: new AbortController().signal,
    onEvent: vi.fn(),
    apiKey: '',
};

describe('createAgentProvider (pilot: DeepSeek flash fixed)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('DEEPSEEK_CHAT_API_KEY', 'ds');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('AGENT_MODEL은 deepseek-v4.1-flash, apiModelId deepseek-flash + 서버 키로 호출', async () => {
        mockDeepseek.mockResolvedValue(OK);
        expect(AGENT_MODEL).toBe('deepseek-v4.1-flash');
        expect(AGENT_MODEL).toBe(DEEPSEEK_V4_1_FLASH_MODEL);
        const provider = createAgentProvider();
        await provider({ ...base, model: 'claude-opus-5' }); // 클라이언트/코어가 무엇을 넘기든 무시
        expect(mockDeepseek).toHaveBeenCalledWith(
            expect.objectContaining({
                apiKey: 'ds',
                apiModelId: 'deepseek-flash',
                model: 'deepseek-v4.1-flash',
            })
        );
    });

    it('서버 키 없음 → throw', async () => {
        vi.stubEnv('DEEPSEEK_CHAT_API_KEY', '');
        delete process.env.DEEPSEEK_CHAT_API_KEY;
        await expect(
            createAgentProvider()({ ...base, model: 'deepseek-v4.1-flash' })
        ).rejects.toThrow(/No API key/);
    });

    it('프로바이더 오류는 그대로 전파(폴백 없음, P3)', async () => {
        mockDeepseek.mockRejectedValue(
            Object.assign(new Error('busy'), { status: 503 })
        );
        await expect(
            createAgentProvider()({ ...base, model: 'deepseek-v4.1-flash' })
        ).rejects.toThrow('busy');
    });
});
