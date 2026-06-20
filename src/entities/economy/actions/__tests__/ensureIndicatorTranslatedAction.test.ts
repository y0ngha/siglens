vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

vi.mock('@y0ngha/siglens-core', () => ({
    submitIndicatorTranslation: vi.fn(),
    pollIndicatorTranslation: vi.fn(),
}));

vi.mock('@/entities/economy/api/indicatorTranslationFlag', () => ({
    isIndicatorTranslationPending: vi.fn(),
    markIndicatorTranslationPending: vi.fn(),
}));

vi.mock('@/entities/economy/api/indicatorTranslationRepository', () => ({
    DrizzleIndicatorTranslationRepository: class {
        upsert = vi.fn();
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { revalidateTag } from 'next/cache';
import {
    submitIndicatorTranslation,
    pollIndicatorTranslation,
} from '@y0ngha/siglens-core';
import {
    isIndicatorTranslationPending,
    markIndicatorTranslationPending,
} from '@/entities/economy/api/indicatorTranslationFlag';
import { DrizzleIndicatorTranslationRepository } from '@/entities/economy/api/indicatorTranslationRepository';
import { ensureIndicatorTranslatedAction } from '@/entities/economy/actions/ensureIndicatorTranslatedAction';
import { INDICATOR_TRANSLATION_CACHE_TAG } from '@/entities/economy/lib/indicatorTranslationConstants';

describe('ensureIndicatorTranslatedAction', () => {
    let upsert: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isIndicatorTranslationPending).mockResolvedValue(false);
        vi.mocked(markIndicatorTranslationPending).mockResolvedValue(undefined);
        // Default: cached result (short-circuit, no poll needed)
        vi.mocked(submitIndicatorTranslation).mockResolvedValue({
            status: 'cached',
            nameKo: '어떤 모호한 지수(전년比)',
        });
        // Get the upsert mock from the repository instance
        const RepoClass =
            DrizzleIndicatorTranslationRepository as unknown as new () => {
                upsert: ReturnType<typeof vi.fn>;
            };
        upsert = new RepoClass().upsert;
        upsert.mockResolvedValue(undefined);
    });

    it('skips when the name is already in the code dictionary', async () => {
        await ensureIndicatorTranslatedAction('Nonfarm Payrolls');
        expect(submitIndicatorTranslation).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('skips when a translation is already pending', async () => {
        vi.mocked(isIndicatorTranslationPending).mockResolvedValue(true);
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(submitIndicatorTranslation).not.toHaveBeenCalled();
    });

    it('uses cached result directly without polling', async () => {
        vi.mocked(submitIndicatorTranslation).mockResolvedValue({
            status: 'cached',
            nameKo: '어떤 모호한 지수(전년比)',
        });
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(markIndicatorTranslationPending).toHaveBeenCalledOnce();
        expect(submitIndicatorTranslation).toHaveBeenCalledWith(
            'Some Obscure Index YoY'
        );
        expect(pollIndicatorTranslation).not.toHaveBeenCalled();
        expect(revalidateTag).toHaveBeenCalledWith(
            INDICATOR_TRANSLATION_CACHE_TAG,
            'max'
        );
    });

    it('polls until done, upserts, and revalidates the cache tag', async () => {
        vi.mocked(submitIndicatorTranslation).mockResolvedValue({
            status: 'submitted',
            jobId: 'job-123',
        });
        vi.mocked(pollIndicatorTranslation)
            .mockResolvedValueOnce({ status: 'processing' })
            .mockResolvedValueOnce({
                status: 'done',
                nameKo: '어떤 모호한 지수(전년比)',
            });

        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(pollIndicatorTranslation).toHaveBeenCalledWith('job-123');
        expect(revalidateTag).toHaveBeenCalledWith(
            INDICATOR_TRANSLATION_CACHE_TAG,
            'max'
        );
    });

    it('swallows a core submission failure without upserting or revalidating', async () => {
        vi.mocked(submitIndicatorTranslation).mockRejectedValue(
            new Error('llm down')
        );
        await expect(
            ensureIndicatorTranslatedAction('Some Obscure Index YoY')
        ).resolves.toBeUndefined();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('does not upsert or revalidate for an empty translation (cached path)', async () => {
        vi.mocked(submitIndicatorTranslation).mockResolvedValue({
            status: 'cached',
            nameKo: '   ',
        });
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('does not revalidate when poll returns error', async () => {
        vi.mocked(submitIndicatorTranslation).mockResolvedValue({
            status: 'submitted',
            jobId: 'job-456',
        });
        vi.mocked(pollIndicatorTranslation).mockResolvedValue({
            status: 'error',
            error: 'translation failed',
        });
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(revalidateTag).not.toHaveBeenCalled();
    });
});
