import { describe, expect, it } from 'vitest';
import { buildMarketItemListJsonLd } from '@/app/[locale]/market/_lib/marketItemListJsonLd';
import { isPopularSymbol } from '@/entities/ticker/lib/searchRelevance';
import { US_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';

type ListItem = { name: string; position: number; url?: string };

function items(locale: 'ko' | 'en'): ListItem[] {
    return (
        buildMarketItemListJsonLd(US_DASHBOARD_SCOPE, '섹터 목록', locale) as {
            itemListElement: ListItem[];
        }
    ).itemListElement;
}

describe('buildMarketItemListJsonLd', () => {
    it('스캐너 탭이 아니라 섹터 ETF만 싣는다', () => {
        expect(items('ko').map(item => item.name)).toEqual(
            US_DASHBOARD_SCOPE.sectorEtfs.map(
                sector =>
                    `${sector.koreanName} (${sector.sectorName}, ${sector.symbol})`
            )
        );
    });

    it('색인되는 종목에만 로케일별 종목 페이지 url을 단다', () => {
        const withUrl = US_DASHBOARD_SCOPE.sectorEtfs.flatMap((sector, i) =>
            isPopularSymbol(sector.symbol)
                ? [[i, `https://siglens.io/en/${sector.symbol}`] as const]
                : []
        );

        const built = items('en');

        expect(withUrl.length).toBeGreaterThan(0);
        for (const [index, url] of withUrl) {
            expect(built[index]?.url).toBe(url);
        }
        expect(built.filter(item => item.url !== undefined)).toHaveLength(
            withUrl.length
        );
    });

    it('위치는 1부터 센다', () => {
        expect(items('ko')[0]?.position).toBe(1);
    });
});
