import {
    parseJsonResponse,
    stripMarkdownCodeBlock,
} from '@/infrastructure/ai/parseJsonResponse';

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
        try {
            parseJsonResponse('{ bad', 'src');
            fail('expected throw');
        } catch (error) {
            expect((error as Error).cause).toBeInstanceOf(SyntaxError);
        }
    });
});
