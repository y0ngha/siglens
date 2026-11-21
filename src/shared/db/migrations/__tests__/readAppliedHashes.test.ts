import { describe, expect, it } from 'vitest';
import {
    isUndefinedTableError,
    readAppliedHashes,
} from '@/shared/db/migrations/readAppliedHashes';

describe('isUndefinedTableError', () => {
    it('matches a 42P01 code', () => {
        expect(isUndefinedTableError({ code: '42P01' })).toBe(true);
    });

    it('matches a 42P01 wrapped in cause', () => {
        expect(
            isUndefinedTableError(
                new Error('Failed query', { cause: { code: '42P01' } })
            )
        ).toBe(true);
    });

    it.each([
        ['another code', { code: '28P01' }],
        ['a plain error', new Error('boom')],
        ['a non-object', 'nope'],
        ['null', null],
    ])('does not match %s', (_label, error) => {
        expect(isUndefinedTableError(error)).toBe(false);
    });

    it('stops on a cause cycle', () => {
        const a: { cause?: unknown } = {};
        a.cause = a;
        expect(isUndefinedTableError(a)).toBe(false);
    });
});

describe('readAppliedHashes', () => {
    it('returns the hash set', async () => {
        const result = await readAppliedHashes(async () => [
            { hash: 'a' },
            { hash: 'b' },
            { hash: 'a' },
        ]);
        expect(result).toEqual({
            hashes: new Set(['a', 'b']),
            tableMissing: false,
        });
    });

    it('turns a missing journal table into an empty set', async () => {
        const result = await readAppliedHashes(async () => {
            throw Object.assign(new Error('relation does not exist'), {
                code: '42P01',
            });
        });
        expect(result).toEqual({ hashes: new Set(), tableMissing: true });
    });

    it('rethrows any other error', async () => {
        const failure = new Error('connection refused');
        await expect(
            readAppliedHashes(async () => {
                throw failure;
            })
        ).rejects.toBe(failure);
    });
});
