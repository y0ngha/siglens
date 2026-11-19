import { describe, expect, it } from 'vitest';
import type { ChatMessageView } from '@/entities/chat-conversation/model';
import { fromViews } from '@/features/agent-chat/lib/fromViews';
import { guestHistory } from '@/features/agent-chat/lib/guestHistory';
import { optimisticUserMessage } from '@/features/agent-chat/lib/optimisticMessages';
import type {
    AgentUiMessage,
    ChatImageAttachment,
} from '@/features/agent-chat/model/types';

const attachment: ChatImageAttachment = {
    id: 'a',
    src: 'blob:a',
    width: 1,
    height: 1,
    payload: { mediaType: 'image/jpeg', data: 'AAAA' },
};

const ui = (over: Partial<AgentUiMessage>): AgentUiMessage => ({
    id: 'x',
    role: 'user',
    content: '',
    tools: [],
    status: 'complete',
    ...over,
});

describe('guestHistory — 이미지', () => {
    it('이미지가 있던 user 메시지는 imageCount를 싣고 글이 비어도 남긴다', () => {
        expect(
            guestHistory([
                ui({ content: '이거 어때?', images: [attachment, attachment] }),
                ui({ id: 'y', content: '', images: [attachment] }),
                ui({ id: 'z', content: '' }),
            ])
        ).toEqual([
            { role: 'user', content: '이거 어때?', imageCount: 2 },
            { role: 'user', content: '', imageCount: 1 },
        ]);
    });

    it('이미지 payload는 기록에 싣지 않는다', () => {
        const [entry] = guestHistory([
            ui({ content: 'q', images: [attachment] }),
        ]);
        expect(JSON.stringify(entry)).not.toContain('AAAA');
    });
});

describe('fromViews — 이미지', () => {
    const view = (images?: ChatMessageView['images']): ChatMessageView => ({
        id: 'u1',
        seq: 1,
        role: 'user',
        content: 'q',
        toolCalls: null,
        toolName: null,
        status: 'complete',
        createdAt: '2026-11-19T00:00:00.000Z',
        ...(images ? { images } : {}),
    });

    it('저장된 이미지를 조회 경로 src로 매핑하고 payload는 두지 않는다', () => {
        const [message] = fromViews([
            view([{ id: 'img-1', width: 3, height: 2 }]),
        ]);
        expect(message?.images).toEqual([
            {
                id: 'img-1',
                width: 3,
                height: 2,
                src: '/api/ai/chat/images/img-1',
            },
        ]);
        expect(message?.images?.[0]).not.toHaveProperty('payload');
    });

    it('이미지가 없으면 images 키가 없다', () => {
        expect(fromViews([view()])[0]).not.toHaveProperty('images');
    });
});

describe('optimisticUserMessage — 이미지', () => {
    it('이미지를 달고, 없으면 키를 두지 않는다', () => {
        expect(optimisticUserMessage('q', [attachment]).images).toEqual([
            attachment,
        ]);
        expect(optimisticUserMessage('q')).not.toHaveProperty('images');
    });
});
