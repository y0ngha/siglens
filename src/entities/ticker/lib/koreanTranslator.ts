import { DISABLED_THINKING_BUDGET } from '@y0ngha/siglens-core';
import { callGeminiChat, parseJsonResponse } from '@/entities/llm-provider';
import { tryReadTranslatorConfig } from './config';
import type { TranslatorConfig, TranslatorEntry } from '../model';

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
 * Calls Gemini with the server translation key.
 *
 * Always uses `DISABLED_THINKING_BUDGET` (0) — these are simple, deterministic
 * translation tasks (company name / description → Korean) that gain no
 * quality benefit from extended thinking, so an explicit 0 is worth it for
 * lower latency and a deterministic response shape. This is NOT a token/cost
 * saving in general: `config.ts`'s live-measured table shows that on
 * `gemini-2.5-flash-lite` — the model actually configured in production —
 * an explicit `thinkingBudget: 0` costs slightly MORE total tokens (54) than
 * omitting `thinkingConfig` entirely (48); only `gemini-2.5-flash` shows the
 * opposite (0 costs far less than the omitted default). `config.ts` validates
 * `TRANSLATE_MODEL` against `GEMINI_MODELS_SUPPORTING_DISABLED_THINKING` so
 * only a model that is live-verified to accept `thinkingBudget: 0` ever
 * reaches this call — an unsupported model would otherwise reject the literal
 * 0 with a 400 ("This model only works in thinking mode").
 */
async function callTranslateGemini(
    config: TranslatorConfig,
    contents: string
): Promise<string> {
    return callGeminiChat({
        apiKey: config.apiKey,
        // Distinguishes translator spend from chat spend in `[Usage]` telemetry.
        jobId: 'translate',
        model: config.model,
        contents,
        thinkingBudget: DISABLED_THINKING_BUDGET,
    });
}

export async function translateCompanyNames(
    entries: readonly TranslatorEntry[]
): Promise<Record<string, string>> {
    if (entries.length === 0) return {};

    const config = tryReadTranslatorConfig();
    if (!config) return {};

    try {
        const text = await callTranslateGemini(
            config,
            buildTranslatePrompt(entries)
        );
        const parsed = parseJsonResponse(text, 'koreanTranslator');
        return isStringRecord(parsed) ? parsed : {};
    } catch (error) {
        // 우아한 디그레이드는 유지한다(호출자는 빈 객체를 받아 영어 이름으로
        // 진행) — 다만 조용히 삼키기만 하면 잘못된 TRANSLATE_MODEL이나
        // API 장애가 알람/로그 없이 한국어 이름을 전면 제거해버린다
        // (검색·자산정보·재무 탭에서 관측 불가). model/entries count를
        // 함께 남겨 어떤 요청이 실패했는지 진단 가능하게 한다.
        console.error('[koreanTranslator] translateCompanyNames failed', {
            model: config.model,
            entryCount: entries.length,
            error,
        });
        return {};
    }
}

export async function translateCompanyDescription(
    description: string
): Promise<string | null> {
    const config = tryReadTranslatorConfig();
    if (!config) return null;

    try {
        const text = await callTranslateGemini(
            config,
            buildDescriptionTranslatePrompt(description)
        );
        return text.trim() || null;
    } catch (error) {
        // See translateCompanyNames above — same rationale for logging before
        // degrading to null (fundamental/asset-info pages fall back to the
        // English description silently otherwise).
        console.error('[koreanTranslator] translateCompanyDescription failed', {
            model: config.model,
            descriptionLength: description.length,
            error,
        });
        return null;
    }
}
