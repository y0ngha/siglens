import { describe, expect, it } from 'vitest';
import {
    abortStreamingMessage,
    DRAFT_MIN_CHARS,
    followUpsOf,
    patchLastMessage,
    withDone,
    withText,
    withToolEnded,
    withToolStarted,
    withUserSeq,
} from '@/features/agent-chat/lib/agentStreamFrames';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';

function bubble(overrides: Partial<AgentUiMessage> = {}): AgentUiMessage {
    return {
        id: 'pending-1',
        role: 'assistant',
        content: '',
        tools: [],
        status: 'streaming',
        ...overrides,
    };
}

describe('followUpsOf', () => {
    it('keeps only the string items', () => {
        expect(followUpsOf(['A', 3, 'B', null])).toEqual(['A', 'B']);
    });

    it('returns no chips for a non-array value', () => {
        expect(followUpsOf('A')).toEqual([]);
    });
});

describe('withText', () => {
    it('appends the delta to the running content', () => {
        expect(withText(bubble({ content: '안녕' }), '하세요').content).toBe(
            '안녕하세요'
        );
    });
});

describe('withToolStarted', () => {
    it('drops short narration and adds a running chip', () => {
        const next = withToolStarted(bubble({ content: '확인해 볼게요' }), {
            id: 't1',
            name: 'get_quote',
            args: { symbol: 'AAPL' },
        });
        expect(next.content).toBe('');
        expect(next.draft).toBeUndefined();
        expect(next.tools).toEqual([
            {
                id: 't1',
                name: 'get_quote',
                args: { symbol: 'AAPL' },
                status: 'running',
                estimatedSeconds: undefined,
            },
        ]);
    });

    it('keeps text of at least DRAFT_MIN_CHARS as the draft', () => {
        const answer = '가'.repeat(DRAFT_MIN_CHARS);
        const next = withToolStarted(bubble({ content: answer }), {
            id: 't1',
            name: 'get_news',
        });
        expect(next.draft).toBe(answer);
    });

    it('keeps an earlier draft when the new pre-tool text is short', () => {
        const next = withToolStarted(
            bubble({ content: '짧음', draft: '이전 초안' }),
            { id: 't2', name: 'get_news' }
        );
        expect(next.draft).toBe('이전 초안');
    });

    it('defaults missing args to an empty object and keeps a numeric estimate', () => {
        const next = withToolStarted(bubble(), {
            id: 't1',
            name: 'run_fresh_analysis',
            estimatedSeconds: 40,
        });
        expect(next.tools[0]).toMatchObject({ args: {}, estimatedSeconds: 40 });
    });

    it.each([['str'], [null], [[1, 2]], [7]])(
        'treats non-object args %j as an empty object',
        args => {
            const next = withToolStarted(bubble(), {
                id: 't1',
                name: 'x',
                args,
            });
            expect(next.tools[0]?.args).toEqual({});
        }
    );
});

describe('withToolEnded', () => {
    const running = bubble({
        tools: [{ id: 't1', name: 'get_quote', args: {}, status: 'running' }],
    });

    it('settles the matching chip as ok with its duration and summary', () => {
        const next = withToolEnded(running, {
            id: 't1',
            status: 'ok',
            ms: 250,
            summary: 'AAPL 190',
        });
        expect(next.tools[0]).toMatchObject({
            status: 'ok',
            ms: 250,
            summary: 'AAPL 190',
        });
    });

    it('marks a non-ok status as error with an empty summary', () => {
        const next = withToolEnded(running, { id: 't1', status: 'fail' });
        expect(next.tools[0]).toMatchObject({ status: 'error', summary: '' });
    });

    it('leaves the chips unchanged for an unknown id', () => {
        const next = withToolEnded(running, { id: 'zz', status: 'ok' });
        expect(next.tools).toEqual(running.tools);
    });
});

describe('withDone', () => {
    it('takes the stored id, final body and follow-ups, and completes the bubble', () => {
        const next = withDone(bubble({ content: '본문\n마커', draft: 'd' }), {
            assistantMessageId: 'm9',
            body: '본문',
            followUps: ['다음 질문'],
        });
        expect(next).toMatchObject({
            id: 'm9',
            content: '본문',
            followUps: ['다음 질문'],
            draft: undefined,
            status: 'complete',
            truncated: false,
        });
    });

    it('keeps the local id when the server sends an empty assistantMessageId', () => {
        expect(withDone(bubble(), { assistantMessageId: '' }).id).toBe(
            'pending-1'
        );
    });

    it('keeps the streamed content when the frame has no body', () => {
        expect(withDone(bubble({ content: '그대로' }), {}).content).toBe(
            '그대로'
        );
    });

    it('marks a max_tokens stop as truncated', () => {
        expect(withDone(bubble(), { stopReason: 'max_tokens' }).truncated).toBe(
            true
        );
    });
});

describe('withUserSeq', () => {
    const user: AgentUiMessage = {
        id: 'local-1',
        role: 'user',
        content: 'q',
        tools: [],
        status: 'complete',
    };

    it('attaches the seq to the user bubble just before the pending answer', () => {
        expect(withUserSeq([user, bubble()], 7)[0]!.seq).toBe(7);
    });

    it('keeps a seq that is already attached', () => {
        expect(withUserSeq([{ ...user, seq: 3 }, bubble()], 7)[0]!.seq).toBe(3);
    });

    it('returns the same transcript when the slot is not a user bubble', () => {
        const messages = [bubble({ id: 'a' }), bubble()];
        expect(withUserSeq(messages, 7)).toBe(messages);
    });
});

describe('patchLastMessage', () => {
    it('applies the patch to the last bubble only', () => {
        const out = patchLastMessage(
            [bubble({ id: 'a' }), bubble({ id: 'b' })],
            m => ({ ...m, content: 'x' })
        );
        expect(out.map(m => m.content)).toEqual(['', 'x']);
    });

    it('returns an empty transcript unchanged', () => {
        const empty: AgentUiMessage[] = [];
        expect(patchLastMessage(empty, m => m)).toBe(empty);
    });
});

describe('abortStreamingMessage', () => {
    it('marks the named bubble aborted while it is still streaming', () => {
        const out = abortStreamingMessage(
            [bubble({ id: 'old' }), bubble({ id: 'new' })],
            'old'
        );
        expect(out.map(m => m.status)).toEqual(['aborted', 'streaming']);
    });

    it('leaves a settled bubble alone', () => {
        const out = abortStreamingMessage(
            [bubble({ id: 'old', status: 'complete' })],
            'old'
        );
        expect(out[0]!.status).toBe('complete');
    });
});
