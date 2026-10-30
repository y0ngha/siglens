import { describe, expect, it } from 'vitest';
import { isAgentRemaining } from '@/features/agent-chat/lib/wireGuards';

describe('isAgentRemaining', () => {
    it('accepts numeric and null (uncapped) counters', () => {
        expect(isAgentRemaining({ turns: 3, fresh: 0, search: null })).toBe(
            true
        );
    });

    it.each([
        null,
        'x',
        [],
        {},
        { turns: 1, fresh: 1 },
        { turns: '1', fresh: 1, search: 1 },
        { turns: 1, fresh: undefined, search: 1 },
    ])('rejects %j', value => {
        expect(isAgentRemaining(value)).toBe(false);
    });
});
