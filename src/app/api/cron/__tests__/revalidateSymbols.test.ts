const { mockRevalidateTag } = vi.hoisted(() => ({
    mockRevalidateTag: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));
vi.mock('server-only', () => ({}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidateSymbols } from '../revalidateSymbols';

describe('revalidateSymbols', () => {
    beforeEach(() => {
        mockRevalidateTag.mockClear();
    });

    it('invalidates each symbol’s investor-flows tag with the max profile (Next 16 two-argument form)', () => {
        revalidateSymbols(['aapl', 'BRK.B']);
        expect(mockRevalidateTag.mock.calls).toEqual([
            ['investor-flows:AAPL', 'max'],
            ['investor-flows:BRK.B', 'max'],
        ]);
    });

    it('does nothing for an empty list', () => {
        revalidateSymbols([]);
        expect(mockRevalidateTag).not.toHaveBeenCalled();
    });
});
