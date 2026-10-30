import { describe, expect, it } from 'vitest';
import {
    conversationIdOf,
    isOtherConversation,
    livePath,
} from '@/widgets/agent-chat/utils/conversationRoute';

describe('conversationRoute', () => {
    describe('conversationIdOf', () => {
        it('reads the id from a bare conversation path', () => {
            expect(conversationIdOf('/c/abc123')).toBe('abc123');
        });

        it('reads the id from a locale-prefixed path', () => {
            expect(conversationIdOf('/en/c/xyz')).toBe('xyz');
        });

        it('stops the id at a query string', () => {
            expect(conversationIdOf('/c/abc?x=1')).toBe('abc');
        });

        it('stops the id at a hash', () => {
            expect(conversationIdOf('/c/abc#top')).toBe('abc');
        });

        it('stops the id at a following path segment', () => {
            expect(conversationIdOf('/c/abc/extra')).toBe('abc');
        });

        it('returns null for the new-conversation root', () => {
            expect(conversationIdOf('/')).toBeNull();
        });

        it('returns null when the id segment is empty', () => {
            expect(conversationIdOf('/c/')).toBeNull();
        });
    });

    describe('isOtherConversation', () => {
        it('is true for a different conversation', () => {
            expect(isOtherConversation('b', 'a')).toBe(true);
        });

        it('is true when going to a conversation from the new-conversation screen', () => {
            expect(isOtherConversation('b', null)).toBe(true);
        });

        it('is false for the conversation already open', () => {
            expect(isOtherConversation('a', 'a')).toBe(false);
        });

        it('is false for a navigation to a new conversation', () => {
            expect(isOtherConversation(null, 'a')).toBe(false);
        });

        it('is false when both are the new-conversation screen', () => {
            expect(isOtherConversation(null, null)).toBe(false);
        });
    });

    describe('livePath', () => {
        it('uses the server path when no conversation was created locally', () => {
            expect(livePath('/en', '/en/c/server', null)).toBe('/en/c/server');
        });

        it('uses the locally created conversation with the locale prefix', () => {
            expect(livePath('/en', '/en', 'local1')).toBe('/en/c/local1');
        });

        it('works with an empty locale prefix', () => {
            expect(livePath('', '/', 'local1')).toBe('/c/local1');
        });
    });
});
