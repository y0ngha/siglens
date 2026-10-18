import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveKrxTickTableForDisplay = vi.fn();
vi.mock('@/entities/ticker/lib/resolveKrxTickTable', () => ({
    resolveKrxTickTableForDisplay: (symbol: string) =>
        resolveKrxTickTableForDisplay(symbol),
}));

import { shareKrxTickTable } from '../shareKrxTickTable';

describe('shareKrxTickTable', () => {
    beforeEach(() => {
        resolveKrxTickTableForDisplay.mockReset();
    });

    it('resolves the table for a chart snapshot', async () => {
        resolveKrxTickTableForDisplay.mockResolvedValue('etp');
        expect(await shareKrxTickTable('chart', '360750.KS')).toBe('etp');
        expect(resolveKrxTickTableForDisplay).toHaveBeenCalledWith('360750.KS');
    });

    it('skips the lookup for kinds without price cards', async () => {
        expect(await shareKrxTickTable('news', '360750.KS')).toBe('share');
        expect(resolveKrxTickTableForDisplay).not.toHaveBeenCalled();
    });
});
