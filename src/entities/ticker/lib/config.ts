import type { TranslatorConfig } from '../model';

const DEFAULT_TRANSLATE_MODEL = 'gemini-2.5-flash';

export function tryReadTranslatorConfig(): TranslatorConfig | null {
    const apiKey = process.env.TRANSLATE_API_KEY;
    if (!apiKey) return null;
    return {
        apiKey,
        model: process.env.TRANSLATE_MODEL ?? DEFAULT_TRANSLATE_MODEL,
    };
}
