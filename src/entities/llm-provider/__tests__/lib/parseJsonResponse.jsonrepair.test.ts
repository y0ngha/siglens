import { parseJsonResponse } from '../../lib/parseJsonResponse';

/**
 * Characterization of the `jsonrepair` salvage path on LLM-shaped breakage.
 *
 * `parseJsonResponse` falls back to `jsonrepair` only after `JSON.parse` fails,
 * so the library's repair output *is* the chat/translation output on that path.
 * Pinning a corpus here makes a `jsonrepair` upgrade show exactly which inputs
 * change outcome. Mirrors the core corpus
 * (siglens-core `jsonrepairCharacterization.test.ts`).
 *
 * `THROWS` = salvage fails and the caller gets the labeled parse error.
 */
const THROWS = Symbol('throws');

const CORPUS: ReadonlyArray<readonly [string, string, unknown]> = [
    ['trailing comma', '{"a":1,"b":[1,2,],}', { a: 1, b: [1, 2] }],
    [
        'nested trailing comma followed by a sibling',
        '{"a":[1,2,],"b":3}',
        { a: [1, 2], b: 3 },
    ],
    ['single quotes', "{'a':'b'}", { a: 'b' }],
    ['unquoted keys', '{a:1,b:"x"}', { a: 1, b: 'x' }],
    ['missing comma', '{"a":1 "b":2}', { a: 1, b: 2 }],
    [
        'truncated mid-array (max-token cut)',
        '{"summary":"abc","items":[{"x":1},{"x":',
        { summary: 'abc', items: [{ x: 1 }, { x: null }] },
    ],
    [
        'unescaped inner quotes',
        '{"text":"He said "hi" to me"}',
        { text: 'He said "hi" to me' },
    ],
    [
        'python constants',
        '{"a":None,"b":True,"c":False}',
        { a: null, b: true, c: false },
    ],
    // 3.14.1+: `.5` is completed to `0.5`, and an unquoted value that merely
    // starts with a keyword is quoted instead of failing (3.14.0 threw on both).
    ['number with leading dot', '{"a": .5}', { a: 0.5 }],
    [
        'unquoted value starting with a keyword',
        '{"a": trueish}',
        { a: 'trueish' },
    ],
    [
        'HTML-entity-encoded quotes',
        '{&quot;a&quot;:&quot;b&quot;}',
        // 3.15.0: entity-encoded structural quotes are decoded (3.14 kept them as
        // literal key/value text). Entities inside a valid string stay put — below.
        { a: 'b' },
    ],
    [
        'entities inside a valid string value survive',
        '{"a":"S&amp;P 500" "b":1}',
        { a: 'S&amp;P 500', b: 1 },
    ],
    [
        'unescaped quotes around a number in Korean prose',
        '{"reason":"지지선 "150" 부근","score":3}',
        THROWS,
    ],
    // 3.15.0 (#175): a stray backslash after a closed string now fails the repair
    // consistently instead of being dropped, glued into the previous value, or
    // (array case) overflowing the stack. Failing surfaces as the labeled parse error.
    ['backslash right after a closed string', '{"a":"b"\\}', THROWS],
    ['backslash after a string inside an array', '["a"\\,"b"]', THROWS],
];

describe('parseJsonResponse — jsonrepair salvage corpus', () => {
    it.each(CORPUS)('%s', (_name, input, expected) => {
        if (expected === THROWS) {
            expect(() => parseJsonResponse(input, 'test')).toThrow(
                'Failed to parse test response as JSON'
            );
        } else {
            expect(parseJsonResponse(input, 'test')).toEqual(expected);
        }
    });
});
