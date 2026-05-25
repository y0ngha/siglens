import { LLM_PROVIDER_LABELS } from '@/shared/lib/llmProviderLabels';
import { LLM_PROVIDER_VALUES } from '@/shared/config/llmProviders';

describe('LLM_PROVIDER_LABELS', () => {
    it('has a label for every provider in LLM_PROVIDER_VALUES', () => {
        for (const provider of LLM_PROVIDER_VALUES) {
            expect(LLM_PROVIDER_LABELS[provider]).toBeDefined();
            expect(typeof LLM_PROVIDER_LABELS[provider]).toBe('string');
            expect(LLM_PROVIDER_LABELS[provider].length).toBeGreaterThan(0);
        }
    });

    it('has exactly three entries', () => {
        expect(Object.keys(LLM_PROVIDER_LABELS)).toHaveLength(3);
    });

    it('anthropic label contains Claude', () => {
        expect(LLM_PROVIDER_LABELS.anthropic).toContain('Claude');
    });

    it('google label contains Gemini', () => {
        expect(LLM_PROVIDER_LABELS.google).toContain('Gemini');
    });

    it('openai label contains ChatGPT', () => {
        expect(LLM_PROVIDER_LABELS.openai).toContain('ChatGPT');
    });

    it('each label includes the company name in parentheses', () => {
        expect(LLM_PROVIDER_LABELS.anthropic).toMatch(/\(Anthropic\)/);
        expect(LLM_PROVIDER_LABELS.google).toMatch(/\(Google\)/);
        expect(LLM_PROVIDER_LABELS.openai).toMatch(/\(OpenAI\)/);
    });
});
