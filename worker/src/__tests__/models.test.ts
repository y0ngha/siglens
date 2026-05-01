import {
    CHATGPT_MODEL_MAX_TOKENS,
    CLAUDE_MODEL_MAX_TOKENS,
    CLAUDE_MODEL_THINKING_BUDGET,
    GEMINI_MODEL_MAX_TOKENS,
    GEMINI_MODEL_THINKING_BUDGET,
    SIGLENS_PROVIDED_MODELS,
    getProvider,
    isSiglensProvided,
    isSupportedModel,
} from '../models';

describe('isSupportedModel', () => {
    it('returns true for valid AIModel string', () => {
        expect(isSupportedModel('gemini-2.5-flash')).toBe(true);
        expect(isSupportedModel('claude-opus-4-7')).toBe(true);
        expect(isSupportedModel('gpt-5.5')).toBe(true);
    });

    it('returns false for non-string values', () => {
        expect(isSupportedModel(undefined)).toBe(false);
        expect(isSupportedModel(null)).toBe(false);
        expect(isSupportedModel(42)).toBe(false);
        expect(isSupportedModel({})).toBe(false);
    });

    it('returns false for unknown model identifiers', () => {
        expect(isSupportedModel('claude-3-opus')).toBe(false);
        expect(isSupportedModel('gpt-4o')).toBe(false);
        expect(isSupportedModel('')).toBe(false);
    });

    it('returns false for siglens-core deprecated identifiers (claude-sonnet-4, claude-opus-4)', () => {
        // TIER_CONFIG.models 런타임 값에 포함되지 않으므로 거절되어야 한다.
        // unknown으로 좁히지 않고 받아 isSupportedModel의 type guard 동작을 그대로 검증한다.
        const sonnetLegacy: unknown = 'claude-sonnet-4';
        const opusLegacy: unknown = 'claude-opus-4';
        expect(isSupportedModel(sonnetLegacy)).toBe(false);
        expect(isSupportedModel(opusLegacy)).toBe(false);
    });
});

describe('isSiglensProvided', () => {
    it('returns true for free-tier siglens models', () => {
        expect(isSiglensProvided('gemini-2.5-flash')).toBe(true);
        expect(isSiglensProvided('gemini-2.5-flash-lite')).toBe(true);
        expect(isSiglensProvided('claude-haiku-3-5')).toBe(true);
        expect(isSiglensProvided('gpt-5-mini')).toBe(true);
    });

    it('returns false for non-siglens-provided models (user key required)', () => {
        expect(isSiglensProvided('gemini-2.5-pro')).toBe(false);
        expect(isSiglensProvided('claude-opus-4-7')).toBe(false);
        expect(isSiglensProvided('claude-sonnet-4-6')).toBe(false);
        expect(isSiglensProvided('gpt-5.4')).toBe(false);
        expect(isSiglensProvided('gpt-5.5')).toBe(false);
    });

    it('mirrors SIGLENS_PROVIDED_MODELS membership', () => {
        for (const model of SIGLENS_PROVIDED_MODELS) {
            expect(isSiglensProvided(model)).toBe(true);
        }
    });
});

describe('getProvider', () => {
    it('returns claude for claude-* models', () => {
        expect(getProvider('claude-haiku-3-5')).toBe('claude');
        expect(getProvider('claude-sonnet-4-6')).toBe('claude');
        expect(getProvider('claude-opus-4-7')).toBe('claude');
    });

    it('returns gemini for gemini-* models', () => {
        expect(getProvider('gemini-2.5-flash')).toBe('gemini');
        expect(getProvider('gemini-2.5-flash-lite')).toBe('gemini');
        expect(getProvider('gemini-2.5-pro')).toBe('gemini');
        expect(getProvider('gemini-3-flash-preview')).toBe('gemini');
        expect(getProvider('gemini-3.1-pro-preview')).toBe('gemini');
    });

    it('returns chatgpt for gpt-* models', () => {
        expect(getProvider('gpt-5-mini')).toBe('chatgpt');
        expect(getProvider('gpt-5.4')).toBe('chatgpt');
        expect(getProvider('gpt-5.5')).toBe('chatgpt');
    });
});

describe('model token maps', () => {
    it('CLAUDE_MODEL_MAX_TOKENS covers all Claude models', () => {
        expect(CLAUDE_MODEL_MAX_TOKENS['claude-haiku-3-5']).toBe(8_192);
        expect(CLAUDE_MODEL_MAX_TOKENS['claude-sonnet-4-6']).toBe(128_000);
        expect(CLAUDE_MODEL_MAX_TOKENS['claude-opus-4-7']).toBe(128_000);
    });

    it('CLAUDE_MODEL_THINKING_BUDGET marks haiku as thinking-unsupported (0)', () => {
        expect(CLAUDE_MODEL_THINKING_BUDGET['claude-haiku-3-5']).toBe(0);
        expect(
            CLAUDE_MODEL_THINKING_BUDGET['claude-sonnet-4-6']
        ).toBeGreaterThan(0);
        expect(
            CLAUDE_MODEL_THINKING_BUDGET['claude-opus-4-7']
        ).toBeGreaterThan(0);
    });

    it('GEMINI_MODEL_MAX_TOKENS uses 65536 for all Gemini models', () => {
        expect(GEMINI_MODEL_MAX_TOKENS['gemini-2.5-flash']).toBe(65_536);
        expect(GEMINI_MODEL_MAX_TOKENS['gemini-2.5-flash-lite']).toBe(65_536);
        expect(GEMINI_MODEL_MAX_TOKENS['gemini-2.5-pro']).toBe(65_536);
        expect(GEMINI_MODEL_MAX_TOKENS['gemini-3-flash-preview']).toBe(65_536);
        expect(GEMINI_MODEL_MAX_TOKENS['gemini-3.1-pro-preview']).toBe(
            65_536
        );
    });

    it('GEMINI_MODEL_THINKING_BUDGET assigns 24576 to flash-lite, 32768 to others', () => {
        expect(GEMINI_MODEL_THINKING_BUDGET['gemini-2.5-flash-lite']).toBe(
            24_576
        );
        expect(GEMINI_MODEL_THINKING_BUDGET['gemini-2.5-flash']).toBe(32_768);
        expect(GEMINI_MODEL_THINKING_BUDGET['gemini-2.5-pro']).toBe(32_768);
    });

    it('CHATGPT_MODEL_MAX_TOKENS uses 128k for all GPT-5 models', () => {
        expect(CHATGPT_MODEL_MAX_TOKENS['gpt-5-mini']).toBe(128_000);
        expect(CHATGPT_MODEL_MAX_TOKENS['gpt-5.4']).toBe(128_000);
        expect(CHATGPT_MODEL_MAX_TOKENS['gpt-5.5']).toBe(128_000);
    });

    it('Claude thinking budget is strictly less than max_tokens for all supported models', () => {
        const models: Array<keyof typeof CLAUDE_MODEL_MAX_TOKENS> = [
            'claude-haiku-3-5',
            'claude-sonnet-4-6',
            'claude-opus-4-7',
        ];
        for (const model of models) {
            expect(
                CLAUDE_MODEL_THINKING_BUDGET[model]
            ).toBeLessThan(CLAUDE_MODEL_MAX_TOKENS[model]);
        }
    });
});
