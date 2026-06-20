vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache:
        (fn: (...a: unknown[]) => unknown) =>
        (...a: unknown[]) =>
            fn(...a),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

// Shared findByNames spy — all repository instances share this mock.
const findByNames = vi.fn();
vi.mock('@/entities/economy/api/indicatorTranslationRepository', () => ({
    DrizzleIndicatorTranslationRepository: class {
        findByNames = findByNames;
    },
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';

const ev = (event: string): EconomicCalendarEvent => ({
    date: '2026-06-13 08:30:00',
    event,
    impact: 'High',
    actual: null,
    estimate: 1,
    previous: 1,
    unit: '%',
});

describe('resolveIndicatorLabels', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findByNames.mockResolvedValue([]);
    });

    it('maps dict-known names to Korean without a DB lookup', async () => {
        const labels = await resolveIndicatorLabels([ev('Nonfarm Payrolls')]);
        expect(labels['Nonfarm Payrolls']).toBe('비농업 고용');
        // All distinct bases were dict-known → no unknowns → no DB query.
        expect(findByNames).not.toHaveBeenCalled();
    });

    it('applies a DB-cached translation for an unmapped name', async () => {
        findByNames.mockResolvedValue([
            {
                normalizedName: 'Some Obscure Index YoY',
                koreanName: '어떤 모호한 지수(전년比)',
                source: 'ai',
            },
        ]);
        const labels = await resolveIndicatorLabels([
            ev('Some Obscure Index YoY (May)'),
        ]);
        expect(labels['Some Obscure Index YoY (May)']).toBe(
            '어떤 모호한 지수(전년比) (5월)'
        );
    });

    it('falls back to English for a name missing from both dict and DB', async () => {
        const labels = await resolveIndicatorLabels([
            ev('Totally Unknown Thing (Apr)'),
        ]);
        expect(labels['Totally Unknown Thing (Apr)']).toBe(
            'Totally Unknown Thing (Apr)'
        );
        // No trigger: resolveIndicatorLabels is now a pure reader.
        // AI translation is triggered client-side by useIndicatorTranslationTrigger.
        expect(findByNames).toHaveBeenCalledWith(['Totally Unknown Thing']);
    });

    it('queries each distinct base only once', async () => {
        await resolveIndicatorLabels([
            ev('Totally Unknown Thing (Apr)'),
            ev('Totally Unknown Thing (May)'),
        ]);
        expect(findByNames).toHaveBeenCalledTimes(1);
        expect(findByNames).toHaveBeenCalledWith(['Totally Unknown Thing']);
    });

    it('degrades to English-only labels on DB failure (graceful)', async () => {
        findByNames.mockRejectedValue(new Error('neon down'));
        const labels = await resolveIndicatorLabels([
            ev('Totally Unknown Thing (Apr)'),
        ]);
        expect(labels['Totally Unknown Thing (Apr)']).toBe(
            'Totally Unknown Thing (Apr)'
        );
    });

    it('builds a correct label map shape for mixed dict/DB/unknown names', async () => {
        findByNames.mockResolvedValue([
            {
                normalizedName: 'Some Obscure Index YoY',
                koreanName: '어떤 모호한 지수(전년比)',
                source: 'ai',
            },
        ]);
        const labels = await resolveIndicatorLabels([
            ev('Nonfarm Payrolls'),
            ev('Some Obscure Index YoY (May)'),
            ev('Totally Unknown Thing'),
        ]);
        expect(labels['Nonfarm Payrolls']).toBe('비농업 고용');
        expect(labels['Some Obscure Index YoY (May)']).toBe(
            '어떤 모호한 지수(전년比) (5월)'
        );
        expect(labels['Totally Unknown Thing']).toBe('Totally Unknown Thing');
    });
});
