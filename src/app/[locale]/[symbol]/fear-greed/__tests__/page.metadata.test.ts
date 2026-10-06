/**
 * `/[symbol]/fear-greed`는 **색인한다**(2026-10-01 사용자 결정, `SEO_RECOVERY_2026_09.md` §10).
 *
 * 2026-09-17 운영 렌더 감사는 이 탭을 항상 noindex로 돌렸으나(본문 92%가 공통 문장),
 * 롱테일 수요를 받을 페이지가 사라져 되돌렸다. 대신 차트 라우트와 같은 콘텐츠 게이트를
 * 탄다 — 봉 조회 실패는 degrade, **점수 산출 불가**(`hasFearGreedScore` false)는
 * `no-price-data`, 화이트리스트 밖 롱테일은 중앙 게이트로 noindex다. 공유 카드용
 * title과 follow는 모든 경로에서 유지된다.
 *
 * 게이트 술어는 본문 `FearGreedFactsSummary`가 점수를 그리는 조건과 같다 — 2026-10-04
 * `/TOSCF`·`/SLROF`는 봉은 있으나 점수 표본이 모자라 본문이 도입 문단뿐인데도
 * `buildTechnicalFacts` 게이트(봉 2개 이상) 때문에 색인돼 있었다. 점수 계산은 실제
 * `computeFearGreedIndex`를 쓴다(모킹하면 두 술어가 갈리는 구간을 못 본다).
 */

// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const { mockGetAssetInfoResilient, mockGetSeedBarsStatic } = vi.hoisted(() => ({
    mockGetAssetInfoResilient: vi.fn(),
    mockGetSeedBarsStatic: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string }) => info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

vi.mock('@/entities/bars/lib/sessionBarsStaticCache', () => ({
    // 페이지는 5년 일봉이 담긴 세션 키 축소 봉(revalidate 24h)을 쓴다 — 6h 봉 캐시를
    // 읽으면 이 탭(24h 선언)이 6h로 clamp된다.
    getSessionBarsStatic: mockGetSeedBarsStatic,
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { generateMetadata } from '@/app/[locale]/[symbol]/fear-greed/page';
import { buildFearGreedSeedBars } from '@/__tests__/utils/fearGreedSeedBars';

// 실제 `computeFearGreedIndex`가 점수를 내는 봉 수(300). 같은 fixture를 20봉으로 자르면
// `buildTechnicalFacts`는 값을 내지만 점수는 null이다.
const BARS_WITH_DATA = buildFearGreedSeedBars(300);
const BARS_WITHOUT_SCORE = buildFearGreedSeedBars(20);

const ASSET_INFO = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        fmpSymbol: 'AAPL',
    },
    degraded: false,
};

describe('fear-greed generateMetadata — 색인 대상 (콘텐츠 게이트 통과 시)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(ASSET_INFO);
        mockGetSeedBarsStatic.mockResolvedValue(BARS_WITH_DATA);
    });

    it('인기 종목은 색인 가능 + self-canonical (소문자 입력도 대문자로 정규화)', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/fear-greed'
        );
    });

    it('공유 카드용 title은 남긴다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(JSON.stringify(metadata.title)).toContain('AAPL');
    });

    it('설명은 점수에서 만든 종목별 사실이다 — 날짜·점수·1주/1개월 전·1년 범위', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.description).toMatch(
            /^AAPL 공포 탐욕 지수는 \d+월 \d+일 종가 기준 \d+점\([^)]+\)입니다\. 1주 전 \d+점, 1개월 전 \d+점/
        );
        expect(metadata.description).toMatch(
            /최근 1년 동안 \d+~\d+점 사이에서 움직였습니다\.$/
        );
        // 기존 템플릿 문구가 아니다.
        expect(metadata.description).not.toContain('매수세');
        expect(metadata.description).not.toMatch(/매수|매도|매매/);
    });

    it('설명을 만들려고 봉을 다시 읽지 않는다(요청 단위 캐시를 그대로 쓴다)', async () => {
        await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        // 색인 게이트와 설명이 같은 한 번의 조회를 공유한다.
        expect(mockGetSeedBarsStatic).toHaveBeenCalledTimes(1);
    });

    it('봉 조회가 실패하면 degrade로 보고 noindex(follow 유지)', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockGetSeedBarsStatic.mockRejectedValue(new Error('bars infra down'));

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        // self-canonical(2026-10-05) — `canonical: null`이 아니다.
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/fear-greed'
        );
        spy.mockRestore();
    });

    it('봉은 있으나 점수 표본이 모자라 점수가 안 그려지면(no-price-data) noindex', async () => {
        mockGetSeedBarsStatic.mockResolvedValue(BARS_WITHOUT_SCORE);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        // self-canonical(2026-10-05) — `canonical: null`이 아니다.
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/fear-greed'
        );
        // 막혀도 차트 탭 제목이 아니라 이 탭의 제목이다(2026-10-05 중복 title).
        expect(JSON.stringify(metadata.title)).toContain('공포 탐욕');
    });

    it('봉이 1개뿐이어도 noindex', async () => {
        mockGetSeedBarsStatic.mockResolvedValue(buildFearGreedSeedBars(1));

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        // self-canonical(2026-10-05) — `canonical: null`이 아니다.
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/fear-greed'
        );
    });

    it('화이트리스트 밖 롱테일 종목은 noindex', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'ZZZQ', name: 'Zzzq Corp', fmpSymbol: 'ZZZQ' },
            degraded: false,
        });

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'zzzq' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        // self-canonical(2026-10-05) — `canonical: null`이 아니다.
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/ZZZQ/fear-greed'
        );
    });
});
