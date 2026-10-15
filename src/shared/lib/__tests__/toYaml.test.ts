import { parse } from 'yaml';
import { toYaml } from '@/shared/lib/toYaml';

describe('toYaml', () => {
    it('writes nested maps with two-space indentation', () => {
        expect(toYaml({ a: { b: { c: 1 } }, d: true })).toBe(
            ['a:', '  b:', '    c: 1', 'd: true', ''].join('\n')
        );
    });

    it('writes arrays of scalars and of maps', () => {
        expect(
            toYaml({
                tags: ['one', 'two'],
                items: [{ name: 'alpha', count: 1 }, { name: 'beta' }],
            })
        ).toBe(
            [
                'tags:',
                '  - one',
                '  - two',
                'items:',
                '  - name: alpha',
                '    count: 1',
                '  - name: beta',
                '',
            ].join('\n')
        );
    });

    it('writes empty containers inline and nested arrays with a dash chain', () => {
        expect(toYaml({ a: [], b: {}, c: [[1, 2], []] })).toBe(
            ['a: []', 'b: {}', 'c:', '  - - 1', '    - 2', '  - []', ''].join(
                '\n'
            )
        );
    });

    it('quotes keys and strings that YAML would read as another type', () => {
        expect(
            toYaml({
                '200': 'ok',
                '/tools/get_quote': '3.1.0',
                $ref: 'true',
                yes: 'null',
                empty: '',
                colon: 'a: b',
                hash: 'a #b',
                number: '12',
                dash: '- x',
            })
        ).toBe(
            [
                '"200": ok',
                '"/tools/get_quote": "3.1.0"',
                '"$ref": "true"',
                '"yes": "null"',
                'empty: ""',
                'colon: "a: b"',
                'hash: "a #b"',
                'number: "12"',
                'dash: "- x"',
                '',
            ].join('\n')
        );
    });

    it('leaves safe plain strings unquoted, including slashes and spaces', () => {
        expect(
            toYaml({
                type: 'string',
                mime: 'application/json',
                header: 'X-Siglens-Locale',
                words: 'Bearer token auth',
            })
        ).toBe(
            [
                'type: string',
                'mime: application/json',
                'header: X-Siglens-Locale',
                'words: Bearer token auth',
                '',
            ].join('\n')
        );
    });

    it('writes multi-line strings as block literals and keeps blank lines', () => {
        expect(toYaml({ description: 'first\n\nsecond: "q"' })).toBe(
            ['description: |-', '  first', '', '  second: "q"', ''].join('\n')
        );
        expect(toYaml(['a\nb'])).toBe(['- |-', '  a', '  b', ''].join('\n'));
    });

    it('falls back to a JSON string where a block literal cannot carry the text', () => {
        expect(toYaml({ a: ' lead\nx', b: 'x\n', c: 'tab\there\nz' })).toBe(
            ['a: " lead\\nx"', 'b: "x\\n"', 'c: "tab\\there\\nz"', ''].join(
                '\n'
            )
        );
    });

    it('writes numbers, booleans and null, and skips undefined keys', () => {
        expect(
            toYaml({ count: -1.5, ok: false, nothing: null, skip: undefined })
        ).toBe(['count: -1.5', 'ok: false', 'nothing: null', ''].join('\n'));
    });

    it('rejects non-finite numbers instead of emitting invalid YAML', () => {
        expect(() => toYaml({ count: Number.NaN })).toThrow(TypeError);
    });

    it('escapes unicode safely through JSON strings', () => {
        expect(toYaml({ s: '한글: 값' })).toBe('s: "한글: 값"\n');
    });

    it('escapes DEL, C1 controls, separators and BOM as \\uXXXX in quoted scalars', () => {
        const del = String.fromCharCode(0x7f);
        const c1 = String.fromCharCode(0x85);
        const ls = String.fromCharCode(0x2028);
        const bom = String.fromCharCode(0xfeff);
        expect(toYaml({ s: `a${del}b${c1}c${ls}d${bom}` })).toBe(
            's: "a\\u007fb\\u0085c\\u2028d\\ufeff"\n'
        );
        // 블록 리터럴로도 못 나간다 — 줄바꿈이 있어도 따옴표 스칼라다.
        expect(toYaml({ s: `x\n${c1}` })).toBe('s: "x\\n\\u0085"\n');
    });

    it('keeps a lone surrogate out of block literals and writes it escaped', () => {
        const lone = String.fromCharCode(0xd800);
        expect(toYaml({ s: `a${lone}` })).toBe('s: "a\\ud800"\n');
        expect(toYaml({ s: `a\n${lone}` })).toBe('s: "a\\n\\ud800"\n');
    });

    it('writes a top-level multi-line string as an indented block literal', () => {
        expect(toYaml('first\nsecond')).toBe('|-\n  first\n  second\n');
        expect(toYaml('single')).toBe('single\n');
    });

    describe('round trip through a real YAML parser', () => {
        const tricky: Record<string, string> = {
            plain: 'hello world',
            reserved: 'true',
            numeric: '0123',
            colon: 'a: b',
            hash: 'a #b',
            quote: 'say "hi"',
            backslash: 'C:\\path',
            multi: 'one\n\ntwo: x\n  indented',
            trailing: 'line\n',
            leading: ' space\nnext',
            tab: 'a\tb\nc',
            unicode: '한글 ✓ 😀',
            del: `a${String.fromCharCode(0x7f)}b`,
            c1: `a${String.fromCharCode(0x85)}b`,
            separators: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0xfeff)}`,
            empty: '',
        };

        it('parses scalars, odd keys and nesting back to the same value', () => {
            const value = {
                ...tricky,
                '200': 'status key',
                'X-RateLimit-Limit': 1,
                nested: {
                    list: [tricky.multi, { yes: 'no' }, [1, null, false]],
                    empty: {},
                },
                [tricky.colon as string]: 'odd key',
            };
            expect(parse(toYaml(value))).toEqual(value);
        });

        it('parses top-level strings back', () => {
            for (const text of ['a\nb', 'plain', ' lead', 'x\n'])
                expect(parse(toYaml(text))).toBe(text);
        });
    });
});
