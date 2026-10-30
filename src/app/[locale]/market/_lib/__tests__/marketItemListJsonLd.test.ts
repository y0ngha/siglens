import { describe, expect, it } from 'vitest';
import { buildMarketItemListJsonLd } from '@/app/[locale]/market/_lib/marketItemListJsonLd';
import {
    US_DASHBOARD_SCOPE,
    type DashboardScope,
} from '@/shared/config/dashboardScope';

/**
 * 큐레이션 목록(`POPULAR_TICKERS`)에 있는 `XLK`와 없는 가상 심볼 하나만 둔 scope.
 * 스캐너 탭 목록(`signalSectors`)은 실제 설정 그대로라 ETF가 없는 테마가 섞여 있다.
 */
const SCOPE: DashboardScope = {
    ...US_DASHBOARD_SCOPE,
    sectorEtfs: [
        { symbol: 'XLK', sectorName: 'Technology', koreanName: '기술' },
        { symbol: 'ZZQX', sectorName: 'Test', koreanName: '테스트' },
    ],
};

describe('buildMarketItemListJsonLd', () => {
    it('섹터 ETF만 싣고, 색인되는 종목에만 로케일별 종목 페이지 url을 단다', () => {
        expect(buildMarketItemListJsonLd(SCOPE, '섹터 목록', 'en')).toEqual({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: '섹터 목록',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: '기술 (Technology, XLK)',
                    url: 'https://siglens.io/en/XLK',
                },
                {
                    '@type': 'ListItem',
                    position: 2,
                    name: '테스트 (Test, ZZQX)',
                },
            ],
        });
    });

    it('기본 로케일 url에는 접두사를 붙이지 않는다', () => {
        expect(
            buildMarketItemListJsonLd(SCOPE, '섹터 목록', 'ko')
        ).toMatchObject({
            itemListElement: [{ url: 'https://siglens.io/XLK' }, {}],
        });
    });
});
