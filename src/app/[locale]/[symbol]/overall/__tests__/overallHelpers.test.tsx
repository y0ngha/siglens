vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<typeof import('@y0ngha/siglens-core')>()),
    peekOverallAnalysisCache: vi.fn(),
}));
vi.mock('@/widgets/overall/OverallFactsSummary', () => ({
    OverallFactsSummary: () => null,
}));
vi.mock('@/widgets/overall/OverallFactualFallback', () => ({
    OverallFactualFallback: () => null,
}));

import { isValidElement } from 'react';
import {
    DEEPSEEK_V4_1_FLASH_MODEL,
    peekOverallAnalysisCache,
} from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { overallServerFallback } from '@/app/[locale]/[symbol]/overall/_components/overallServerFallback';
import { buildOverallHeading } from '@/app/[locale]/[symbol]/overall/_lib/overallHeading';
import {
    loadOverallPeek,
    type OverallPeekResult,
} from '@/app/[locale]/[symbol]/overall/_lib/overallPeek';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { OverallFactsSummary } from '@/widgets/overall/OverallFactsSummary';
import { OverallFactualFallback } from '@/widgets/overall/OverallFactualFallback';

const PEEK = { summary: 'cached' } as unknown as NonNullable<OverallPeekResult>;

describe('loadOverallPeek', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('익명 기본 방문자의 캐시 키(기본 모델·reasoning off·기본 타임프레임)로 엿본다', async () => {
        vi.mocked(peekOverallAnalysisCache).mockResolvedValue(PEEK as never);

        await expect(loadOverallPeek('AAPL', 'Apple Inc.', 'ko')).resolves.toBe(
            PEEK
        );
        expect(staticSymbolCache).toHaveBeenCalledWith(
            ['peek:overall', 'AAPL', DEEPSEEK_V4_1_FLASH_MODEL, 'ko'],
            'AAPL',
            expect.any(Function),
            [],
            SECONDS_PER_HALF_DAY
        );
        expect(peekOverallAnalysisCache).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            DEFAULT_TIMEFRAME,
            DEEPSEEK_V4_1_FLASH_MODEL,
            false,
            undefined,
            undefined,
            'ko'
        );
    });

    it('엿보기가 실패하면 로그를 남기고 null이다', async () => {
        const error = new Error('redis down');
        vi.mocked(peekOverallAnalysisCache).mockRejectedValue(error);
        const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            loadOverallPeek('AAPL', 'Apple Inc.', 'ko')
        ).resolves.toBeNull();
        expect(logSpy).toHaveBeenCalledWith(
            '[OverallPage] peekOverallAnalysisCache failed:',
            error
        );
        logSpy.mockRestore();
    });
});

describe('buildOverallHeading', () => {
    it.each([
        ['us-equity', 'page.overallHeadingUsEquity'],
        ['kr-equity', 'page.overallHeadingKrEquity'],
        ['crypto', 'page.overallHeadingCrypto'],
    ] as const)('%s는 %s 문구다', async (profile, key) => {
        const t = await getTranslations({
            locale: 'ko',
            namespace: 'app.symbol',
        });

        expect(buildOverallHeading(profile, '애플', t)).toBe(
            t(key, { v0: '애플' })
        );
    });
});

describe('overallServerFallback', () => {
    const base = {
        symbol: 'AAPL',
        displayName: '애플',
        marketProfile: 'us-equity' as const,
        newsItems: [],
    };

    it('스냅샷 산문이 있으면 비운다', () => {
        expect(
            overallServerFallback({
                ...base,
                showSnapshotProse: true,
                cachedOverall: PEEK,
            })
        ).toBeNull();
    });

    it('엿본 분석이 있으면 사실 요약을 그린다', () => {
        const node = overallServerFallback({
            ...base,
            showSnapshotProse: false,
            cachedOverall: PEEK,
        });
        expect(isValidElement(node) && node.type).toBe(OverallFactsSummary);
    });

    it('엿본 분석도 없으면 사실 placeholder를 그린다', () => {
        const node = overallServerFallback({
            ...base,
            showSnapshotProse: false,
            cachedOverall: null,
        });
        expect(isValidElement(node) && node.type).toBe(OverallFactualFallback);
    });
});
