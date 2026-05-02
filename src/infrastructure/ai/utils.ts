import type { AiContents, GeminiContent } from '@y0ngha/siglens-core';

export interface ProviderTurn {
    role: 'user' | 'assistant';
    content: string;
}

// Converts AiContents to provider-neutral user/assistant turns shared by all AI adapters.
export function toProviderTurns(contents: AiContents): ProviderTurn[] {
    if (typeof contents === 'string') {
        return [{ role: 'user', content: contents }];
    }
    return contents.map((turn: GeminiContent) => ({
        role:
            turn.role === 'model' ? ('assistant' as const) : ('user' as const),
        content: turn.parts.map(p => p.text ?? '').join(''),
    }));
}
