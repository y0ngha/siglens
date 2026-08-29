import { HERO_QUICK_LINKS } from '../heroQuickLinks';
import { koMessage } from '@/shared/test-utils/koMessage';
import {
    ALL_NAV_REGION_LINKS,
    NAV_VERTICALS,
} from '@/shared/config/assetClassNav';

describe('HERO_QUICK_LINKS', () => {
    it('pins the exact label for every hero link', () => {
        expect(HERO_QUICK_LINKS.map(l => koMessage(l.labelKey))).toEqual([
            '미국 시장 분석',
            '한국 시장 분석',
            '미국 공포·탐욕 지수',
            '미국 시장 뉴스',
            '미국 경제',
        ]);
    });

    it('only points at destinations the nav config also exposes', () => {
        // 히어로에만 있는 목적지는 헤더에서 사라진 라우트를 가리키는 죽은 링크가 되기 쉽다.
        const navHrefs = new Set(ALL_NAV_REGION_LINKS.map(i => i.href));
        for (const link of HERO_QUICK_LINKS) {
            expect(navHrefs).toContain(link.href);
        }
    });

    it('never points at a hub — every destination is a leaf page', () => {
        // 랜딩에서 허브를 거치면 원하는 화면까지 클릭이 두 번이 된다. 자산군을 1차
        // 축으로 올린 목적이 "바로 들어가기"이므로 히어로는 최종 목적지만 건다.
        const hubHrefs = new Set(
            NAV_VERTICALS.map(v => v.rootHref).filter(
                root => !ALL_NAV_REGION_LINKS.some(r => r.href === root)
            )
        );
        // `/news`가 유일한 허브 전용 경로다(미국은 `/news/us`가 따로 있다).
        expect(hubHrefs).toContain('/news');
        for (const link of HERO_QUICK_LINKS) {
            expect(hubHrefs).not.toContain(link.href);
        }
    });

    it('names the market on every hero label', () => {
        // 히어로는 버티컬 맥락 없이 홀로 읽힌다 — `미국`/`한국` 같은 짧은 라벨만
        // 쓰면 무엇의 미국인지 알 수 없다.
        for (const link of HERO_QUICK_LINKS) {
            expect(koMessage(link.labelKey)).toMatch(/미국|한국|암호화폐/);
        }
    });

    it('expands every region of the market vertical', () => {
        // 랜딩에서 가장 많이 쓰이는 진입점이라 시장 선택을 한 번에 끝내야 한다.
        const marketRegions = NAV_VERTICALS.find(
            v => v.id === 'market'
        )?.regions;
        expect(marketRegions).toBeDefined();
        const heroHrefs = new Set(HERO_QUICK_LINKS.map(l => l.href));
        for (const region of marketRegions ?? []) {
            expect(heroHrefs).toContain(region.href);
        }
    });
});
