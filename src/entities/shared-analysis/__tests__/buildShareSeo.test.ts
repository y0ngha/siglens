import { buildShareMetadata } from '../lib/buildShareSeo';
import type { SharedAnalysisLookup, SharedAnalysisSnapshot } from '../types';

vi.mock('../server/buildOgText', () => ({
    buildOgText: vi.fn(() => ({
        description: '강세 · 상승 추세',
        tweet: 'AAPL 강세 — 상승 추세',
    })),
}));

function foundLookup(
    kind: SharedAnalysisSnapshot['kind'] = 'chart'
): SharedAnalysisLookup {
    return {
        status: 'found',
        createdAt: '2024-01-15T09:00:00.000Z',
        snapshot: {
            kind,
            symbol: 'AAPL',
            context: {
                symbol: 'AAPL',
                displayName: 'Apple Inc.',
                assetClass: 'us_equity',
            },
            result: {} as SharedAnalysisSnapshot['result'],
        } as unknown as SharedAnalysisSnapshot,
    };
}

describe('buildShareMetadata', () => {
    describe('found state', () => {
        const meta = buildShareMetadata(foundLookup(), 'abc123');

        it('title contains ticker + "AI 분석 결과"', () => {
            expect(meta.title).toBe('AAPL AI 분석 결과');
        });

        it('description comes from buildOgText', () => {
            expect(meta.description).toBe('강세 · 상승 추세');
        });

        // C-8 checks
        it('[C-8] openGraph.title is present', () => {
            expect((meta.openGraph as { title?: string })?.title).toBeTruthy();
        });

        it('[C-8] openGraph.description is present', () => {
            expect(
                (meta.openGraph as { description?: string })?.description
            ).toBeTruthy();
        });

        it('[C-8] twitter.card === "summary_large_image"', () => {
            expect((meta.twitter as { card?: string })?.card).toBe(
                'summary_large_image'
            );
        });

        it('[C-8] robots.index === false', () => {
            expect((meta.robots as { index?: boolean })?.index).toBe(false);
        });

        it('[C-8] robots.follow === false', () => {
            expect((meta.robots as { follow?: boolean })?.follow).toBe(false);
        });

        it('openGraph.locale is ko_KR', () => {
            expect((meta.openGraph as { locale?: string })?.locale).toBe(
                'ko_KR'
            );
        });

        it('openGraph.siteName is SITE_NAME', () => {
            expect((meta.openGraph as { siteName?: string })?.siteName).toBe(
                'Siglens'
            );
        });
    });

    /**
     * og:url이 없으면 루트 레이아웃의 og:url(홈)이 상속돼, 언펄러가 공유
     * 카드에 홈 주소를 붙이거나 서로 다른 공유 링크를 같은 대상으로 접는다.
     * `id`는 필수 인자라 호출부는 컴파일러가 붙들고, 여기서는 값의 모양과
     * canonical과의 관계를 본다.
     */
    describe('openGraph.url', () => {
        it('id를 넘기면 공유 URL이 실린다', () => {
            const meta = buildShareMetadata(foundLookup(), 'abc123');
            expect((meta.openGraph as { url?: string })?.url).toMatch(
                /\/share\/abc123$/
            );
        });

        it('canonical은 여전히 null이다 — 두 값은 상충하지 않는다', () => {
            const meta = buildShareMetadata(foundLookup(), 'abc123');
            expect(meta.alternates?.canonical).toBeNull();
            expect((meta.robots as { index?: boolean })?.index).toBe(false);
        });

        it('타입이 호출부를 붙든다 — id는 선택 인자가 아니다', () => {
            // @ts-expect-error id를 빠뜨리면 컴파일이 막힌다.
            buildShareMetadata(foundLookup());
        });
    });

    describe('expired state', () => {
        const meta = buildShareMetadata({ status: 'expired' }, 'abc123');

        it('[C-8] robots.index === false', () => {
            expect((meta.robots as { index?: boolean })?.index).toBe(false);
        });

        it('has a generic title', () => {
            expect(meta.title).toBeTruthy();
        });
    });

    describe('not_found state', () => {
        const meta = buildShareMetadata({ status: 'not_found' }, 'abc123');

        it('[C-8] robots.index === false', () => {
            expect((meta.robots as { index?: boolean })?.index).toBe(false);
        });
    });
});
