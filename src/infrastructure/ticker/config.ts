import type { TranslatorConfig } from './types';

const DEFAULT_TRANSLATE_MODEL = 'gemini-2.5-flash';

export function tryReadTranslatorConfig(): TranslatorConfig | null {
    const apiKey = process.env.TRANSLATE_API_KEY;
    if (!apiKey) return null;
    return {
        apiKey,
        freeApiKey: process.env.TRANSLATE_FREE_API_KEY,
        model: process.env.TRANSLATE_MODEL ?? DEFAULT_TRANSLATE_MODEL,
    };
}
