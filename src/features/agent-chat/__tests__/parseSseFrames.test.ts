import { describe, expect, it } from 'vitest';
import {
    parseSseFrame,
    splitFrames,
} from '@/features/agent-chat/lib/parseSseFrames';

describe('parseSseFrames', () => {
    it('splits complete frames on the blank line and keeps the trailing partial frame', () => {
        const { frames, rest } = splitFrames(
            'event: a\ndata: {"x":1}\n\nevent: b\ndata: {}\n\nevent: c\ndata: {'
        );
        expect(frames).toEqual([
            'event: a\ndata: {"x":1}',
            'event: b\ndata: {}',
        ]);
        expect(rest).toBe('event: c\ndata: {');
    });

    it('returns an empty rest when the buffer ends exactly on a frame boundary', () => {
        const { frames, rest } = splitFrames('event: a\ndata: {}\n\n');
        expect(frames).toEqual(['event: a\ndata: {}']);
        expect(rest).toBe('');
    });

    it('parses event and data, empty data becomes {}, malformed JSON becomes null', () => {
        expect(parseSseFrame('event: text\ndata: {"delta":"hi"}')).toEqual({
            event: 'text',
            data: { delta: 'hi' },
        });
        expect(parseSseFrame('event: heartbeat\ndata: {}')).toEqual({
            event: 'heartbeat',
            data: {},
        });
        expect(parseSseFrame('event: text\ndata: {bad')).toEqual({
            event: 'text',
            data: null,
        });
    });

    it('splits frames delimited by CRLF (a normalizing intermediary can rewrite \\n\\n to \\r\\n\\r\\n)', () => {
        const { frames, rest } = splitFrames(
            'event: a\r\ndata: {"x":1}\r\n\r\nevent: b\r\ndata: {}\r\n\r\nevent: c\r\ndata: {'
        );
        expect(frames).toEqual([
            'event: a\r\ndata: {"x":1}',
            'event: b\r\ndata: {}',
        ]);
        expect(rest).toBe('event: c\r\ndata: {');
    });

    it('parses a CRLF-delimited frame', () => {
        expect(parseSseFrame('event: text\r\ndata: {"delta":"hi"}')).toEqual({
            event: 'text',
            data: { delta: 'hi' },
        });
    });

    it('joins multiple data: lines with \\n (SSE multi-line data)', () => {
        expect(
            parseSseFrame('event: text\ndata: {\ndata: "delta":"hi"\ndata: }')
        ).toEqual({
            event: 'text',
            data: { delta: 'hi' },
        });
    });

    it('drops an empty frame produced by consecutive blank-line delimiters (heartbeat noise)', () => {
        const { frames, rest } = splitFrames(
            'event: a\ndata: {}\n\n\n\nevent: b\ndata: {}\n\n'
        );
        expect(frames).toEqual(['event: a\ndata: {}', 'event: b\ndata: {}']);
        expect(rest).toBe('');
    });

    it('a frame with neither event: nor data: (a bare SSE comment line) yields an empty event and an empty-object data', () => {
        expect(parseSseFrame(': keep-alive')).toEqual({
            event: '',
            data: {},
        });
    });

    it('a frame with only an event: line (no data: at all) yields data: {}', () => {
        expect(parseSseFrame('event: ping')).toEqual({
            event: 'ping',
            data: {},
        });
    });

    it('accepts a data: line with no space before the value (not all senders pad it)', () => {
        expect(parseSseFrame('event: text\ndata:{"delta":"hi"}')).toEqual({
            event: 'text',
            data: { delta: 'hi' },
        });
    });
});
