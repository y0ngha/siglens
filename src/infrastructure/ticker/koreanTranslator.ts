import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';
import { parseJsonResponse } from '@/infrastructure/ai/parseJsonResponse';
import { tryReadTranslatorConfig } from '@/infrastructure/ticker/config';
import type { TranslatorEntry } from '@/infrastructure/ticker/types';

function buildTranslatePrompt(entries: readonly TranslatorEntry[]): string {
    const entryList = entries.map(e => `- ${e.symbol}: ${e.name}`).join('\n');
    return `Translate these English company names to Korean (한국에서 통용되는 한국어 이름 또는 음역).
Return ONLY a JSON object mapping symbol to Korean name. Example: {"AAPL":"애플","NVDA":"엔비디아"}

Companies:
${entryList}`;
}

function isStringRecord(value: unknown): value is Record<string, string> {
    if (value === null || typeof value !== 'object') return false;
    return Object.values(value).every(v => typeof v === 'string');
}

export async function translateCompanyNames(
    entries: readonly TranslatorEntry[]
): Promise<Record<string, string>> {
    if (entries.length === 0) return {};

    const config = tryReadTranslatorConfig();
    if (!config) return {};

    try {
        const text = await callGeminiWithKeyFallback({
            primaryApiKey: config.freeApiKey,
            fallbackApiKey: config.apiKey,
            model: config.model,
            contents: buildTranslatePrompt(entries),
        });
        const parsed = parseJsonResponse(text, 'koreanTranslator');
        return isStringRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}
