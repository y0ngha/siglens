import type { AiContents, GeminiContent } from '@y0ngha/siglens-core';

export interface ProviderTurn {
    role: 'user' | 'assistant';
    content: string;
}

export function toProviderTurns(contents: AiContents): ProviderTurn[] {
    if (typeof contents === 'string') {
        return [{ role: 'user', content: contents }];
    }
    return contents.map((turn: GeminiContent) => ({
        role: turn.role === 'model' ? 'assistant' : 'user',
        content: turn.parts.map(p => p.text ?? '').join(''),
    }));
}
