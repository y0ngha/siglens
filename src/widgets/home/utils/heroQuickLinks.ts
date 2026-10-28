import { NAV_VERTICALS } from '@/shared/config/assetClassNav';

/**
 * 홈 히어로 아래 붙는 빠른 이동 링크.
 *
 * **`NAV_VERTICALS`에서 파생한다.** 목적지·라벨을 따로 적으면 헤더와 히어로가 같은
 * 목적지를 다른 이름으로 부르다 한쪽만 갱신된다. 단일 소스에서 파생해 둘이 어긋나지
 * 않게 한다.
 *
 * **허브가 아니라 최종 목적지만 넣는다.** `/news`(3지역 허브) 같은 중간 페이지를
 * 걸면 랜딩에서 원하는 화면까지 클릭이 두 번이 된다 — 자산군을 1차 축으로 올린
 * 목적이 "바로 들어가기"인데 히어로에서 허브를 거치면 그 이득이 사라진다.
 * 그래서 전부 `regions[*].href`(= 실제 페이지)를 쓴다.
 *
 * 선택 규칙: **`시장 분석`은 지역을 전부 펼치고**(랜딩에서 가장 많이 쓰이는
 * 진입점이라 한 번에 시장을 고르게 한다), 나머지 버티컬은 첫 지역(미국) 하나씩만
 * 노출한다. 전부 펼치면 히어로 밑에 링크가 9개 깔려 CTA가 묻힌다.
 */
export interface HeroQuickLink {
    readonly href: string;
    /** 라벨의 완전 수식 메시지 키. 소비자가 `t()`로 푼다. */
    readonly labelKey: string;
}

/** 지역까지 펼쳐 보여줄 버티컬. 나머지는 첫 지역 1개만 노출한다. */
const EXPANDED_VERTICAL_ID = 'market';

/** 히어로 퀵링크 목록 — `NAV_VERTICALS`에서 파생하므로 헤더 내비와 항상 같은 목적지를 가리킨다. */
export const HERO_QUICK_LINKS: ReadonlyArray<HeroQuickLink> =
    NAV_VERTICALS.flatMap(vertical => {
        const shown =
            vertical.id === EXPANDED_VERTICAL_ID
                ? vertical.regions
                : vertical.regions.slice(0, 1);
        // 히어로는 버티컬 맥락 없이 홀로 읽히므로 짧은 라벨(`미국`)이 아니라
        // `fullLabel`(`미국 시장 분석`)을 쓴다.
        return shown.map(region => ({
            href: region.href,
            labelKey: region.fullLabelKey,
        }));
    });
