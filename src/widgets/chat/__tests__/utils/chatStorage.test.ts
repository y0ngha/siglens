// @vitest-environment jsdom
import type { ChatMessage } from '@y0ngha/siglens-core';

import {
    buildStorageKey,
    loadSession,
    loadSessionFull,
    saveSession,
    CHAT_HISTORY_TTL_MS,
    MAX_STORED_MESSAGES,
} from '../../utils/chatStorage';

function makeMessage(role: 'user' | 'model', content: string): ChatMessage {
    return { role, content };
}

describe('chatStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('buildStorageKey', () => {
        it('builds an uppercase key combining symbol and timeframe', () => {
            const key = buildStorageKey('aapl', '1Day');
            expect(key).toBe('siglens_chat_AAPL_1Day');
        });
    });

    describe('loadSession', () => {
        it('returns empty array when no stored data', () => {
            expect(loadSession('nonexistent')).toEqual([]);
        });

        it('returns stored messages within TTL', () => {
            const messages: ChatMessage[] = [
                makeMessage('user', 'hello'),
                makeMessage('model', 'hi'),
            ];
            const session = {
                messages,
                savedAt: Date.now(),
            };
            localStorage.setItem('test-key', JSON.stringify(session));

            expect(loadSession('test-key')).toEqual(messages);
        });

        it('returns empty array and removes item when TTL expired', () => {
            const session = {
                messages: [makeMessage('user', 'old')],
                savedAt: Date.now() - CHAT_HISTORY_TTL_MS - 1,
            };
            localStorage.setItem('expired-key', JSON.stringify(session));

            expect(loadSession('expired-key')).toEqual([]);
            expect(localStorage.getItem('expired-key')).toBeNull();
        });

        it('returns empty array for corrupted JSON', () => {
            localStorage.setItem('corrupt', 'not json');

            expect(loadSession('corrupt')).toEqual([]);
        });
    });

    describe('loadSessionFull', () => {
        it('returns messages and savedAt for valid session', () => {
            const now = Date.now();
            const messages: ChatMessage[] = [makeMessage('user', 'q')];
            localStorage.setItem(
                'full-key',
                JSON.stringify({ messages, savedAt: now })
            );

            const result = loadSessionFull('full-key');
            expect(result.messages).toEqual(messages);
            expect(result.savedAt).toBe(now);
        });

        it('returns null savedAt when no data', () => {
            const result = loadSessionFull('missing');
            expect(result.savedAt).toBeNull();
        });
    });

    describe('saveSession', () => {
        it('saves messages with a savedAt timestamp', () => {
            const messages: ChatMessage[] = [makeMessage('user', 'test')];
            saveSession('save-key', messages);

            const raw = localStorage.getItem('save-key');
            expect(raw).not.toBeNull();

            const parsed = JSON.parse(raw!);
            expect(parsed.messages).toEqual(messages);
            expect(typeof parsed.savedAt).toBe('number');
        });

        it('truncates messages to MAX_STORED_MESSAGES', () => {
            const messages: ChatMessage[] = Array.from(
                { length: MAX_STORED_MESSAGES + 10 },
                (_, i) => makeMessage('user', `msg-${i}`)
            );

            saveSession('truncate-key', messages);

            const raw = localStorage.getItem('truncate-key');
            const parsed = JSON.parse(raw!);
            expect(parsed.messages).toHaveLength(MAX_STORED_MESSAGES);
            expect(parsed.messages[0].content).toBe(`msg-10`);
        });
    });
});
