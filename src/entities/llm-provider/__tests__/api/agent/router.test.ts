import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDeepseek, mockGemini } = vi.hoisted(() => ({
    mockDeepseek: vi.fn(),
    // Never a real Gemini call: vitest may load a real GEMINI_CHAT_API_KEY.
    mockGemini: vi.fn(),
}));
vi.mock('@/entities/llm-provider/api/agent/deepseek', () => ({
    callDeepseekAgent: mockDeepseek,
}));
vi.mock('@/entities/llm-provider/api/agent/gemini', () => ({
    callGeminiAgent: mockGemini,
}));

import {
    AGENT_FALLBACK_MODEL,
    AGENT_MODEL,
    createAgentProvider,
} from '@/entities/llm-provider/api/agent/router';
import { AGENT_PROVIDER_STALLED } from '@/entities/llm-provider/api/agent/openAiCompatibleStream';
import {
    DEEPSEEK_V4_1_FLASH_MODEL,
    MODEL_SPECS,
    getProviderForModel,
    type AgentProviderResult,
    type AgentStreamEvent,
    type CallAgentProviderOptions,
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
        vi.stubEnv('GEMINI_CHAT_API_KEY', '');
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

    it('Gemini 서버 키가 없으면 프로바이더 오류를 그대로 전파한다', async () => {
        mockDeepseek.mockRejectedValue(
            Object.assign(new Error('busy'), { status: 503 })
        );
        await expect(
            createAgentProvider()({ ...base, model: 'deepseek-v4.1-flash' })
        ).rejects.toThrow('busy');
        expect(mockGemini).not.toHaveBeenCalled();
    });
});

describe('createAgentProvider fallback → Gemini 3.6 Flash', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('DEEPSEEK_CHAT_API_KEY', 'ds');
        vi.stubEnv('GEMINI_CHAT_API_KEY', 'gm');
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockGemini.mockResolvedValue(OK);
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        warn.mockRestore();
    });

    function input(
        overrides: Partial<CallAgentProviderOptions> = {}
    ): CallAgentProviderOptions {
        return {
            system: 'sys',
            messages: [{ role: 'user', content: 'q' }],
            tools: [
                {
                    name: 'get_quote',
                    description: 'd',
                    inputSchema: { type: 'object', properties: {} },
                },
            ] as unknown as CallAgentProviderOptions['tools'],
            maxOutputTokens: 100,
            signal: new AbortController().signal,
            onEvent: vi.fn(),
            apiKey: '',
            model: 'deepseek-v4.1-flash',
            ...overrides,
        };
    }

    it('AGENT_FALLBACK_MODEL은 core 스펙의 gemini-3.6-flash', () => {
        expect(AGENT_FALLBACK_MODEL).toBe('gemini-3.6-flash');
        expect(MODEL_SPECS[AGENT_FALLBACK_MODEL].apiModelId).toBe(
            'gemini-3.6-flash'
        );
        expect(getProviderForModel(AGENT_FALLBACK_MODEL)).toBe('google');
    });

    it.each([
        ['503', Object.assign(new Error('busy'), { status: 503 })],
        ['429', Object.assign(new Error('rate'), { status: 429 })],
        ['network(status 없음)', new Error('Connection error.')],
        [
            'stall',
            Object.assign(new Error('stalled'), {
                code: AGENT_PROVIDER_STALLED,
            }),
        ],
    ])(
        '%s → 같은 system/messages/tools로 Gemini 서버 키 호출',
        async (_label, error) => {
            mockDeepseek.mockRejectedValue(error);
            const o = input();
            const r = await createAgentProvider()(o);
            expect(r).toBe(OK);
            expect(mockGemini).toHaveBeenCalledTimes(1);
            const g = mockGemini.mock.lastCall![0];
            expect(g).toMatchObject({
                model: 'gemini-3.6-flash',
                apiKey: 'gm',
                apiModelId: MODEL_SPECS['gemini-3.6-flash'].apiModelId,
                maxOutputTokens: 100,
            });
            expect(g.system).toBe(o.system);
            expect(g.messages).toBe(o.messages);
            expect(g.tools).toBe(o.tools);
            expect(g.signal).toBe(o.signal);
            expect(g.onEvent).toBe(o.onEvent);
            expect(warn).toHaveBeenCalledTimes(1);
            expect(JSON.parse(warn.mock.lastCall![0] as string)).toEqual({
                tag: '[agent-router] deepseek failed, falling back',
                fallbackModel: 'gemini-3.6-flash',
                message: (error as Error).message,
            });
        }
    );

    it('400은 폴백하지 않는다', async () => {
        mockDeepseek.mockRejectedValue(
            Object.assign(new Error('bad'), { status: 400 })
        );
        await expect(createAgentProvider()(input())).rejects.toThrow('bad');
        expect(mockGemini).not.toHaveBeenCalled();
    });

    it('호출자가 abort했으면 폴백하지 않는다', async () => {
        const ac = new AbortController();
        mockDeepseek.mockImplementation(async () => {
            ac.abort();
            throw new Error('aborted');
        });
        await expect(
            createAgentProvider()(input({ signal: ac.signal }))
        ).rejects.toThrow('aborted');
        expect(mockGemini).not.toHaveBeenCalled();
    });

    it.each([
        ['text', { type: 'text', delta: '부분' }],
        [
            'tool_call',
            {
                type: 'tool_call',
                call: { id: 'c', name: 'get_quote', args: {} },
            },
        ],
    ] as const)(
        '%s 이벤트가 이미 나갔으면 폴백하지 않고 이벤트는 전달된다',
        async (_label, event) => {
            mockDeepseek.mockImplementation(
                async (a: { onEvent: (e: AgentStreamEvent) => void }) => {
                    a.onEvent(event as AgentStreamEvent);
                    throw Object.assign(new Error('busy'), { status: 503 });
                }
            );
            const o = input();
            await expect(createAgentProvider()(o)).rejects.toThrow('busy');
            expect(mockGemini).not.toHaveBeenCalled();
            expect(o.onEvent).toHaveBeenCalledWith(event);
        }
    );

    it('성공 시 Gemini를 부르지 않는다', async () => {
        mockDeepseek.mockResolvedValue(OK);
        await expect(createAgentProvider()(input())).resolves.toBe(OK);
        expect(mockGemini).not.toHaveBeenCalled();
    });

    it('폴백이 일어나면 전달된 state.fallbackUsed를 true로 설정한다', async () => {
        mockDeepseek.mockRejectedValue(
            Object.assign(new Error('busy'), { status: 503 })
        );
        const state = { fallbackUsed: false };
        await createAgentProvider(state)(input());
        expect(state.fallbackUsed).toBe(true);
    });

    it('폴백이 없으면 state.fallbackUsed는 false로 유지된다', async () => {
        mockDeepseek.mockResolvedValue(OK);
        const state = { fallbackUsed: false };
        await createAgentProvider(state)(input());
        expect(state.fallbackUsed).toBe(false);
    });

    it('같은 턴의 다음 스텝에서 state.fallbackUsed가 true면 DeepSeek을 부르지 않고 바로 Gemini로 간다', async () => {
        const state = { fallbackUsed: true };
        const o = input();
        const r = await createAgentProvider(state)(o);
        expect(r).toBe(OK);
        expect(mockDeepseek).not.toHaveBeenCalled();
        expect(mockGemini).toHaveBeenCalledTimes(1);
        expect(mockGemini.mock.lastCall![0]).toMatchObject({
            model: 'gemini-3.6-flash',
            apiKey: 'gm',
            apiModelId: MODEL_SPECS['gemini-3.6-flash'].apiModelId,
        });
    });

    it('state 없이 호출하면(undefined) 기존 동작대로 매번 DeepSeek을 먼저 시도한다', async () => {
        mockDeepseek.mockRejectedValue(
            Object.assign(new Error('busy'), { status: 503 })
        );
        const r = await createAgentProvider(undefined)(input());
        expect(r).toBe(OK);
        expect(mockDeepseek).toHaveBeenCalledTimes(1);
        expect(mockGemini).toHaveBeenCalledTimes(1);
    });

    it('state.fallbackUsed가 true인데 Gemini 서버 키가 없으면 명확한 에러를 던진다', async () => {
        vi.stubEnv('GEMINI_CHAT_API_KEY', '');
        const state = { fallbackUsed: true };
        await expect(createAgentProvider(state)(input())).rejects.toThrow(
            /No API key/
        );
        expect(mockDeepseek).not.toHaveBeenCalled();
        expect(mockGemini).not.toHaveBeenCalled();
    });
});
