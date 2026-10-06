import { describe, expect, it } from 'vitest';
import type { AgentUiMessage } from '../model/types';
import { guestHistory } from '../lib/guestHistory';

const msg = (v: Partial<AgentUiMessage>): AgentUiMessage => ({
    id: 'x',
    role: 'user',
    content: '',
    tools: [],
    status: 'complete',
    ...v,
});

describe('guestHistory', () => {
    it('drops empty (whitespace-only) content', () => {
        expect(
            guestHistory([
                msg({ role: 'user', content: '   ' }),
                msg({ role: 'assistant', content: 'hi' }),
            ])
        ).toEqual([{ role: 'assistant', content: 'hi' }]);
    });

    it('drops errored assistant bubbles but keeps user messages', () => {
        expect(
            guestHistory([
                msg({ role: 'user', content: 'q', status: 'error' }),
                msg({ role: 'assistant', content: 'failed', status: 'error' }),
                msg({ role: 'assistant', content: 'ok', status: 'complete' }),
            ])
        ).toEqual([
            { role: 'user', content: 'q' },
            { role: 'assistant', content: 'ok' },
        ]);
    });

    it('maps to role/content only — drops id/tools/status', () => {
        const out = guestHistory([
            msg({
                id: 'a1',
                role: 'user',
                content: 'q',
                tools: [{ id: 't', name: 'x', args: {}, status: 'ok' }],
                status: 'complete',
            }),
        ]);
        expect(out).toEqual([{ role: 'user', content: 'q' }]);
        expect(Object.keys(out[0]!)).toEqual(['role', 'content']);
    });

    it('답변의 후속 질문 항목은 함께 보낸다 (서버가 마커 줄을 되붙인다)', () => {
        expect(
            guestHistory([
                msg({ role: 'user', content: 'q' }),
                msg({
                    role: 'assistant',
                    content: 'a',
                    followUps: ['실적은?', '뉴스는?'],
                }),
                msg({ role: 'assistant', content: 'b', followUps: [] }),
            ])
        ).toEqual([
            { role: 'user', content: 'q' },
            {
                role: 'assistant',
                content: 'a',
                followUps: ['실적은?', '뉴스는?'],
            },
            { role: 'assistant', content: 'b' },
        ]);
    });
});
