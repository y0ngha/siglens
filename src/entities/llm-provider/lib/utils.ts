import type { AiContents, ConversationTurn } from '@y0ngha/siglens-core';

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
