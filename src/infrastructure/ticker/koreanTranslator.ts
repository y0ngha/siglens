import { GoogleGenerativeAI } from '@google/generative-ai';
import { stripMarkdownCodeBlock } from '@/infrastructure/ai/utils';

const DEFAULT_TRANSLATE_MODEL = 'gemini-2.5-flash';

interface TranslateEntry {
    symbol: string;
    name: string;
}

export async function translateCompanyNames(
    entries: TranslateEntry[]
): Promise<Record<string, string>> {
    if (entries.length === 0) return {};

    const apiKey = process.env.TRANSLATE_API_KEY;
    if (!apiKey) return {};

    const model = process.env.TRANSLATE_MODEL ?? DEFAULT_TRANSLATE_MODEL;

    const entryList = entries.map(e => `- ${e.symbol}: ${e.name}`).join('\n');

    const prompt = `Translate these English company names to Korean (한국에서 통용되는 한국어 이름 또는 음역).
Return ONLY a JSON object mapping symbol to Korean name. Example: {"AAPL":"애플","NVDA":"엔비디아"}

Companies:
${entryList}`;

    try {
        const client = new GoogleGenerativeAI(apiKey);
        const genModel = client.getGenerativeModel({ model });
        const result = await genModel.generateContent(prompt);
        const text = result.response.text();
        return JSON.parse(stripMarkdownCodeBlock(text)) as Record<
            string,
            string
        >;
    } catch (error) {
        console.error('Korean name translation failed:', error);
        return {};
    }
}
