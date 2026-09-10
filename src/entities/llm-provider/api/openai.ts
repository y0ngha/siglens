import 'server-only';
import { resolveReasoningConfig } from '@y0ngha/siglens-core';
import { toProviderTurns, findSpecByApiModelId } from '../lib/utils';
import type { AiContents } from '@y0ngha/siglens-core';
import type { ProviderCallOptions } from '../model';
import { CHAT_JOB_ID, extractOpenAIUsage, logUsage } from '../lib/usage';
import OpenAI from 'openai';

function toResponsesInput(
    contents: AiContents
): string | OpenAI.Responses.ResponseInput {
    if (typeof contents === 'string') {
        return contents;
    }
    // 다중 턴 대화 → Responses API EasyInputMessage 배열로 변환
    // toProviderTurns이 role: 'user'|'assistant' 로 변환해준다.
    return toProviderTurns(contents) as OpenAI.Responses.EasyInputMessage[];
}

export async function callOpenaiChat({
    apiKey,
    model,
    contents,
    systemInstruction,
    jobId = CHAT_JOB_ID,
}: ProviderCallOptions): Promise<string> {
    const spec = findSpecByApiModelId(model);
    if (!spec) {
        throw new Error(`Unknown model: ${model}`);
    }

    // 챗은 추론 토글이 없다 — 스펙 기본 상태를 그대로 쓴다(Free·Member는
    // `effort: 'none'`). provider로 좁혀야 `reasoning`이 GPT 설정으로 추론된다.
    if (spec.provider !== 'chatgpt') {
        throw new Error(`[openai] Non-ChatGPT model spec: ${model}`);
    }
    const resolvedEffort = resolveReasoningConfig(
        spec.reasoning,
        undefined
    ).effort;
    const startedAt = Date.now();
    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
        model,
        input: toResponsesInput(contents),
        ...(systemInstruction !== undefined
            ? { instructions: systemInstruction }
            : {}),
        max_output_tokens: spec.maxOutputTokens,
        // GPT 스펙은 전부 reasoning 기반이라 temperature 분기가 없다. 챗은 토글이
        // 없으므로 스펙 기본 상태를 그대로 쓴다 — Free·Member는 `effort: 'none'`.
        reasoning: { effort: resolvedEffort },
    });

    logUsage({
        jobId,
        model,
        latencyMs: Date.now() - startedAt,
        ...extractOpenAIUsage(response.usage),
    });

    const text = response.output_text;
    if (text === null || text === undefined) {
        throw new Error('[openai] Provider returned null/undefined response');
    }
    if (text === '') {
        console.warn('[openai] Provider returned empty string');
    }
    return text;
}
