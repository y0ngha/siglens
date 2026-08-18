import {
    ALL_NAV_REGION_LINKS,
    hasRegionForRoot,
    NAV_OVERVIEW_LINKS,
    NAV_VERTICALS,
    regionsOf,
    type NavVerticalId,
} from '../assetClassNav';

describe('NAV_VERTICALS', () => {
    it('declares every region href under its vertical root', () => {
        // 활성 상태 판정이 `pathname.startsWith(rootHref + '/')`에 기대므로, 이 불변식이
        // 깨지면 그 지역 페이지에서 1단 메뉴가 활성으로 보이지 않는다.
        for (const vertical of NAV_VERTICALS) {
            for (const region of vertical.regions) {
                expect(region.href.startsWith(vertical.rootHref)).toBe(true);
            }
        }
    });

    it('never repeats an href across the whole tree', () => {
        // 같은 목적지가 두 버티컬에 걸리면 활성 표시가 두 곳에 뜨고, 사이트맵 파생도
        // 중복 URL을 내보낸다.
        const hrefs = ALL_NAV_REGION_LINKS.map(l => l.href);
        expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    it('keeps region labels short and full labels self-contained', () => {
        for (const link of ALL_NAV_REGION_LINKS) {
            // 짧은 라벨은 버티컬 맥락 안에서만 읽히므로 수식어가 없어야 한다.
            expect(link.label).not.toContain(' ');
            // 반대로 fullLabel은 홀로 읽혀도 뜻이 통해야 한다(푸터·히어로가 쓴다).
            expect(link.fullLabel.length).toBeGreaterThan(link.label.length);
            expect(link.fullLabel).toContain(link.label);
        }
    });

    it('never puts a region label in the vertical label', () => {
        // 지역은 2단이 정한다 — 1단에 "미국"이 남아 있으면 `미국 시장 분석 > 한국`
        // 같은 모순된 경로가 생긴다.
        for (const vertical of NAV_VERTICALS) {
            expect(vertical.label).not.toMatch(/미국|한국|암호화폐/);
        }
    });

    it('opens 미국 for every vertical and 한국 for every vertical that has data', () => {
        for (const vertical of NAV_VERTICALS) {
            const regions = vertical.regions.map(r => r.region);
            expect(regions[0]).toBe('us');
            expect(regions).toContain('kr');
        }
    });

    it('opens 암호화폐 only for 뉴스', () => {
        // 공포·탐욕은 core 5요인이 채권 자산군을 요구해 암호화폐 대응이 없고,
        // 경제는 개념 자체가 없다. 눌렀더니 "표본 부족"만 나오는 링크는 없는 것만 못하다.
        for (const vertical of NAV_VERTICALS) {
            const hasCrypto = vertical.regions.some(r => r.region === 'crypto');
            expect(hasCrypto).toBe(vertical.id === 'news');
        }
    });
});

describe('regionsOf', () => {
    it('returns the declared regions for a known vertical', () => {
        expect(regionsOf('market').map(r => r.href)).toEqual([
            '/market',
            '/market/kr',
        ]);
    });

    it('throws on an unknown vertical instead of silently returning nothing', () => {
        // 조용히 빈 배열을 주면 오타 하나에 지역 탭이 통째로 사라지고, 화면에는
        // 아무 표시가 없다.
        expect(() => regionsOf('nope' as NavVerticalId)).toThrow(
            /unknown vertical/
        );
    });
});

/**
 * `/news`는 세 지역이 각자 다른 URL이라 허브가 어느 지역에도 속하지 않는다.
 * `hasRegionForRoot`가 뒤집히면 **푸터와 헤더 드로어 양쪽에서 동시에** `/news`
 * 앵커가 사라지고(이미 색인된 URL이 사이트 안에서 고아가 된다) 동시에
 * `/market`·`/fear-greed`·`/economy`가 푸터에 두 번 나온다. 판정식을 한 곳으로
 * 모은 대신 한 글자가 그 결과를 쥐게 됐으므로, 여기서 falsifiable하게 못박는다.
 */
describe('hasRegionForRoot / NAV_OVERVIEW_LINKS', () => {
    it('지역 링크로 못 가는 루트는 뉴스 허브 하나뿐이다', () => {
        expect(NAV_OVERVIEW_LINKS.map(l => l.href)).toEqual(['/news']);
    });

    it('나머지 버티컬은 루트가 지역 링크에 이미 들어 있다', () => {
        const withoutRegion = NAV_VERTICALS.filter(v => !hasRegionForRoot(v));
        expect(withoutRegion.map(v => v.id)).toEqual(['news']);
    });

    it('overview + 지역 링크를 합쳐도 href가 중복되지 않는다', () => {
        const hrefs = [
            ...NAV_OVERVIEW_LINKS.map(l => l.href),
            ...ALL_NAV_REGION_LINKS.map(l => l.href),
        ];
        expect(new Set(hrefs).size).toBe(hrefs.length);
    });
});
