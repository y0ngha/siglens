import { describe, expect, it } from 'vitest';
import { affectedRows } from '../../api/affectedRows';

describe('affectedRows', () => {
    it('reads the driver’s count', () => {
        expect(affectedRows(Object.assign([], { count: 7 }))).toBe(7);
    });

    it.each([null, undefined, 'x', {}, { count: '7' }])(
        'is 0 when there is no numeric count (%j)',
        result => {
            expect(affectedRows(result)).toBe(0);
        }
    );
});
