import { resolveGeneratedAt } from '@/entities/analysis/analysisHistoryRepository';

describe('resolveGeneratedAt', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-30T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('uses the analysis own analyzedAt when it parses', () => {
        expect(
            resolveGeneratedAt({ analyzedAt: '2026-09-05T01:02:03.000Z' })
        ).toEqual(new Date('2026-09-05T01:02:03.000Z'));
    });

    it('falls back to now when analyzedAt is unparseable', () => {
        expect(resolveGeneratedAt({ analyzedAt: 'not-a-date' })).toEqual(
            new Date('2026-10-30T00:00:00.000Z')
        );
    });

    it('falls back to now when analyzedAt is not a string', () => {
        expect(resolveGeneratedAt({ analyzedAt: 1_700_000_000_000 })).toEqual(
            new Date('2026-10-30T00:00:00.000Z')
        );
    });

    it.each([null, undefined, 'x', 3])(
        'falls back to now when the result is not an object (%s)',
        result => {
            expect(resolveGeneratedAt(result)).toEqual(
                new Date('2026-10-30T00:00:00.000Z')
            );
        }
    );
});
