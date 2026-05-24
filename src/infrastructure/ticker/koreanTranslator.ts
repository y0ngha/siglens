import { callGeminiChat, parseJsonResponse } from '@/entities/llm-provider';
import { tryReadTranslatorConfig } from '@/infrastructure/ticker/config';
import type {
    TranslatorConfig,
    TranslatorEntry,
} from '@/infrastructure/ticker/types';

function buildTranslatePrompt(entries: readonly TranslatorEntry[]): string {
    const entryList = entries.map(e => `- ${e.symbol}: ${e.name}`).join('\n');
    return `Translate these English company names to Korean (한국에서 통용되는 한국어 이름 또는 음역).
Return ONLY a JSON object mapping symbol to Korean name. Example: {"AAPL":"애플","NVDA":"엔비디아"}

Companies:
${entryList}`;
}

function buildDescriptionTranslatePrompt(description: string): string {
    return `Translate the following English company description to Korean. Return only the Korean translation, no explanations or extra text.

${description}`;
}

function isStringRecord(value: unknown): value is Record<string, string> {
    if (value === null || typeof value !== 'object') return false;
    return Object.values(value).every(v => typeof v === 'string');
}

/**
 * Calls Gemini with freeApiKey first; falls back to apiKey on failure.
 * Always uses thinkingBudget: 0 — these are simple translation tasks.
 */
async function callGeminiWithKeyFallback(
    config: TranslatorConfig,
    contents: string
): Promise<string> {
    if (config.freeApiKey) {
        try {
            return await callGeminiChat({
                serverApiKey: config.freeApiKey,
                userApiKey: undefined,
                model: config.model,
                contents,
                thinkingBudget: 0,
            });
        } catch {
            // freeApiKey failed — fall through to primary key
        }
    }
    return callGeminiChat({
        serverApiKey: config.apiKey,
        userApiKey: undefined,
        model: config.model,
        contents,
        thinkingBudget: 0,
    });
}

export async function translateCompanyNames(
    entries: readonly TranslatorEntry[]
): Promise<Record<string, string>> {
    if (entries.length === 0) return {};

    const config = tryReadTranslatorConfig();
    if (!config) return {};

    try {
        const text = await callGeminiWithKeyFallback(
            config,
            buildTranslatePrompt(entries)
        );
        const parsed = parseJsonResponse(text, 'koreanTranslator');
        return isStringRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export async function translateCompanyDescription(
    description: string
): Promise<string | null> {
    const config = tryReadTranslatorConfig();
    if (!config) return null;

    try {
        const text = await callGeminiWithKeyFallback(
            config,
            buildDescriptionTranslatePrompt(description)
        );
        return text.trim() || null;
    } catch {
        return null;
    }
}
