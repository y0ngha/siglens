import { toProviderTurns } from '@/infrastructure/ai/utils';
import type {
    AiContents,
    CallAiProviderOptions,
    ModelSpec,
} from '@y0ngha/siglens-core';
import { MODEL_SPECS } from '@y0ngha/siglens-core';
import OpenAI from 'openai';

// apiModelId로 ModelSpec을 역방향 조회한다.
function findSpecByApiModelId(apiModelId: string): ModelSpec | undefined {
    return (Object.values(MODEL_SPECS) as ModelSpec[]).find(
        s => s.apiModelId === apiModelId
    );
}

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
    serverApiKey,
    model,
    contents,
    systemInstruction,
}: CallAiProviderOptions): Promise<string> {
    const spec = findSpecByApiModelId(model);
    if (!spec) {
        throw new Error(`Unknown model: ${model}`);
    }
    const client = new OpenAI({ apiKey: serverApiKey });

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

    const text = response.output_text;
    if (!text) {
        throw new Error('OpenAI returned no text content');
    }
    return text;
}
