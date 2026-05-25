import { cn } from '@/shared/lib/cn';

describe('cn', () => {
    it('merges simple class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes via clsx', () => {
        expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
    });

    it('handles undefined and null inputs', () => {
        expect(cn('base', undefined, null, 'extra')).toBe('base extra');
    });

    it('handles empty string inputs', () => {
        expect(cn('base', '', 'extra')).toBe('base extra');
    });

    it('returns empty string for no arguments', () => {
        expect(cn()).toBe('');
    });

    it('merges conflicting Tailwind classes (last wins)', () => {
        // tailwind-merge resolves p-2 and p-4 to p-4
        expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('merges conflicting text color classes', () => {
        expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('preserves non-conflicting classes', () => {
        const result = cn('p-2', 'mt-4', 'text-sm');
        expect(result).toContain('p-2');
        expect(result).toContain('mt-4');
        expect(result).toContain('text-sm');
    });

    it('handles array inputs', () => {
        expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('handles object inputs', () => {
        expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
    });
});
