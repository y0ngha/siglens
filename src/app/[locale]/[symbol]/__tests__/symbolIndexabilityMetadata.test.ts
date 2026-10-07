// spy → vi.mock → imports order (TESTING.md#TE-1: hoist spies referenced by
// vi.mock factories via vi.hoisted so they aren't TDZ'd when the factory runs).
const { mockEvaluateSymbolIndexability, mockGetSeoSnapshotsStatic } =
    vi.hoisted(() => ({
        mockEvaluateSymbolIndexability: vi.fn(),
        mockGetSeoSnapshotsStatic: vi.fn(),
    }));

vi.mock(
    '@/entities/symbol-indexability/lib/evaluateSymbolIndexability',
    () => ({
        evaluateSymbolIndexability: mockEvaluateSymbolIndexability,
    })
);

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import type { SymbolSeoTab } from '@/shared/lib/seo';
import type { AssetInfo } from '@/shared/lib/types';
import type { Metadata } from 'next';

const ASSET_INFO = { symbol: 'AAPL', name: 'Apple Inc.' } as AssetInfo;
// 렌더러 narrowing을 통과하는 최소 산문.
const TECHNICAL_ROW = {
    symbol: 'AAPL',
    tab: 'technical',
    content: { summary: '유효한 기술적 분석 요약 텍스트입니다.' },
};
const NEWS_ROW = {
    symbol: 'AAPL',
    tab: 'news',
    content: { currentDriverKo: '뉴스 동인 문단입니다.' },
};

/**
 * 차단(noindex) 결과의 계약.
 *
 * 예전엔 `toEqual(NOINDEX_SYMBOL_METADATA)`였는데, 그 상수는 title/description/
 * openGraph를 갖고 있지 않아 Next가 **루트 레이아웃 값을 상속**시킨다. 그래서
 * 차단된 심볼 URL이 전부 홈페이지 title·description을 쓰고 `og:url`을
 * `https://siglens.io`로 선언하고 있었다(2026-08-24 프로덕션 실측). 상수와의
 * 동등성이 아니라 **심볼 고유 정체성 + noindex**를 단언해야 그 회귀가 잡힌다.
 */
function expectBlockedWithOwnIdentity(
    result: Metadata | null,
    symbol: string,
    /**
     * 탭을 넘긴 호출은 그 탭의 카피를 쓰므로 `og:url`도 탭 경로를 가리킨다 —
     * 차단된 형제 탭들이 심볼 루트와 같은 제목·설명을 반복하지 않게 한 변경
     * (2026-09-17 네이버 중복 title/description 리포트)의 의도된 귀결이다.
     */
    tabPath = ''
): void {
    expect(result).not.toBeNull();
    expect(result!.robots).toEqual(NOINDEX_SYMBOL_METADATA.robots);
    // self-canonical(2026-10-05) — `canonical: null`이 아니라 자기 URL을 가리키고 hreflang은 싣지 않는다.
    expect(result!.alternates).toEqual({
        canonical: `https://siglens.io/${symbol}${tabPath}`,
    });
    expect(result!.title).toEqual({
        absolute: expect.stringContaining(symbol) as unknown as string,
    });
    expect(result!.description).toEqual(expect.any(String));
    expect(result!.openGraph?.url).toBe(
        `https://siglens.io/${symbol}${tabPath}`
    );
}

describe('getBlockedSymbolMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
    });

    it('차트·뉴스 탭의 정상 경로는 스냅샷을 읽어 prose 상태를 게이트에 넘긴다(산문 있음 → 색인)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([TECHNICAL_ROW]);
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

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            21600,
            'ko'
        );
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                degraded: false,
                hasSnapshot: undefined,
                prose: 'present',
            })
        );
        expect(result).toBeNull();
    });

    it('차단된 탭은 탭별 title/description을 쓴다 — 형제 탭끼리 중복되지 않는다', async () => {
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'longtail-default-blocked',
        });
        const ALL_TABS = [
            'technical',
            'overall',
            'fundamental',
            'financials',
            'congress',
            'news',
            'options',
            'fear-greed',
        ] as const satisfies readonly SymbolSeoTab[];
        const blockedFor = async (tab: SymbolSeoTab): Promise<Metadata> =>
            (await getBlockedSymbolMetadata({
                symbol: 'QQQ',
                assetInfo: ASSET_INFO,
                degraded: false,
                locale: 'ko',
                revalidateSeconds: 21600,
                tab,
            }))!;

        const results = await Promise.all(ALL_TABS.map(blockedFor));
        const titleOf = (m: Metadata): string =>
            (m.title as { absolute: string }).absolute;
        const titles = results.map(titleOf);
        expect(new Set(titles).size).toBe(titles.length);
        const descriptions = results.map(m => m.description);
        expect(new Set(descriptions).size).toBe(descriptions.length);
        // 탭 없는 라우트(position)는 기존대로 기본 심볼 카피를 쓴다.
        const tabless = (await getBlockedSymbolMetadata({
            symbol: 'QQQ',
            assetInfo: ASSET_INFO,
            degraded: false,
            locale: 'ko',
            revalidateSeconds: 21600,
        }))!;
        expect(titleOf(tabless)).toBe(titles[0]);
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
        expectBlockedWithOwnIdentity(result, 'ZZZOF');
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
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                assetInfo: ASSET_INFO,
                degraded: true,
                locale: 'ko',
                hasSnapshot: true,
            })
        );
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
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                assetInfo: ASSET_INFO,
                degraded: true,
                locale: 'ko',
                hasSnapshot: false,
            })
        );
        expectBlockedWithOwnIdentity(result, 'AAPL');
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
            tab: 'news',
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            86400,
            'ko'
        );
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                assetInfo: ASSET_INFO,
                degraded: true,
                locale: 'ko',
                hasSnapshot: false,
            })
        );
        expectBlockedWithOwnIdentity(result, 'AAPL', '/news');
    });

    // 2026-10-01: 프리웜하지 않는 탭(`PREWARM_TABS` 밖)은 degraded여도 스냅샷을 읽지
    // 않는다 — 그 다섯 탭은 페이지가 항상 noindex라 `hasSnapshot`이 결과를 바꿀 수
    // 없다. 탭별 차단 카피는 그대로 써야 한다.
    it.each([
        'overall',
        'fundamental',
        'financials',
        'congress',
        'options',
    ] as const)(
        '프리웜 밖 탭(%s)은 degraded여도 스냅샷을 읽지 않고 탭별 카피로 차단한다',
        async tab => {
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
                tab,
            });

            expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
            expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
                expect.objectContaining({
                    symbol: 'AAPL',
                    assetInfo: ASSET_INFO,
                    degraded: true,
                    locale: 'ko',
                    hasSnapshot: undefined,
                })
            );
            expectBlockedWithOwnIdentity(result, 'AAPL', `/${tab}`);
        }
    );

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
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                assetInfo: ASSET_INFO,
                degraded: true,
                locale: 'ko',
                hasSnapshot: false,
            })
        );
        expectBlockedWithOwnIdentity(result, 'AAPL');
    });

    // position passes no `tab` — the DB read must be skipped entirely
    // and hasSnapshot must stay undefined so the existing degraded→noindex
    // behavior is preserved (never flipped indexable by another tab's row).
    it('skips the DB read entirely and keeps hasSnapshot=undefined when no tab is given (position)', async () => {
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
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                assetInfo: ASSET_INFO,
                degraded: true,
                locale: 'ko',
                hasSnapshot: undefined,
            })
        );
        expectBlockedWithOwnIdentity(result, 'AAPL');
    });

    // fear-greed는 제목 카피용 탭이다 — 스냅샷 탭이 아니므로 degraded여도 DB를 읽지 않고,
    // 차단 메타는 차트 탭이 아니라 공포·탐욕 제목을 쓴다(2026-10-05 TOSCF·SLROF 중복 title).
    it('fear-greed tab skips the DB read but blocks with its own title, not the chart title', async () => {
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'no-price-data',
        });
        const input = {
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            locale: 'ko' as const,
            revalidateSeconds: 86400,
        };

        const fearGreed = (await getBlockedSymbolMetadata({
            ...input,
            tab: 'fear-greed',
        }))!;
        // 스냅샷 탭이 아니므로 읽지 않는다.
        expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
        const chart = (await getBlockedSymbolMetadata({
            ...input,
            tab: 'technical',
            degraded: false,
        }))!;

        const titleOf = (m: Metadata): string =>
            (m.title as { absolute: string }).absolute;
        expect(titleOf(fearGreed)).not.toBe(titleOf(chart));
        expect(titleOf(fearGreed)).toContain('공포 탐욕');
    });

    // 2026-10-05: 산문 게이트 — 차트·뉴스 탭은 렌더 가능한 산문이 없으면 noindex(no-prose)다.
    describe('prose 상태(present/absent/unknown)', () => {
        const call = (tab: 'technical' | 'news', symbol = 'AAPL') =>
            getBlockedSymbolMetadata({
                symbol,
                assetInfo: ASSET_INFO,
                degraded: false,
                locale: 'ko',
                revalidateSeconds: 21600,
                tab,
            });
        const proseSent = () =>
            (
                mockEvaluateSymbolIndexability.mock.calls.find(
                    c => c[0].symbol !== undefined
                )?.[0] as { prose?: string } | undefined
            )?.prose;

        beforeEach(() => {
            mockEvaluateSymbolIndexability.mockReturnValue({
                indexable: true,
                reason: 'popular',
            });
        });

        it('행이 있어도 content가 렌더러 narrowing을 못 통과하면 absent다', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([
                { symbol: 'AAPL', tab: 'technical', content: { foo: 'bar' } },
            ]);

            await call('technical');

            expect(proseSent()).toBe('absent');
        });

        it('이 탭의 행이 없으면(다른 탭 행만 있으면) absent다', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([TECHNICAL_ROW]);

            await call('news');

            expect(proseSent()).toBe('absent');
        });

        it('뉴스 탭은 산문 기준이다 — 산문 행이 있으면 present', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([NEWS_ROW]);

            await call('news');

            expect(proseSent()).toBe('present');
        });

        it('스냅샷 읽기 실패(null)는 unknown이다 — 모르는 것을 absent로 읽지 않는다(fail-open)', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue(null);

            await call('technical');

            expect(proseSent()).toBe('unknown');
        });

        it('degraded + 읽기 실패(unknown)는 hasSnapshot=false다(degraded는 보수적)', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue(null);

            await getBlockedSymbolMetadata({
                symbol: 'AAPL',
                assetInfo: ASSET_INFO,
                degraded: true,
                locale: 'ko',
                revalidateSeconds: 21600,
                tab: 'technical',
            });

            expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
                expect.objectContaining({
                    hasSnapshot: false,
                    prose: 'unknown',
                })
            );
        });

        it('큐레이션 밖 롱테일은 어차피 noindex라 산문 판정용 읽기를 하지 않는다', async () => {
            await call('technical', 'ZZZOF');

            expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
            expect(proseSent()).toBeUndefined();
        });

        it('로케일 미준비(en)는 읽지 않는다 — 로케일 게이트가 먼저 결론을 낸다', async () => {
            await getBlockedSymbolMetadata({
                symbol: 'AAPL',
                assetInfo: ASSET_INFO,
                degraded: false,
                locale: 'en',
                revalidateSeconds: 21600,
                tab: 'technical',
            });

            expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
        });

        it('no-prose 차단은 self-canonical·follow:true로 낸다(항상-noindex 탭과 같은 방식)', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([]);
            mockEvaluateSymbolIndexability.mockReturnValue({
                indexable: false,
                reason: 'no-prose',
            });

            const result = await call('news');

            expect(result?.robots).toEqual({ index: false, follow: true });
            expect(result?.alternates).toEqual({
                canonical: 'https://siglens.io/AAPL/news',
            });
        });
    });
});
