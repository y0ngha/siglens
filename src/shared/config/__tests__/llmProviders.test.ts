import {
    LLM_PROVIDER_VALUES,
    type LlmProvider,
} from '@/shared/config/llmProviders';

describe('LLM_PROVIDER_VALUES', () => {
    it('비어있지 않은 배열이다', () => {
        expect(LLM_PROVIDER_VALUES.length).toBeGreaterThan(0);
    });

    it('모든 항목이 비어있지 않은 문자열이다', () => {
        for (const provider of LLM_PROVIDER_VALUES) {
            expect(typeof provider).toBe('string');
            expect(provider.length).toBeGreaterThan(0);
        }
    });

    it('중복 값이 없다', () => {
        expect(new Set(LLM_PROVIDER_VALUES).size).toBe(
            LLM_PROVIDER_VALUES.length
        );
    });

    it("'anthropic', 'google', 'openai'를 포함한다", () => {
        expect([...LLM_PROVIDER_VALUES]).toEqual(
            expect.arrayContaining(['anthropic', 'google', 'openai'])
        );
    });

    it('3개 프로바이더가 정의되어 있다', () => {
        expect(LLM_PROVIDER_VALUES).toHaveLength(3);
    });
});

describe('LlmProvider 타입', () => {
    it('LLM_PROVIDER_VALUES의 각 값이 LlmProvider 타입으로 할당 가능하다', () => {
        // 컴파일 타임 검증 — 타입 에러 없이 할당되면 통과.
        const providers: LlmProvider[] = [...LLM_PROVIDER_VALUES];
        expect(providers).toHaveLength(LLM_PROVIDER_VALUES.length);
    });
});
