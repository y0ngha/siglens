import { describe, expect, it } from 'vitest';
import {
    groupLines,
    lineLength,
    parseReplayLine,
    pickNextIndex,
    revealLines,
    sliceSegments,
} from '../replayScript';

describe('parseReplayLine', () => {
    it('splits <b>/<up>/<down> into toned segments', () => {
        const line = parseReplayLine(
            'p',
            'close <b>71,800</b>, <up>+1.3%</up> and <down>-6%p</down>.'
        );
        expect(line.kind).toBe('p');
        expect(line.segments).toEqual([
            { text: 'close ', tone: 'plain' },
            { text: '71,800', tone: 'strong' },
            { text: ', ', tone: 'plain' },
            { text: '+1.3%', tone: 'up' },
            { text: ' and ', tone: 'plain' },
            { text: '-6%p', tone: 'down' },
            { text: '.', tone: 'plain' },
        ]);
    });

    it('returns one plain segment when there is no markup', () => {
        expect(parseReplayLine('li', 'no markup').segments).toEqual([
            { text: 'no markup', tone: 'plain' },
        ]);
    });

    it('keeps an unclosed or unknown tag as literal text', () => {
        expect(parseReplayLine('p', 'a <b>b').segments).toEqual([
            { text: 'a <b>b', tone: 'plain' },
        ]);
        expect(parseReplayLine('p', '<i>x</i>').segments).toEqual([
            { text: '<i>x</i>', tone: 'plain' },
        ]);
    });
});

describe('sliceSegments', () => {
    const segments = parseReplayLine('p', 'ab<b>cd</b>ef').segments;

    it('cuts inside a segment', () => {
        expect(sliceSegments(segments, 3)).toEqual([
            { text: 'ab', tone: 'plain' },
            { text: 'c', tone: 'strong' },
        ]);
    });

    it('returns nothing for 0 and everything past the end', () => {
        expect(sliceSegments(segments, 0)).toEqual([]);
        expect(sliceSegments(segments, 99)).toEqual(segments);
    });

    it('lineLength counts visible characters only', () => {
        expect(lineLength(parseReplayLine('p', 'ab<b>cd</b>ef'))).toBe(6);
    });
});

describe('pickNextIndex', () => {
    it('returns 0 when there is a single scenario', () => {
        expect(pickNextIndex(1, 0, () => 0)).toBe(0);
    });

    it('never repeats the previous index', () => {
        expect(pickNextIndex(5, 0, () => 0)).not.toBe(0);
        for (let prev = 0; prev < 5; prev++) {
            for (let i = 0; i < 200; i++) {
                const next = pickNextIndex(5, prev);
                expect(next).not.toBe(prev);
                expect(next).toBeGreaterThanOrEqual(0);
                expect(next).toBeLessThan(5);
            }
        }
    });
});

describe('revealLines', () => {
    const lines = [parseReplayLine('p', 'abc'), parseReplayLine('li', 'de')];

    it('fills lines in order and puts the caret on the last visible one', () => {
        expect(revealLines(lines, 4, true)).toEqual([
            { shown: 3, caret: false },
            { shown: 1, caret: true },
        ]);
        expect(revealLines(lines, 2, true)).toEqual([
            { shown: 2, caret: true },
            { shown: 0, caret: false },
        ]);
    });

    it('shows no caret once streaming is over, and caps at each line length', () => {
        expect(revealLines(lines, 99, false)).toEqual([
            { shown: 3, caret: false },
            { shown: 2, caret: false },
        ]);
    });
});

describe('groupLines', () => {
    it('folds consecutive same-kind lines into one group, and splits on a kind change', () => {
        const p1 = parseReplayLine('p', 'intro');
        const li1 = parseReplayLine('li', 'one');
        const li2 = parseReplayLine('li', 'two');
        const p2 = parseReplayLine('p', 'outro');

        const groups = groupLines([p1, li1, li2, p2]);

        expect(groups.map(g => g.kind)).toEqual(['p', 'li', 'p']);
        expect(groups.map(g => g.items.map(i => i.index))).toEqual([
            [0],
            [1, 2],
            [3],
        ]);
    });
});
