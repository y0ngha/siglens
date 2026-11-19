import { describe, expect, it } from 'vitest';
import { dropSentPayloads } from '@/features/agent-chat/lib/dropSentPayloads';
import type {
    AgentUiMessage,
    ChatImageAttachment,
} from '@/features/agent-chat/model/types';

const image = (id: string): ChatImageAttachment => ({
    id,
    src: `blob:${id}`,
    width: 10,
    height: 8,
    payload: { mediaType: 'image/jpeg', data: 'AAAA' },
});

const user = (id: string, images: ChatImageAttachment[]): AgentUiMessage => ({
    id,
    role: 'user',
    content: id,
    tools: [],
    status: 'complete',
    images,
});

const assistant: AgentUiMessage = {
    id: 'a',
    role: 'assistant',
    content: '답',
    tools: [],
    status: 'complete',
};

describe('dropSentPayloads', () => {
    it('회원: 모든 사용자 메시지에서 payload를 덜고 나머지 필드는 그대로 둔다', () => {
        const result = dropSentPayloads(
            [user('u1', [image('a')]), assistant, user('u2', [image('b')])],
            false
        );
        expect(result[0]?.images).toEqual([
            { id: 'a', src: 'blob:a', width: 10, height: 8 },
        ]);
        expect(result[2]?.images).toEqual([
            { id: 'b', src: 'blob:b', width: 10, height: 8 },
        ]);
        expect(result[0]?.images?.[0]).not.toHaveProperty('payload');
    });

    it('게스트: 마지막 사용자 메시지의 payload만 남긴다(재생성이 다시 보낸다)', () => {
        const last = user('u2', [image('b')]);
        const result = dropSentPayloads(
            [user('u1', [image('a')]), assistant, last, assistant],
            true
        );
        expect(result[0]?.images?.[0]).not.toHaveProperty('payload');
        expect(result[2]).toBe(last);
        expect(result[2]?.images?.[0]?.payload).toBeDefined();
    });

    it('덜어낼 payload가 없으면 같은 참조를 돌려준다', () => {
        const stored = user('u', [{ id: 's', src: '/x', width: 1, height: 1 }]);
        expect(dropSentPayloads([stored, assistant], false)[0]).toBe(stored);
    });
});
