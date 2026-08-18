import { HERO_QUICK_LINKS } from '../heroQuickLinks';
import { NAV_ITEMS } from '@/widgets/layout/headerNavItems';

describe('HERO_QUICK_LINKS', () => {
    it('pins the exact label for every hero link', () => {
        expect(HERO_QUICK_LINKS.map(l => l.label)).toEqual([
            '오늘 주목할 종목',
            '미국 시장 뉴스',
            '미국 경제',
        ]);
    });

    it('only points at destinations the header nav also exposes', () => {
        // 히어로에만 있는 목적지는 헤더에서 사라진 라우트를 가리키는 죽은 링크가 되기 쉽다.
        const navHrefs = new Set(NAV_ITEMS.map(i => i.href));
        for (const link of HERO_QUICK_LINKS) {
            expect(navHrefs).toContain(link.href);
        }
    });

    it('names the market in the header label of every US-only destination', () => {
        // 사이트가 미국·한국·암호화폐를 함께 다니므로 미국 전용 페이지는 라벨에
        // 시장이 드러나야 한다. `/market`도 목적지 h1이 "오늘의 미국 주식…"이라
        // 미국 전용이다 — 빠뜨리면 홈의 `한국 섹터별 인기 종목` 바로 위에서
        // `시장 분석`이 두 시장을 다 덮는 것처럼 읽힌다.
        //
        // 히어로는 CTA 문구라 이 규칙에서 뺀다(`오늘 주목할 종목`) — 위 케이스가
        // 히어로 라벨을 이미 정확히 고정한다.
        for (const href of ['/market', '/news', '/economy']) {
            expect(NAV_ITEMS.find(i => i.href === href)?.label).toContain(
                '미국'
            );
        }
    });
});
