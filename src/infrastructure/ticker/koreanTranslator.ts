import { GoogleGenAI } from '@google/genai';
import { stripMarkdownCodeBlock } from '@/infrastructure/ai/utils';

const DEFAULT_TRANSLATE_MODEL = 'gemini-2.5-flash';

interface TranslateEntry {
    symbol: string;
    name: string;
}

async function callTranslate(
    client: GoogleGenAI,
    model: string,
    prompt: string
): Promise<Record<string, string>> {
    const result = await client.models.generateContent({
        model,
        contents: prompt,
    });
    const text = result.text ?? '';
    // JSON.parse returns `any`; type guard for Record<string, string> is not feasible
    return JSON.parse(stripMarkdownCodeBlock(text)) as Record<string, string>;
}

export async function translateCompanyNames(
    entries: TranslateEntry[]
): Promise<Record<string, string>> {
    if (entries.length === 0) return {};

    const apiKey = process.env.TRANSLATE_API_KEY;
    if (!apiKey) return {};

    const model = process.env.TRANSLATE_MODEL ?? DEFAULT_TRANSLATE_MODEL;
    const freeApiKey = process.env.TRANSLATE_FREE_API_KEY;

    const entryList = entries.map(e => `- ${e.symbol}: ${e.name}`).join('\n');

    const prompt = `Translate these English company names to Korean (한국에서 통용되는 한국어 이름 또는 음역).
Return ONLY a JSON object mapping symbol to Korean name. Example: {"AAPL":"애플","NVDA":"엔비디아"}

Companies:
${entryList}`;

    try {
        if (freeApiKey) {
            try {
                return await callTranslate(
                    new GoogleGenAI({ apiKey: freeApiKey }),
                    model,
                    prompt
                );
            } catch {
                console.warn(
                    '[koreanTranslator] Free API key failed. Switching to paid key.'
                );
            }
        }

        return await callTranslate(new GoogleGenAI({ apiKey }), model, prompt);
    } catch (error) {
        console.error('Korean name translation failed:', error);
        return {};
    }
}
