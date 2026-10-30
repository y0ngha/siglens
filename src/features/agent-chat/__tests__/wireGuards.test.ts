import { describe, expect, it } from 'vitest';
import {
    isAgentRemaining,
    isRecord,
} from '@/features/agent-chat/lib/wireGuards';

describe('isRecord', () => {
    it('accepts plain objects', () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord({ a: 1 })).toBe(true);
    });

    it.each([null, undefined, [], [1], 'x', 3, true])('rejects %j', value => {
        expect(isRecord(value)).toBe(false);
    });
});

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
