import 'server-only';
import { callDeepseekChat, parseJsonResponse } from '@/entities/llm-provider';
import { tryReadTranslatorConfig } from './config';
import type { TranslatorConfig, TranslatorEntry } from '../model';

function buildTranslatePrompt(entries: readonly TranslatorEntry[]): string {
    const entryList = entries.map(e => `- ${e.symbol}: ${e.name}`).join('\n');
    return `Translate these English company names to Korean (한국에서 통용되는 한국어 이름 또는 음역).
Return ONLY a JSON object mapping symbol to Korean name. Example: {"AAPL":"애플","NVDA":"엔비디아"}
Do not wrap the JSON in markdown code fences and do not add any explanation.

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
 * Calls DeepSeek with the server key (`DEEPSEEK_API_KEY` — see
 * `tryReadTranslatorConfig`).
 *
 * Reasoning is off, but nothing is passed here to turn it off:
 * `callDeepseekChat` derives `thinking` from `MODEL_SPECS[model].thinking`,
 * and `config.ts` defaults to `deepseek-v4-flash` whose spec has it `false`.
 * That is the intent — company name / description → Korean is a deterministic
 * transformation with no quality gain from extended thinking, only latency
 * and cost. (The old Gemini path had to send an explicit `thinkingBudget: 0`
 * for the same effect, plus an allow-list of models that accepted the literal
 * 0; DeepSeek needs neither.)
 *
 * ⚠️ The chat adapter deliberately does NOT set
 * `response_format: { type: 'json_object' }` — it is shared with the chatbot,
 * which must emit prose. `translateCompanyNames` therefore relies on the
 * prompt asking for bare JSON plus `parseJsonResponse`'s fence-stripping and
 * `jsonrepair` salvage. A malformed response degrades to `{}` (English names)
 * rather than throwing.
 */
async function callTranslateDeepseek(
    config: TranslatorConfig,
    contents: string
): Promise<string> {
    return callDeepseekChat({
        apiKey: config.apiKey,
        // Distinguishes translator spend from chat spend in `[Usage]` telemetry.
        jobId: 'translate',
        model: config.model,
        contents,
    });
}

export async function translateCompanyNames(
    entries: readonly TranslatorEntry[]
): Promise<Record<string, string>> {
    if (entries.length === 0) return {};

    const config = tryReadTranslatorConfig();
    if (!config) return {};

    try {
        const text = await callTranslateDeepseek(
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
        const text = await callTranslateDeepseek(
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
