// spy → vi.mock → imports order (MISTAKES.md Tests §17: hoist spies referenced by
// vi.mock factories via vi.hoisted so they aren't TDZ'd when the factory runs).
const { mockEvaluateSymbolIndexability, mockGetSeoSnapshotsStatic } =
    vi.hoisted(() => ({
        mockEvaluateSymbolIndexability: vi.fn(),
        mockGetSeoSnapshotsStatic: vi.fn(),
    }));

vi.mock('@/entities/symbol-indexability', () => ({
    evaluateSymbolIndexability: mockEvaluateSymbolIndexability,
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import type { AssetInfo } from '@/shared/lib/types';

const ASSET_INFO = { symbol: 'AAPL', name: 'Apple Inc.' } as AssetInfo;

/**
 * `locale-not-ready`만 걸린 경우는 **null**을 돌려줘야 한다.
 *
 * 이 함수의 blocked 응답(`NOINDEX_SYMBOL_METADATA`)에는 title이 없다. 종목이
 * 없거나 본문이 degrade된 경우엔 맞지만, 번역만 안 된 경우까지 비우면 371티커
 * × 9탭 × 3로케일의 제목이 통째로 사라진다(실측 회귀).
 *
 * 이 분기는 라운드 8에서 넣고도 **테스트가 하나도 없었다** — 그 줄을 지워도
 * 2,221개가 통과했다. 기존 케이스가 전부 `locale: 'ko'`라 도달조차 못 했다.
 */
describe('locale-not-ready는 페이지를 비우지 않는다', () => {
    // 이 분기는 **실제 판정**을 거쳐야 의미가 있다 — 평가자를 mock한 채로는
    // 내가 만든 mock 반환값을 다시 확인하는 항등식이 된다.
    beforeEach(async () => {
        const actual = await vi.importActual<
            typeof import('@/entities/symbol-indexability')
        >('@/entities/symbol-indexability');
        mockEvaluateSymbolIndexability.mockImplementation(
            actual.evaluateSymbolIndexability
        );
    });

    it.each(['en', 'ja', 'zh'] as const)(
        '%s: null을 돌려 호출부가 제목을 만들게 한다',
        async locale => {
            await expect(
                getBlockedSymbolMetadata({
                    locale,
                    symbol: 'AAPL',
                    assetInfo: ASSET_INFO,
                    degraded: false,
                    revalidateSeconds: 3600,
                    tab: 'technical',
                })
            ).resolves.toBeNull();
        }
    );

    it('ko에서 실제 차단 사유가 있으면 여전히 noindex다', async () => {
        await expect(
            getBlockedSymbolMetadata({
                locale: 'ko',
                symbol: 'AAPL',
                assetInfo: null,
                degraded: false,
                revalidateSeconds: 3600,
                tab: 'technical',
            })
        ).resolves.not.toBeNull();
    });
});

describe('getBlockedSymbolMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not read snapshots on the non-degraded path and returns null when indexable', async () => {
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: true,
            reason: 'popular',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: false,
            locale: 'ko',
            revalidateSeconds: 21600,
            tab: 'technical',
        });

        expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: false,
            locale: 'ko',
            hasSnapshot: undefined,
        });
        expect(result).toBeNull();
    });

    it('does not read snapshots on the non-degraded path and returns noindex when blocked', async () => {
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'longtail-default-blocked',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'ZZZOF',
            assetInfo: ASSET_INFO,
            degraded: false,
            locale: 'ko',
            revalidateSeconds: 21600,
            tab: 'technical',
        });

        expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });

    it('reads snapshots on the degraded path and threads hasSnapshot=true when a same-tab snapshot exists', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            // content must be RENDERABLE (FIX 1), not merely present — a
            // valid `summary` passes narrowTechnicalContent/hasTechnicalProse.
            {
                symbol: 'AAPL',
                tab: 'technical',
                content: { summary: '유효한 기술적 분석 요약 텍스트입니다.' },
            },
        ]);
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: true,
            reason: 'degraded-with-snapshot',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            revalidateSeconds: 21600,
            tab: 'technical',
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            21600,
            'ko'
        );
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            hasSnapshot: true,
        });
        expect(result).toBeNull();
    });

    it('reads snapshots on the degraded path and threads hasSnapshot=false when no snapshot exists', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'degraded',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            revalidateSeconds: 43200,
            tab: 'technical',
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            43200,
            'ko'
        );
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            hasSnapshot: false,
        });
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });

    // Regression guard for FIX 2 (audit): a degraded+whitelisted symbol with a
    // snapshot row for a DIFFERENT tab must NOT be flipped indexable. Before
    // this fix, hasSnapshot was `(await getSeoSnapshotsStatic(...)).length > 0`
    // — true for ANY tab's row — so e.g. a degraded `/congress` with only a
    // `technical` row was marked indexable while its body renders the thin
    // degraded shell.
    it('a snapshot row for a DIFFERENT tab does NOT flip hasSnapshot to true (regression guard)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            { symbol: 'AAPL', tab: 'technical' },
        ]);
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'degraded',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            revalidateSeconds: 86400,
            tab: 'congress',
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            86400,
            'ko'
        );
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            hasSnapshot: false,
        });
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });

    // FIX 1 (audit): a same-tab row whose `content` is malformed (fails the
    // renderer's narrowing) must NOT flip hasSnapshot to true. Before this
    // fix, `hasSnapshot` was `.some(s => s.tab === tab)` — TRUE for any
    // same-tab row regardless of whether its content renders — so a
    // degraded+whitelisted symbol with a malformed `technical` row was marked
    // indexable while `TechnicalSnapshotProse` null-renders the thin
    // degraded shell for that same content.
    it('a same-tab row whose content is malformed does NOT flip hasSnapshot to true (FIX 1 regression guard)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            // missing `summary` (and no other narrowable field) — fails
            // narrowTechnicalContent, so hasTechnicalProse(content) === false.
            { symbol: 'AAPL', tab: 'technical', content: { foo: 'bar' } },
        ]);
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'degraded',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            revalidateSeconds: 21600,
            tab: 'technical',
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            21600,
            'ko'
        );
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            hasSnapshot: false,
        });
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });

    // fear-greed/position pass no `tab` — the DB read must be skipped entirely
    // and hasSnapshot must stay undefined so the existing degraded→noindex
    // behavior is preserved (never flipped indexable by another tab's row).
    it('skips the DB read entirely and keeps hasSnapshot=undefined when no tab is given (fear-greed/position)', async () => {
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'degraded',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            revalidateSeconds: 86400,
        });

        expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko',
            hasSnapshot: undefined,
        });
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });
});
