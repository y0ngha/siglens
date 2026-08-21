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
        const meta = buildShareMetadata(foundLookup(), tSeo, 'ko', tOg);

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

    describe('expired state', () => {
        const meta = buildShareMetadata({ status: 'expired' }, tSeo, 'ko', tOg);

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
            tSeo,
            'ko',
            tOg
        );

        it('[C-8] robots.index === false', () => {
            expect((meta.robots as { index?: boolean })?.index).toBe(false);
        });
    });
});
