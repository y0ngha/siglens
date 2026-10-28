import { describe, expect, it } from 'vitest';
import {
    isSendableMessage,
    MESSAGE_MAX_CHARS,
} from '@/widgets/agent-chat/utils/messageLimits';

describe('isSendableMessage', () => {
    it('accepts ordinary text', () => {
        expect(isSendableMessage('hello')).toBe(true);
    });

    it('rejects an empty string', () => {
        expect(isSendableMessage('')).toBe(false);
    });

    it('rejects whitespace-only text', () => {
        expect(isSendableMessage(' \n\t  ')).toBe(false);
    });

    it('accepts text padded with whitespace', () => {
        expect(isSendableMessage('  hi  ')).toBe(true);
    });

    it('accepts exactly the max length', () => {
        expect(isSendableMessage('a'.repeat(MESSAGE_MAX_CHARS))).toBe(true);
    });

    it('rejects one char over the max length', () => {
        expect(isSendableMessage('a'.repeat(MESSAGE_MAX_CHARS + 1))).toBe(
            false
        );
    });

    it('measures the limit on the raw text, not the trimmed text', () => {
        const padded = 'a'.repeat(MESSAGE_MAX_CHARS) + ' ';
        expect(isSendableMessage(padded)).toBe(false);
    });
});
