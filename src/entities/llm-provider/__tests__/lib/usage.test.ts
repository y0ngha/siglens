import { describe, it, expect } from 'vitest';
import {
    CHAT_JOB_ID,
    extractClaudeUsage,
    extractOpenAiCompatibleUsage,
    extractGeminiUsage,
    extractOpenAIUsage,
} from '@/entities/llm-provider/lib/usage';

const ZERO = {
    promptTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
};

describe('extractClaudeUsage', () => {
    it('세 입력 버킷을 분리해 매핑한다', () => {
        expect(
            extractClaudeUsage({
                input_tokens: 100,
                cache_read_input_tokens: 40,
                cache_creation_input_tokens: 10,
                output_tokens: 25,
            })
        ).toEqual({
            promptTokens: 100,
            cachedTokens: 40,
            cacheWriteTokens: 10,
            outputTokens: 25,
        });
    });

    it('usage가 없으면 0으로 채운다', () => {
        expect(extractClaudeUsage(undefined)).toEqual(ZERO);
        expect(extractClaudeUsage(null)).toEqual(ZERO);
    });

    it('null 필드는 0으로 대체한다', () => {
        expect(
            extractClaudeUsage({ input_tokens: null, output_tokens: 7 })
        ).toEqual({ ...ZERO, outputTokens: 7 });
    });

    /** 반환값은 매번 새 객체여야 한다 — 공유 상수를 노출하면 호출자가 오염시킬 수 있다. */
    it('호출마다 독립된 객체를 반환한다', () => {
        const a = extractClaudeUsage(undefined);
        const b = extractClaudeUsage(undefined);
        expect(a).not.toBe(b);
    });
});

describe('extractGeminiUsage', () => {
    it('cached를 promptTokens에서 빼 버킷을 겹치지 않게 한다', () => {
        expect(
            extractGeminiUsage({
                promptTokenCount: 500,
                cachedContentTokenCount: 200,
                candidatesTokenCount: 80,
            })
        ).toEqual({
            promptTokens: 300,
            cachedTokens: 200,
            cacheWriteTokens: 0,
            outputTokens: 80,
        });
    });

    it('cached가 prompt보다 크게 보고돼도 음수가 되지 않는다', () => {
        expect(
            extractGeminiUsage({
                promptTokenCount: 10,
                cachedContentTokenCount: 40,
            }).promptTokens
        ).toBe(0);
    });
});

describe('extractOpenAIUsage', () => {
    it('Responses API 필드명을 읽는다', () => {
        expect(
            extractOpenAIUsage({
                input_tokens: 300,
                input_tokens_details: { cached_tokens: 100 },
                output_tokens: 45,
            })
        ).toEqual({
            promptTokens: 200,
            cachedTokens: 100,
            cacheWriteTokens: 0,
            outputTokens: 45,
        });
    });

    it('details가 없으면 cached는 0이다', () => {
        expect(extractOpenAIUsage({ input_tokens: 50 })).toEqual({
            ...ZERO,
            promptTokens: 50,
        });
    });
});

describe('extractOpenAiCompatibleUsage', () => {
    it('DeepSeek 고유 cache-hit 필드를 우선 사용한다', () => {
        expect(
            extractOpenAiCompatibleUsage({
                prompt_tokens: 1000,
                prompt_cache_hit_tokens: 700,
                prompt_tokens_details: { cached_tokens: 1 },
                completion_tokens: 120,
            })
        ).toEqual({
            promptTokens: 300,
            cachedTokens: 700,
            cacheWriteTokens: 0,
            outputTokens: 120,
        });
    });

    it('고유 필드가 없으면 OpenAI 호환 필드로 폴백한다', () => {
        expect(
            extractOpenAiCompatibleUsage({
                prompt_tokens: 90,
                prompt_tokens_details: { cached_tokens: 30 },
            })
        ).toEqual({ ...ZERO, promptTokens: 60, cachedTokens: 30 });
    });
});

describe('CHAT_JOB_ID', () => {
    it('라우터 경로 호출의 jobId 리터럴이다', () => {
        expect(CHAT_JOB_ID).toBe('chat');
    });
});
