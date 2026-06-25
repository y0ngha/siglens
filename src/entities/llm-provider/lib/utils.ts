import type {
    AiContents,
    ConversationTurn,
    ModelSpec,
} from '@y0ngha/siglens-core';
import { MODEL_SPECS } from '@y0ngha/siglens-core';

export interface ProviderTurn {
    role: 'user' | 'assistant';
    content: string;
}

export function toProviderTurns(contents: AiContents): ProviderTurn[] {
    if (typeof contents === 'string') {
        return [{ role: 'user', content: contents }];
    }
    return contents.map((turn: ConversationTurn) => ({
        role: turn.role,
        content: turn.text,
    }));
}

/**
 * apiModelId(예: 'claude-sonnet-4-6')로 ModelSpec을 역방향 조회한다.
 * anthropic.ts와 openai.ts 양쪽에서 동일하게 사용하던 로컬 함수를 통합.
 *
 * `Object.values(MODEL_SPECS)`의 반환 타입은 `ModelSpec[]`으로 넓어지므로
 * 캐스트가 필요하다. MODEL_SPECS가 IndicatorKey → ModelSpec 형태임이
 * siglens-core 타입으로 보장되므로 안전한 캐스트다.
 */
export function findSpecByApiModelId(
    apiModelId: string
): ModelSpec | undefined {
    return (Object.values(MODEL_SPECS) as ModelSpec[]).find(
        s => s.apiModelId === apiModelId
    );
}
