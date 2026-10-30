import { describe, expect, it } from 'vitest';
import { toReplayLines } from '../lib/replayLines';

describe('toReplayLines', () => {
    it('makes the first and last lines paragraphs and the middle ones list items', () => {
        expect(toReplayLines(['a', 'b', 'c', 'd']).map(l => l.kind)).toEqual([
            'p',
            'li',
            'li',
            'p',
        ]);
    });

    it('parses the inline tone markup', () => {
        expect(toReplayLines(['<b>64</b> <up>+1%</up>'])[0]).toEqual({
            kind: 'p',
            segments: [
                { text: '64', tone: 'strong' },
                { text: ' ', tone: 'plain' },
                { text: '+1%', tone: 'up' },
            ],
        });
    });

    it('returns no lines for no input', () => {
        expect(toReplayLines([])).toEqual([]);
    });
});
