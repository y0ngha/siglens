import 'server-only';
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
    const startedAt = Date.now();
    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
        model,
        input: toResponsesInput(contents),
        ...(systemInstruction !== undefined
            ? { instructions: systemInstruction }
            : {}),
        max_output_tokens: spec.maxOutputTokens,
        ...(spec.effort === undefined && {
            temperature: spec.temperature,
        }),
        ...(spec.effort !== undefined && {
            reasoning: { effort: spec.effort },
        }),
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
