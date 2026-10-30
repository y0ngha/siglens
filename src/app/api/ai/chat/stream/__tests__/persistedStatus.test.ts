import { describe, expect, it } from 'vitest';
import type { AgentErrorCode } from '@y0ngha/siglens-core';
import { persistedStatusFor } from '@/app/api/ai/chat/stream/_lib/persistedStatus';

describe('persistedStatusFor', () => {
    it.each(['aborted', 'deadline'] as const)('%s는 aborted', code => {
        expect(persistedStatusFor(code)).toBe('aborted');
    });

    it.each([
        'turn_limit',
        'premium_turn_limit',
        'rate_limited',
        'server_busy',
        'server_error',
    ] as const)('%s는 error', code => {
        expect(persistedStatusFor(code)).toBe('error');
    });

    it('알 수 없는 코드는 던진다', () => {
        expect(() => persistedStatusFor('nope' as AgentErrorCode)).toThrow(
            'unhandled AgentErrorCode: nope'
        );
    });
});
