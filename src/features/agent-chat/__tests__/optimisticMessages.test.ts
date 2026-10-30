import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    localMessageId,
    optimisticUserMessage,
} from '@/features/agent-chat/lib/optimisticMessages';

afterEach(() => vi.restoreAllMocks());

describe('localMessageId', () => {
    it('gives two ids made in the same millisecond different values', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
        expect(localMessageId('local')).not.toBe(localMessageId('local'));
    });

    it('starts with the given prefix and the current time', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
        expect(localMessageId('pending')).toMatch(
            /^pending-1700000000000-\d+$/
        );
    });
});

describe('optimisticUserMessage', () => {
    it('builds a completed user bubble with no tools', () => {
        expect(optimisticUserMessage('AAPL 얼마야')).toMatchObject({
            role: 'user',
            content: 'AAPL 얼마야',
            tools: [],
            status: 'complete',
        });
    });

    it('has no seq until the server stores the question', () => {
        expect(optimisticUserMessage('AAPL 얼마야')).not.toHaveProperty('seq');
    });
});
