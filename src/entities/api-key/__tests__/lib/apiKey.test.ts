import {
    isLlmProvider,
    LLM_PROVIDER_VALUES,
    normalizeLlmApiKey,
} from '@/entities/api-key';

describe('normalizeLlmApiKey', () => {
    it('returns the input when it has no surrounding whitespace', () => {
        expect(normalizeLlmApiKey('sk-ant-abc')).toBe('sk-ant-abc');
    });

    it('trims leading and trailing whitespace from the input', () => {
        expect(normalizeLlmApiKey('  sk-ant-abc  ')).toBe('sk-ant-abc');
    });

    it('returns null when the input is empty', () => {
        expect(normalizeLlmApiKey('')).toBeNull();
    });

    it('returns null when the input is whitespace only', () => {
        expect(normalizeLlmApiKey('   \t\n')).toBeNull();
    });
});

describe('isLlmProvider', () => {
    it.each(LLM_PROVIDER_VALUES)(
        'returns true for the supported provider %s',
        provider => {
            expect(isLlmProvider(provider)).toBe(true);
        }
    );

    it('returns false for an unsupported provider string', () => {
        expect(isLlmProvider('mistral')).toBe(false);
    });

    it('returns false for an empty string', () => {
        expect(isLlmProvider('')).toBe(false);
    });
});
