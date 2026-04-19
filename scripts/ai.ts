import { callGemini, MAX_TOKENS_CODE } from '../worker/src/gemini.js';

// Fixed fallback steps after the initial budget. Values must be strictly decreasing.
const BUDGET_FALLBACK_STEPS = [8192, 4096, 2048, 0] as const;

const DEFAULT_THINKING_BUDGET = 24576;

function isMaxTokensError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === MAX_TOKENS_CODE
    );
}

function getThinkingBudgetSequence(initial: number): number[] {
    // Always start with initial, then use fixed fallback steps that are strictly smaller.
    const candidates = [initial, Math.floor(initial / 2), ...BUDGET_FALLBACK_STEPS];
    const result: number[] = [];
    for (const budget of candidates) {
        if (result.length === 0 || budget < result[result.length - 1]) {
            result.push(budget);
        }
    }
    return result;
}

async function callGeminiReducingBudget(
    prompt: string,
    apiKey: string,
    model: string,
    thinkingBudget = 16000,
    signal?: AbortSignal
): Promise<string> {
    const budgets = getThinkingBudgetSequence(thinkingBudget);
    for (const budget of budgets) {
        try {
            return await callGemini(prompt, {
                apiKey,
                model,
                thinking: budget > 0,
                thinkingBudget: budget,
                signal,
            });
        } catch (error) {
            if (isMaxTokensError(error)) {
                const idx = budgets.indexOf(budget);
                const next = budgets[idx + 1];
                if (next !== undefined) {
                    console.warn(
                        `[ai] MAX_TOKENS (thinkingBudget=${budget}). Retrying with budget=${next}.`
                    );
                    continue;
                }
                throw error;
            }
            throw error;
        }
    }
    throw new Error('All thinking budget steps exhausted');
}

/**
 * Script-mode Gemini call with MAX_TOKENS budget reduction.
 * Accepts explicit apiKey/model — no config dependency.
 */
export async function callGeminiScript(
    prompt: string,
    apiKey: string,
    model: string,
    signal?: AbortSignal
): Promise<string> {
    return callGeminiReducingBudget(prompt, apiKey, model, DEFAULT_THINKING_BUDGET, signal);
}
