/**
 * `stripMarkdownCodeBlock` and `parseJsonResponse` below are deliberate
 * duplicates of helpers from `@y0ngha/siglens-core`.
 *
 * Source file in the core repo:
 * - `src/domain/utils.ts` (`stripMarkdownCodeBlock`, `parseJsonResponse`)
 *
 * These helpers are not exported from core's public API surface, so they
 * cannot be imported from `@y0ngha/siglens-core`. Core still uses
 * `parseJsonResponse` internally (e.g. analysis prompt processing), so the
 * source has not been ejected.
 *
 * Sync obligation: if those helpers change in core, update this file to match.
 */
import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';
import { tryReadTranslatorConfig } from '@/infrastructure/ticker/config';
import type { TranslatorEntry } from '@/infrastructure/ticker/types';

const MARKDOWN_CODE_BLOCK_PATTERN = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;

function stripMarkdownCodeBlock(text: string): string {
    const match = MARKDOWN_CODE_BLOCK_PATTERN.exec(text.trim());
    return match ? match[1].trim() : text.trim();
}

function parseJsonResponse(text: string, source: string): unknown {
    try {
        return JSON.parse(stripMarkdownCodeBlock(text));
    } catch (error) {
        throw new Error(`Failed to parse ${source} response as JSON`, {
            cause: error,
        });
    }
}

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
