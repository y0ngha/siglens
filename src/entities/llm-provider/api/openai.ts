import 'server-only';
import OpenAI from 'openai';
import type { AiContents } from '@y0ngha/siglens-core';
import { resolveReasoningConfig } from '@y0ngha/siglens-core';
import {
    findSpecByApiModelId,
    resolveMaxOutputTokens,
    toProviderTurns,
    toSdkTransportOptions,
} from '../lib/utils';
import type { ProviderCallOptions } from '../model';
import { CHAT_JOB_ID, extractOpenAIUsage } from '../lib/usage';
import {
    createCallDeadline,
    runWithCallDeadline,
    toDeadlineRequestOptions,
} from './callDeadline';
import { logUsage } from './logUsage';

function toResponsesInput(
    contents: AiContents
): string | OpenAI.Responses.ResponseInput {
    return typeof contents === 'string' ? contents : toProviderTurns(contents);
}

/**
 * OpenAI Responses API로 챗 한 번을 부르고 `output_text`를 돌려준다.
 * 챗은 추론 토글이 없다 — 스펙 기본 상태를 그대로 쓴다(Free·Member는 `effort: 'none'`).
 * `limits.timeoutMs`는 응답 본문까지 묶는다(SDK timeout은 헤더 도착까지만 잰다).
 */
export async function callOpenaiChat({
    apiKey,
    model,
    contents,
    systemInstruction,
    jobId = CHAT_JOB_ID,
    limits,
}: ProviderCallOptions): Promise<string> {
    const spec = findSpecByApiModelId(model);
    if (!spec) {
        throw new Error(`Unknown model: ${model}`);
    }
    // provider로 좁혀야 `reasoning`이 GPT 설정으로 추론된다.
    if (spec.provider !== 'chatgpt') {
        throw new Error(`[openai] Non-ChatGPT model spec: ${model}`);
    }
    const resolvedEffort = resolveReasoningConfig(
        spec.reasoning,
        undefined
    ).effort;
    const startedAt = Date.now();
    const client = new OpenAI({ apiKey, ...toSdkTransportOptions(limits) });

    const deadline = createCallDeadline(limits?.timeoutMs);
    // 요청 생성이 던져도 타이머가 남지 않도록 생성까지 `runWithCallDeadline` 안에서 한다.
    const response = await runWithCallDeadline(deadline, () =>
        client.responses.create(
            {
                model,
                input: toResponsesInput(contents),
                ...(systemInstruction !== undefined
                    ? { instructions: systemInstruction }
                    : {}),
                max_output_tokens: resolveMaxOutputTokens(
                    spec.maxOutputTokens,
                    limits
                ),
                // GPT 스펙은 전부 reasoning 기반이라 temperature 분기가 없다.
                reasoning: { effort: resolvedEffort },
            },
            toDeadlineRequestOptions(deadline)
        )
    );

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
