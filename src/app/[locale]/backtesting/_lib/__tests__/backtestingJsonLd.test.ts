const statsState = vi.hoisted(() => ({
    stats: { periodStart: '2024-11', periodEnd: '2026-03' },
}));
vi.mock('@/app/[locale]/backtesting/_lib/backtestingData', () => ({
    get BACKTEST_STATS() {
        return statsState.stats;
    },
}));

import { buildBacktestingJsonLd } from '@/app/[locale]/backtesting/_lib/backtestingJsonLd';

const t = (key: string) => `shared:${key}`;
/** 키 경로가 아니라 `app.backtesting.seo` 범위의 키만 해석하는 번역자. */
const tPage = (key: string) => {
    if (key !== 'datasetName' && key !== 'variableMeasured') {
        throw new Error(`MISSING_MESSAGE: ${key}`);
    }
    return `page:${key}`;
};

const build = () => buildBacktestingJsonLd(t, tPage, '백테스팅', 'ko');

describe('backtesting JSON-LD', () => {
    beforeEach(() => {
        statsState.stats = { periodStart: '2024-11', periodEnd: '2026-03' };
    });

    it('Dataset 이름은 app.backtesting.seo의 datasetName 키로 해석한다', () => {
        expect(build().datasetJsonLd.name).toBe('page:datasetName');
    });

    it('variableMeasured도 app.backtesting.seo 번역자로 해석한다', () => {
        expect(build().datasetJsonLd.variableMeasured).toBe(
            'page:variableMeasured'
        );
    });

    it('temporalCoverage는 화면 통계의 기간과 같다', () => {
        expect(build().datasetJsonLd.temporalCoverage).toBe('2024-11/2026-03');
    });

    it('dateModified는 periodEnd 문자열 그대로다', () => {
        expect(build().datasetJsonLd).toHaveProperty('dateModified', '2026-03');
    });

    it('periodEnd가 비어 있으면 dateModified를 싣지 않는다', () => {
        statsState.stats = { periodStart: '', periodEnd: '' };
        expect(build().datasetJsonLd).not.toHaveProperty('dateModified');
    });

    it('distribution은 data.json 다운로드 URL을 가리킨다', () => {
        expect(build().datasetJsonLd.distribution).toEqual([
            {
                '@type': 'DataDownload',
                encodingFormat: 'application/json',
                contentUrl: 'https://siglens.io/backtesting/data.json',
            },
        ]);
    });

    it('Dataset 노드의 키 순서를 고정한다', () => {
        expect(Object.keys(build().datasetJsonLd)).toEqual([
            '@context',
            '@type',
            'name',
            'description',
            'url',
            'identifier',
            'creator',
            'license',
            'temporalCoverage',
            'dateModified',
            'spatialCoverage',
            'variableMeasured',
            'keywords',
            'distribution',
        ]);
    });

    it('Dataset url은 로케일별 URL이다', () => {
        const en = buildBacktestingJsonLd(t, tPage, 'Backtesting', 'en');
        expect(en.datasetJsonLd.url).toBe('https://siglens.io/en/backtesting');
    });

    it('브레드크럼 마지막 마디 이름은 넘긴 라벨이다', () => {
        expect(build().breadcrumbJsonLd.itemListElement).toEqual([
            {
                '@type': 'ListItem',
                position: 1,
                name: '시그렌즈',
                item: 'https://siglens.io',
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: '백테스팅',
                item: 'https://siglens.io/backtesting',
            },
        ]);
    });
});
