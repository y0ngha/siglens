import { describe, expect, it } from 'vitest';
import type { AgentUiMessage } from '../hooks/useAgentStream';
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
});
