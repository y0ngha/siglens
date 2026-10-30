import { NAV_VERTICALS } from '@/shared/config/assetClassNav';
import { columnOf } from '../../utils/footerColumns';

/** 키와 값을 그대로 이어 붙이는 번역 대역 — 어떤 키가 어떤 인자로 불렸는지 결과에서 읽힌다. */
const tNav = (key: string, values?: Record<string, string>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key;

describe('columnOf', () => {
    const market = NAV_VERTICALS.find(v => v.id === 'market')!;
    const news = NAV_VERTICALS.find(v => v.id === 'news')!;

    it('열 id와 제목은 버티컬에서 온다', () => {
        const column = columnOf(market, tNav);

        expect(column.id).toBe('market');
        expect(column.label).toBe(market.labelKey);
    });

    it('지역 링크를 풀 라벨로 평탄화한다', () => {
        const column = columnOf(market, tNav);

        expect(column.links).toEqual(
            market.regions.map(region => ({
                href: region.href,
                label: region.fullLabelKey,
            }))
        );
    });

    it('지역에 속하지 않는 허브는 열의 첫 항목으로 넣는다', () => {
        const column = columnOf(news, tNav);

        expect(column.links[0]).toEqual({
            href: '/news',
            label: `shared.config.nav.overviewAll(${news.labelKey})`,
        });
    });

    it('허브가 지역 목록에 이미 있으면 따로 넣지 않는다', () => {
        const column = columnOf(market, tNav);

        expect(column.links.map(link => link.href)).toEqual(
            market.regions.map(region => region.href)
        );
    });
});
