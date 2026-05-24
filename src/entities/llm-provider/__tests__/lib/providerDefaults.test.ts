import {
    CHATGPT_MODEL_PRIORITY,
    CLAUDE_MODEL_PRIORITY,
    GEMINI_MODEL_PRIORITY,
    resolveDefaultModelForProvider,
} from '@/entities/llm-provider/lib/providerDefaults';
import type { ModelId } from '@y0ngha/siglens-core';

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
    });

    describe('when all models are allowed', () => {
        const allModels: readonly ModelId[] = [
            ...CLAUDE_MODEL_PRIORITY,
            ...GEMINI_MODEL_PRIORITY,
            ...CHATGPT_MODEL_PRIORITY,
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
    });
});
