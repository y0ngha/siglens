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

vi.mock('@/entities/economy/actions/ensureIndicatorTranslatedAction', () => ({
    ensureIndicatorTranslatedAction: vi.fn(),
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { ensureIndicatorTranslatedAction } from '@/entities/economy/actions/ensureIndicatorTranslatedAction';
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
        vi.mocked(ensureIndicatorTranslatedAction).mockResolvedValue(undefined);
    });

    it('maps dict-known names to Korean without a DB lookup', async () => {
        const labels = await resolveIndicatorLabels([ev('Nonfarm Payrolls')]);
        expect(labels['Nonfarm Payrolls']).toBe('비농업 고용');
        // All distinct bases were dict-known → no unknowns → no DB query.
        expect(findByNames).not.toHaveBeenCalled();
        expect(ensureIndicatorTranslatedAction).not.toHaveBeenCalled();
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
        expect(ensureIndicatorTranslatedAction).not.toHaveBeenCalled();
    });

    it('falls back to English and triggers AI for a name missing everywhere', async () => {
        const labels = await resolveIndicatorLabels([
            ev('Totally Unknown Thing (Apr)'),
        ]);
        expect(labels['Totally Unknown Thing (Apr)']).toBe(
            'Totally Unknown Thing (Apr)'
        );
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledWith(
            'Totally Unknown Thing'
        );
    });

    it('queries and triggers each distinct base only once', async () => {
        await resolveIndicatorLabels([
            ev('Totally Unknown Thing (Apr)'),
            ev('Totally Unknown Thing (May)'),
        ]);
        expect(findByNames).toHaveBeenCalledTimes(1);
        expect(findByNames).toHaveBeenCalledWith(['Totally Unknown Thing']);
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledTimes(1);
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
});
