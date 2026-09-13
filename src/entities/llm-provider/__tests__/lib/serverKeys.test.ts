import { afterEach, describe, expect, it } from 'vitest';
import { getServerPrimaryKey } from '@/entities/llm-provider/lib/serverKeys';

const ORIGINAL = { ...process.env };

afterEach(() => {
    process.env = { ...ORIGINAL };
});

describe('getServerPrimaryKey', () => {
    it('provider별 *_CHAT_API_KEY', () => {
        process.env.DEEPSEEK_CHAT_API_KEY = 'd';
        expect(getServerPrimaryKey('deepseek')).toBe('d');
    });

    it('없으면 undefined', () => {
        delete process.env.OPENAI_CHAT_API_KEY;
        expect(getServerPrimaryKey('openai')).toBeUndefined();
    });

    it('google은 GEMINI_CHAT_API_KEY', () => {
        process.env.GEMINI_CHAT_API_KEY = 'g';
        expect(getServerPrimaryKey('google')).toBe('g');
    });

    it('anthropic은 ANTHROPIC_CHAT_API_KEY', () => {
        process.env.ANTHROPIC_CHAT_API_KEY = 'a';
        expect(getServerPrimaryKey('anthropic')).toBe('a');
    });
});
