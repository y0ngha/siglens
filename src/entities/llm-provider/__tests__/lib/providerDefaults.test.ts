import {
    CHATGPT_MODEL_PRIORITY,
    CLAUDE_MODEL_PRIORITY,
    DEEPSEEK_MODEL_PRIORITY,
    GEMINI_MODEL_PRIORITY,
    resolveDefaultModelForProvider,
} from '@/entities/llm-provider/lib/providerDefaults';
import { MODEL_SPECS, type ModelId } from '@y0ngha/siglens-core';

describe('resolveDefaultModelForProvider', () => {
    describe('when allowedModels is empty', () => {
        it('returns null for claude provider', () => {
            const result = resolveDefaultModelForProvider('claude', []);
            expect(result).toBeNull();
        });

        it('returns null for gemini provider', () => {
            const result = resolveDefaultModelForProvider('gemini', []);
            expect(result).toBeNull();
        });

        it('returns null for chatgpt provider', () => {
            const result = resolveDefaultModelForProvider('chatgpt', []);
            expect(result).toBeNull();
        });

        it('returns null for deepseek provider', () => {
            const result = resolveDefaultModelForProvider('deepseek', []);
            expect(result).toBeNull();
        });
    });

    describe('when all models are allowed', () => {
        const allModels: readonly ModelId[] = [
            ...CLAUDE_MODEL_PRIORITY,
            ...GEMINI_MODEL_PRIORITY,
            ...CHATGPT_MODEL_PRIORITY,
            ...DEEPSEEK_MODEL_PRIORITY,
        ];

        it('returns the top priority claude model', () => {
            const result = resolveDefaultModelForProvider('claude', allModels);
            expect(result).toBe(CLAUDE_MODEL_PRIORITY[0]);
        });

        it('returns the top priority gemini model', () => {
            const result = resolveDefaultModelForProvider('gemini', allModels);
            expect(result).toBe(GEMINI_MODEL_PRIORITY[0]);
        });

        it('returns the top priority chatgpt model', () => {
            const result = resolveDefaultModelForProvider('chatgpt', allModels);
            expect(result).toBe(CHATGPT_MODEL_PRIORITY[0]);
        });

        it('returns the top priority deepseek model', () => {
            const result = resolveDefaultModelForProvider(
                'deepseek',
                allModels
            );
            expect(result).toBe(DEEPSEEK_MODEL_PRIORITY[0]);
        });
    });

    describe('when the top priority model is blocked', () => {
        it('returns the second priority claude model when the first is blocked', () => {
            const allowedModels = CLAUDE_MODEL_PRIORITY.slice(1);
            const result = resolveDefaultModelForProvider(
                'claude',
                allowedModels
            );
            expect(result).toBe(CLAUDE_MODEL_PRIORITY[1]);
        });

        it('returns the second priority gemini model when the first is blocked', () => {
            const allowedModels = GEMINI_MODEL_PRIORITY.slice(1);
            const result = resolveDefaultModelForProvider(
                'gemini',
                allowedModels
            );
            expect(result).toBe(GEMINI_MODEL_PRIORITY[1]);
        });

        it('returns the second priority chatgpt model when the first is blocked', () => {
            const allowedModels = CHATGPT_MODEL_PRIORITY.slice(1);
            const result = resolveDefaultModelForProvider(
                'chatgpt',
                allowedModels
            );
            expect(result).toBe(CHATGPT_MODEL_PRIORITY[1]);
        });

        it('returns the second priority deepseek model when the first is blocked', () => {
            const allowedModels = DEEPSEEK_MODEL_PRIORITY.slice(1);
            const result = resolveDefaultModelForProvider(
                'deepseek',
                allowedModels
            );
            expect(result).toBe(DEEPSEEK_MODEL_PRIORITY[1]);
        });
    });

    describe('when only the lowest priority model is allowed', () => {
        it('returns the bottom priority claude model', () => {
            const lowestPriority =
                CLAUDE_MODEL_PRIORITY[CLAUDE_MODEL_PRIORITY.length - 1];
            const result = resolveDefaultModelForProvider('claude', [
                lowestPriority,
            ]);
            expect(result).toBe(lowestPriority);
        });

        it('returns the bottom priority gemini model', () => {
            const lowestPriority =
                GEMINI_MODEL_PRIORITY[GEMINI_MODEL_PRIORITY.length - 1];
            const result = resolveDefaultModelForProvider('gemini', [
                lowestPriority,
            ]);
            expect(result).toBe(lowestPriority);
        });

        it('returns the bottom priority chatgpt model', () => {
            const lowestPriority =
                CHATGPT_MODEL_PRIORITY[CHATGPT_MODEL_PRIORITY.length - 1];
            const result = resolveDefaultModelForProvider('chatgpt', [
                lowestPriority,
            ]);
            expect(result).toBe(lowestPriority);
        });

        it('returns the bottom priority deepseek model', () => {
            const lowestPriority =
                DEEPSEEK_MODEL_PRIORITY[DEEPSEEK_MODEL_PRIORITY.length - 1];
            const result = resolveDefaultModelForProvider('deepseek', [
                lowestPriority,
            ]);
            expect(result).toBe(lowestPriority);
        });
    });

    describe('when only models from a different provider are in allowedModels', () => {
        it('returns null for claude when only gemini models are allowed', () => {
            const result = resolveDefaultModelForProvider('claude', [
                ...GEMINI_MODEL_PRIORITY,
            ]);
            expect(result).toBeNull();
        });

        it('returns null for gemini when only chatgpt models are allowed', () => {
            const result = resolveDefaultModelForProvider('gemini', [
                ...CHATGPT_MODEL_PRIORITY,
            ]);
            expect(result).toBeNull();
        });

        it('returns null for chatgpt when only claude models are allowed', () => {
            const result = resolveDefaultModelForProvider('chatgpt', [
                ...CLAUDE_MODEL_PRIORITY,
            ]);
            expect(result).toBeNull();
        });

        it('returns null for deepseek when only claude models are allowed', () => {
            const result = resolveDefaultModelForProvider('deepseek', [
                ...CLAUDE_MODEL_PRIORITY,
            ]);
            expect(result).toBeNull();
        });
    });

    describe('priority list coverage', () => {
        // core에 모델을 추가하고 이 목록에 반영하지 않는 드리프트를 막는다.
        // (모듈 자체는 현재 production 소비처가 없다 — providerDefaults.ts 상단 주석 참고.
        //  소비처가 붙는 시점에 낡은 목록이면 신규 모델이 조용히 후보에서 빠지므로 감시한다.)
        it.each([
            ['claude', CLAUDE_MODEL_PRIORITY],
            ['gemini', GEMINI_MODEL_PRIORITY],
            ['chatgpt', CHATGPT_MODEL_PRIORITY],
            ['deepseek', DEEPSEEK_MODEL_PRIORITY],
        ] as const)(
            'covers every %s model in MODEL_SPECS',
            (provider, list) => {
                const specModels = Object.entries(MODEL_SPECS)
                    .filter(([, spec]) => spec.provider === provider)
                    .map(([id]) => id);
                expect([...list].toSorted()).toEqual(specModels.toSorted());
            }
        );

        it('pins the head of every provider list', () => {
            expect(CLAUDE_MODEL_PRIORITY[0]).toBe('claude-opus-5');
            expect(CHATGPT_MODEL_PRIORITY[0]).toBe('gpt-5.6-sol');
            // 의도적 예외 — Gemini는 최신 세대가 Flash 라인뿐이라 구세대 Pro가 앞선다.
            // "최신 모델을 맨 앞으로" 라는 순진한 수정이 여기서 실패해야 한다.
            expect(GEMINI_MODEL_PRIORITY[0]).toBe('gemini-3.1-pro-preview');
            expect(DEEPSEEK_MODEL_PRIORITY[0]).toBe('deepseek-v4-flash');
        });
    });
});
