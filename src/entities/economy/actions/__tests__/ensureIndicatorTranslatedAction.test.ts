const { mockUpsert, isE2E } = vi.hoisted(() => ({
    mockUpsert: vi.fn().mockResolvedValue(undefined),
    isE2E: vi.fn(() => false),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => isE2E() }));

vi.mock('@y0ngha/siglens-core', () => ({
    runIndicatorTranslation: vi.fn(),
}));

vi.mock('@/entities/economy/api/indicatorTranslationFlag', () => ({
    isIndicatorTranslationPending: vi.fn(),
    markIndicatorTranslationPending: vi.fn(),
}));

vi.mock('@/entities/economy/api/indicatorTranslationRepository', () => ({
    DrizzleIndicatorTranslationRepository: class {
        upsert = mockUpsert;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { revalidateTag } from 'next/cache';
import { runIndicatorTranslation } from '@y0ngha/siglens-core';
import {
    isIndicatorTranslationPending,
    markIndicatorTranslationPending,
} from '@/entities/economy/api/indicatorTranslationFlag';
import { ensureIndicatorTranslatedAction } from '@/entities/economy/actions/ensureIndicatorTranslatedAction';
import { INDICATOR_TRANSLATION_CACHE_TAG } from '@/entities/economy/lib/indicatorTranslationConstants';

describe('ensureIndicatorTranslatedAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpsert.mockClear();
        isE2E.mockReturnValue(false);
        vi.mocked(isIndicatorTranslationPending).mockResolvedValue(false);
        vi.mocked(markIndicatorTranslationPending).mockResolvedValue(undefined);
        // Default: cached result
        vi.mocked(runIndicatorTranslation).mockResolvedValue({
            status: 'cached',
            nameKo: '어떤 모호한 지수(전년比)',
        });
    });

    it('short-circuits under E2E (no LLM calls)', async () => {
        isE2E.mockReturnValue(true);
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(runIndicatorTranslation).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('skips when the name is already in the code dictionary', async () => {
        await ensureIndicatorTranslatedAction('Nonfarm Payrolls');
        expect(runIndicatorTranslation).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('skips when a translation is already pending', async () => {
        vi.mocked(isIndicatorTranslationPending).mockResolvedValue(true);
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(runIndicatorTranslation).not.toHaveBeenCalled();
    });

    it('uses cached result, upserts, and revalidates the cache tag', async () => {
        vi.mocked(runIndicatorTranslation).mockResolvedValue({
            status: 'cached',
            nameKo: '어떤 모호한 지수(전년比)',
        });
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(markIndicatorTranslationPending).toHaveBeenCalledOnce();
        expect(runIndicatorTranslation).toHaveBeenCalledWith(
            'Some Obscure Index YoY'
        );
        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                normalizedName: 'Some Obscure Index YoY',
                source: 'ai',
            })
        );
        expect(revalidateTag).toHaveBeenCalledWith(
            INDICATOR_TRANSLATION_CACHE_TAG,
            'max'
        );
    });

    it('done result upserts and revalidates the cache tag', async () => {
        vi.mocked(runIndicatorTranslation).mockResolvedValue({
            status: 'done',
            nameKo: '어떤 모호한 지수(전년比)',
        });
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(runIndicatorTranslation).toHaveBeenCalledWith(
            'Some Obscure Index YoY'
        );
        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                normalizedName: 'Some Obscure Index YoY',
                source: 'ai',
            })
        );
        expect(revalidateTag).toHaveBeenCalledWith(
            INDICATOR_TRANSLATION_CACHE_TAG,
            'max'
        );
    });

    it('swallows a core failure without upserting or revalidating', async () => {
        vi.mocked(runIndicatorTranslation).mockRejectedValue(
            new Error('llm down')
        );
        await expect(
            ensureIndicatorTranslatedAction('Some Obscure Index YoY')
        ).resolves.toBeUndefined();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('does not upsert or revalidate for an empty translation', async () => {
        vi.mocked(runIndicatorTranslation).mockResolvedValue({
            status: 'cached',
            nameKo: '   ',
        });
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('does not upsert or revalidate when done returns whitespace nameKo', async () => {
        vi.mocked(runIndicatorTranslation).mockResolvedValue({
            status: 'done',
            nameKo: '   ',
        });
        await expect(
            ensureIndicatorTranslatedAction('Some Obscure Index YoY')
        ).resolves.toBeUndefined();
        expect(mockUpsert).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });
});
