import { describe, it, expect } from 'vitest';
import {
    asRecord,
    narrowCleanString,
} from '@/entities/seo-snapshot/lib/narrowJson';

describe('asRecord', () => {
    it('returns the same object for a plain object', () => {
        const value = { a: 1 };
        expect(asRecord(value)).toBe(value);
    });

    it.each([null, undefined, 'text', 42, true])(
        'returns null for %s',
        value => {
            expect(asRecord(value)).toBeNull();
        }
    );

    it('lets an array through so callers can read string keys as undefined', () => {
        const record = asRecord([1, 2]);
        expect(record).not.toBeNull();
        expect(record?.summary).toBeUndefined();
    });
});

describe('narrowCleanString', () => {
    it('strips markdown markers and trims surrounding whitespace', () => {
        expect(narrowCleanString('  **강세** 신호  ')).toBe('강세 신호');
    });

    it.each([null, undefined, 42, {}, ['x']])(
        'returns an empty string for non-string %s',
        value => {
            expect(narrowCleanString(value)).toBe('');
        }
    );
});
