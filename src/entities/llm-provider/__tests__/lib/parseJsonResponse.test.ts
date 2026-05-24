import {
    parseJsonResponse,
    stripMarkdownCodeBlock,
} from '../../lib/parseJsonResponse';

describe('stripMarkdownCodeBlock', () => {
    it('strips ```json fenced wrapper and trims inner content', () => {
        const input = '```json\n{"a":1}\n```';
        expect(stripMarkdownCodeBlock(input)).toBe('{"a":1}');
    });

    it('strips ``` (no language) fenced wrapper', () => {
        const input = '```\n{"a":1}\n```';
        expect(stripMarkdownCodeBlock(input)).toBe('{"a":1}');
    });

    it('returns trimmed input when no code fence is present', () => {
        expect(stripMarkdownCodeBlock('  {"a":1}  ')).toBe('{"a":1}');
    });

    it('handles input with only one trailing newline', () => {
        expect(stripMarkdownCodeBlock('```json\n{"a":1}```')).toBe('{"a":1}');
    });
});

describe('parseJsonResponse', () => {
    it('parses fenced JSON returned by LLMs', () => {
        const text = '```json\n{"AAPL":"애플"}\n```';
        expect(parseJsonResponse(text, 'test')).toEqual({ AAPL: '애플' });
    });

    it('parses raw JSON without a code fence', () => {
        expect(parseJsonResponse('{"x":2}', 'test')).toEqual({ x: 2 });
    });

    it('throws a descriptive error containing the source name on malformed input', () => {
        expect(() => parseJsonResponse('not-json', 'koreanTranslator')).toThrow(
            /koreanTranslator/
        );
    });

    it('preserves the underlying SyntaxError as `cause` on malformed input', () => {
        // expect.assertions guards against the throw silently not happening —
        // Jest 30 removed the `fail()` global, so the older try/fail/catch
        // pattern is no longer reliable here.
        expect.assertions(2);
        try {
            parseJsonResponse('not-json', 'src');
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).cause).toBeInstanceOf(SyntaxError);
        }
    });

    // Salvage path — jsonrepair fallback for common LLM corruption.
    it('salvages truncated JSON via jsonrepair', () => {
        // Translator response cut off mid-object: jsonrepair closes the brace.
        const truncated = '{"AAPL":"애플", "MSFT":"마이크로소프트"';
        expect(parseJsonResponse(truncated, 'koreanTranslator')).toEqual({
            AAPL: '애플',
            MSFT: '마이크로소프트',
        });
    });

    it('salvages JSON with trailing commas and unquoted keys', () => {
        const broken = '{AAPL:"애플",}';
        expect(parseJsonResponse(broken, 'koreanTranslator')).toEqual({
            AAPL: '애플',
        });
    });

    it('does not silently wrap non-JSON-shaped garbage as a string', () => {
        // jsonrepair would happily turn this into `"random prose"`. Guard prevents that.
        expect(() => parseJsonResponse('random prose', 'src')).toThrow(
            /Failed to parse/
        );
    });
});
