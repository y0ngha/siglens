import { buildShareMetadata } from '../lib/buildShareSeo';
import type { SharedAnalysisLookup, SharedAnalysisSnapshot } from '../types';

import koMessages from '@/../messages/ko.json';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

const tOg = catalogTranslator('entities.shared-analysis.og', 'ko');

/** 실제 ko 카탈로그를 읽는 번역자 — 스텁이면 키 누락이 조용히 통과한다. */
const tSeo = (key: string, values?: Record<string, string | number>) => {
    const table = koMessages.entities['shared-analysis'].seo as Record<
        string,
        string
    >;
    const raw = table[key];
    if (raw === undefined) return key;
    return Object.entries(values ?? {}).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
        raw
    );
};

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
        const meta = buildShareMetadata(
            foundLookup(),
            'abc123',
            tSeo,
            'ko',
            tOg
        );

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
            const meta = buildShareMetadata(
                foundLookup(),
                'abc123',
                tSeo,
                'ko',
                tOg
            );
            expect((meta.openGraph as { url?: string })?.url).toMatch(
                /\/share\/abc123$/
            );
        });

        it('canonical은 여전히 null이다 — 두 값은 상충하지 않는다', () => {
            const meta = buildShareMetadata(
                foundLookup(),
                'abc123',
                tSeo,
                'ko',
                tOg
            );
            expect(meta.alternates?.canonical).toBeNull();
            expect((meta.robots as { index?: boolean })?.index).toBe(false);
        });

        it('타입이 호출부를 붙든다 — 뒤 인자는 선택이 아니다', () => {
            // **부르지 않는다.** 목적은 컴파일 시점 검사인데, 인자를 빼고
            // 실제로 부르면 번역자가 없어 런타임이 먼저 죽는다. 아래
            // `@ts-expect-error`는 이 호출이 유효해지는 순간 실패하므로
            // 실행 없이도 계약을 붙든다.
            const call = () =>
                // @ts-expect-error 뒤 인자를 빠뜨리면 컴파일이 막힌다.
                buildShareMetadata(foundLookup());
            expect(call).toBeTypeOf('function');
        });
    });

    describe('expired state', () => {
        const meta = buildShareMetadata(
            { status: 'expired' },
            'abc123',
            tSeo,
            'ko',
            tOg
        );

        it('[C-8] robots.index === false', () => {
            expect((meta.robots as { index?: boolean })?.index).toBe(false);
        });

        it('has a generic title', () => {
            expect(meta.title).toBeTruthy();
        });
    });

    describe('not_found state', () => {
        const meta = buildShareMetadata(
            { status: 'not_found' },
            'abc123',
            tSeo,
            'ko',
            tOg
        );

        it('[C-8] robots.index === false', () => {
            expect((meta.robots as { index?: boolean })?.index).toBe(false);
        });
    });
});
