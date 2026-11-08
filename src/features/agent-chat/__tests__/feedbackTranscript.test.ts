import type { AgentUiMessage } from '../model/types';
import {
    buildFeedbackContext,
    buildFeedbackTranscript,
} from '../lib/feedbackTranscript';

function msg(
    partial: Partial<AgentUiMessage> & Pick<AgentUiMessage, 'id' | 'role'>
) {
    return {
        content: '',
        tools: [],
        status: 'complete',
        ...partial,
    } satisfies AgentUiMessage;
}

describe('buildFeedbackTranscript', () => {
    const messages: AgentUiMessage[] = [
        msg({ id: 'u1', role: 'user', content: '애플 어때?' }),
        msg({
            id: 'a1',
            role: 'assistant',
            content: '상승 추세입니다.',
            tools: [
                {
                    id: 't1',
                    name: 'get_quote',
                    args: { symbol: 'AAPL' },
                    status: 'ok',
                    summary: 'AAPL 시세',
                },
                { id: 't2', name: 'get_news', args: {}, status: 'ok' },
            ],
        }),
        msg({ id: 'u2', role: 'user', content: '그럼 테슬라는?' }),
        msg({ id: 'a2', role: 'assistant', content: '횡보 중입니다.' }),
    ];

    it('평가한 답변까지만 담고 그 뒤는 뺀다', () => {
        const transcript = buildFeedbackTranscript(messages, 1);

        expect(transcript.map(entry => entry.role)).toEqual([
            'user',
            'assistant',
        ]);
        expect(transcript.at(-1)?.content).toBe('상승 추세입니다.');
    });

    it('도구는 이름과 요약만 싣고 인자는 싣지 않는다', () => {
        const transcript = buildFeedbackTranscript(messages, 1);

        expect(transcript[1]?.tools).toEqual([
            { name: 'get_quote', summary: 'AAPL 시세' },
            { name: 'get_news' },
        ]);
    });

    it('도구가 없는 턴에는 tools 키를 두지 않는다', () => {
        const transcript = buildFeedbackTranscript(messages, 3);

        expect(transcript.at(-1)).toEqual({
            role: 'assistant',
            content: '횡보 중입니다.',
        });
    });

    it('내용이 빈 말풍선은 뺀다', () => {
        const withEmpty = [
            ...messages.slice(0, 2),
            msg({ id: 'a-empty', role: 'assistant', status: 'error' }),
            msg({ id: 'a3', role: 'assistant', content: '다시 답합니다.' }),
        ];

        const transcript = buildFeedbackTranscript(withEmpty, 3);

        expect(transcript.map(entry => entry.content)).toEqual([
            '애플 어때?',
            '상승 추세입니다.',
            '다시 답합니다.',
        ]);
    });
});

describe('buildFeedbackContext', () => {
    const answer = msg({
        id: '7b1d6a52-0000-4000-8000-000000000001',
        role: 'assistant',
        content: '답',
    });

    it('회원 답변은 대화와 메시지 id를 싣는다', () => {
        expect(
            buildFeedbackContext({
                message: answer,
                index: 3,
                conversationId: 'conv-1',
                guest: false,
            })
        ).toEqual({
            guest: false,
            messageIndex: 3,
            conversationId: 'conv-1',
            messageId: answer.id,
        });
    });

    it('임시 id는 보내지 않는다', () => {
        const context = buildFeedbackContext({
            message: { ...answer, id: 'pending-1700000000000-4' },
            index: 1,
            conversationId: 'conv-1',
            guest: false,
        });

        expect(context).not.toHaveProperty('messageId');
        expect(context.conversationId).toBe('conv-1');
    });

    it('비회원은 id 없이 guest 표시만 남긴다', () => {
        expect(
            buildFeedbackContext({
                message: { ...answer, id: 'pending-1-1' },
                index: 1,
                conversationId: null,
                guest: true,
            })
        ).toEqual({ guest: true, messageIndex: 1 });
    });

    it('비회원이면 서버가 준 id가 있어도 대화 id를 싣지 않는다', () => {
        const context = buildFeedbackContext({
            message: answer,
            index: 0,
            conversationId: 'conv-x',
            guest: true,
        });

        expect(context).not.toHaveProperty('conversationId');
        expect(context).not.toHaveProperty('messageId');
    });
});
