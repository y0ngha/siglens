const { mockUpsert, isE2E, mockListInRange } = vi.hoisted(() => ({
    mockUpsert: vi.fn().mockResolvedValue(undefined),
    isE2E: vi.fn(() => false),
    mockListInRange: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => isE2E() }));

vi.mock('@y0ngha/siglens-core', () => ({
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
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
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        listInRange = mockListInRange;
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
import {
    __resetIndicatorWhitelistCacheForTests,
    MAX_INDICATOR_NAME_LENGTH,
} from '@/entities/economy/api/translateIndicators';

/** 화면 캘린더 창에 실제로 걸린 이벤트 — 기간 접미사는 base 추출로 떨어진다. */
const CALENDAR_EVENT = 'Some Obscure Index YoY (Sep)';

describe('ensureIndicatorTranslatedAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpsert.mockClear();
        isE2E.mockReturnValue(false);
        __resetIndicatorWhitelistCacheForTests();
        // US 창에만 있다 — KR 창은 비어 있어도 한 나라에만 있으면 통과해야 한다.
        mockListInRange.mockImplementation(
            async (_from: string, _to: string, country: string) =>
                country === 'US' ? [{ event: CALENDAR_EVENT }] : []
        );
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

    describe('whitelist (public action input)', () => {
        it('does not translate a name absent from the calendar window', async () => {
            await ensureIndicatorTranslatedAction('Made Up Index For Billing');
            expect(runIndicatorTranslation).not.toHaveBeenCalled();
            expect(markIndicatorTranslationPending).not.toHaveBeenCalled();
        });

        it('rejects a non-string argument without touching the DB', async () => {
            await ensureIndicatorTranslatedAction({ name: 'x' });
            expect(mockListInRange).not.toHaveBeenCalled();
            expect(runIndicatorTranslation).not.toHaveBeenCalled();
        });

        it('rejects an over-long name before querying the calendar', async () => {
            await ensureIndicatorTranslatedAction(
                'A'.repeat(MAX_INDICATOR_NAME_LENGTH + 1)
            );
            expect(mockListInRange).not.toHaveBeenCalled();
            expect(runIndicatorTranslation).not.toHaveBeenCalled();
        });

        it('reuses the calendar whitelist for repeated calls (no repeated Neon reads)', async () => {
            await ensureIndicatorTranslatedAction('Made Up Index A');
            await ensureIndicatorTranslatedAction('Made Up Index B');
            // 첫 호출이 두 나라 창을 한 번씩 읽고, 두 번째 호출은 캐시를 쓴다.
            expect(mockListInRange).toHaveBeenCalledTimes(2);
        });

        it('checks both calendar countries', async () => {
            await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
            const countries = mockListInRange.mock.calls.map(c => c[2]);
            expect(countries.toSorted()).toEqual(['KR', 'US']);
        });
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
