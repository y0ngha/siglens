import { describe, expect, it } from 'vitest';
import {
    ENUM_PREVIEW_COUNT,
    ENUM_PREVIEW_LIMIT,
    formatEnumValues,
    splitEnumPreview,
    toolAnchor,
} from '../toolReference';

const values = (count: number): string[] =>
    Array.from({ length: count }, (_, index) => `v${index + 1}`);

describe('toolAnchor', () => {
    it('prefixes the tool name', () => {
        expect(toolAnchor('get_quote')).toBe('tool-get_quote');
    });
});

describe('splitEnumPreview', () => {
    it('returns null for an argument without enum values', () => {
        expect(splitEnumPreview(undefined)).toBeNull();
    });

    it('leaves an enum at the limit unsplit', () => {
        expect(splitEnumPreview(values(ENUM_PREVIEW_LIMIT))).toBeNull();
    });

    it('splits an enum over the limit into the preview and the rest', () => {
        const split = splitEnumPreview(values(ENUM_PREVIEW_LIMIT + 1));
        expect(split).toEqual({
            preview: ['v1', 'v2', 'v3'],
            rest: ['v4', 'v5', 'v6', 'v7'],
        });
        expect(split?.preview).toHaveLength(ENUM_PREVIEW_COUNT);
    });
});

describe('formatEnumValues', () => {
    it('quotes each value and joins them as a union', () => {
        expect(formatEnumValues(['1Day', '1Hour'])).toBe('"1Day" | "1Hour"');
    });
});
