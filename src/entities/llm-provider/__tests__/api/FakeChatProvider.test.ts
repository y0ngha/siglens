import { describe, it, expect } from 'vitest';
import type {
    CallAiProviderOptions,
    ConversationTurn,
} from '@y0ngha/siglens-core';
import { fakeCallAiProvider } from '../../api/FakeChatProvider';

// Minimal options factory: only `contents` + `model` matter to the fake; the
// key fields are unused (the fake reads no API keys by design).
function makeOptions(
    contents: CallAiProviderOptions['contents'],
    model = 'gemini-2.5-flash'
): CallAiProviderOptions {
    return {
        contents,
        model,
        userApiKey: undefined,
        serverApiKey: undefined,
    };
}

describe('fakeCallAiProvider', () => {
    it('echoes a plain string prompt and references the model', async () => {
        const reply = await fakeCallAiProvider(
            makeOptions('테슬라 어때?', 'gpt-5.5')
        );

        expect(reply).toContain('[E2E gpt-5.5]');
        expect(reply).toContain('"테슬라 어때?"');
        expect(reply).toContain('테스트 답변입니다');
    });

    it('extracts the last user turn from a conversation history', async () => {
        const contents: ConversationTurn[] = [
            { role: 'user', text: '첫 질문' },
            { role: 'assistant', text: '첫 답변' },
            { role: 'user', text: '마지막 질문' },
            { role: 'assistant', text: '마지막 답변' },
        ];

        const reply = await fakeCallAiProvider(makeOptions(contents));

        // Echoes the LAST user turn, not the assistant's reply or an earlier turn.
        expect(reply).toContain('"마지막 질문"');
        expect(reply).not.toContain('마지막 답변');
        expect(reply).not.toContain('"첫 질문"');
    });

    it('falls back to the placeholder when contents is an empty array', async () => {
        const reply = await fakeCallAiProvider(makeOptions([]));

        // No user text available → '방금 질문' placeholder (no quotes added).
        expect(reply).toContain('방금 질문');
        expect(reply).not.toContain('""');
    });

    it('falls back to the placeholder when no user turn exists', async () => {
        const contents: ConversationTurn[] = [
            { role: 'assistant', text: '어시스턴트만 있는 히스토리' },
        ];

        const reply = await fakeCallAiProvider(makeOptions(contents));

        expect(reply).toContain('방금 질문');
        expect(reply).not.toContain('어시스턴트만');
    });
});
