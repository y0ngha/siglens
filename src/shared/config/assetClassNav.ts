/**
 * 자산군(지역) × 버티컬 내비게이션의 **단일 소스**.
 *
 * 사이트는 미국 주식으로 출발해 암호화폐·한국 주식으로 넓어졌는데, 확장이 미국
 * 페이지 안쪽으로 흡수되면서 "자산군"이 2차 개념으로 숨었다(암호화폐 뉴스를 보려면
 * "미국 시장 뉴스 허브"를 거쳐야 했다). 이 배열은 자산군을 1차 축으로 끌어올린
 * 결과이며, 아래 **네 표면**이 전부 여기서 파생된다.
 *
 * 1. `widgets/layout/HeaderNav*` — 데스크톱 드롭다운
 * 2. `widgets/layout/HeaderMobileMenu` — 모바일 드로어(섹션 + 지역 링크)
 * 3. `widgets/layout/Footer` — 평탄화한 전체 링크
 * 4. `widgets/home/heroQuickLinks` — 홈 히어로 퀵링크
 *
 * **왜 단일 소스여야 하는가**: 2026-08 감사에서 헤더와 홈 히어로가 같은 목적지를
 * 다른 라벨로 가리키고 한쪽만 갱신된 이력이 있다. 버티컬마다 지역 개수가 다른
 * 지금(뉴스 3 / 나머지 2)은 드리프트 확률이 더 높다. 여기 한 곳만 고치면 네 표면이
 * 동시에 따라온다.
 *
 * **지역 개수가 버티컬마다 다른 것은 의도다.** 데이터가 없는 지역은 메뉴에 열지
 * 않는다 — 눌렀더니 "표본이 부족합니다"만 나오는 링크는 없는 것만 못하다.
 * 근거는 `docs/superpowers/specs/2026-08-19-asset-class-navigation-design.md` §1.3.
 */

/** 지역(자산군) 축. 암호화폐는 지리적 지역이 아니지만 사용자에게는 같은 층의 선택지다. */
export type NavRegionId = 'us' | 'kr' | 'crypto';

/** 버티컬 축 — 헤더 1단 메뉴에 대응한다. */
export type NavVerticalId = 'market' | 'fear-greed' | 'news' | 'economy';

export interface NavRegionLink {
    readonly region: NavRegionId;
    /** 드롭다운/탭에 보이는 짧은 라벨(`미국`). 버티컬 맥락 안에서만 읽힌다. */
    readonly label: string;
    /**
     * 맥락 없이 홀로 읽혀도 뜻이 통하는 라벨(`미국 시장 분석`).
     * 푸터와 `aria-label`이 쓴다 — 푸터는 버티컬 그룹핑 없이 평탄하게 나열하므로
     * 짧은 라벨만 쓰면 `미국 · 한국 · 미국 · 한국`처럼 의미를 잃는다.
     */
    readonly fullLabel: string;
    readonly href: string;
}

export interface NavVertical {
    readonly id: NavVerticalId;
    /** 1단 메뉴 라벨. 지역 수식어(`미국`)를 **붙이지 않는다** — 지역은 2단이 정한다. */
    readonly label: string;
    /**
     * 버티컬의 대표 목적지 — 활성 상태 판정(하위 경로 접두사)과 홈 퀵링크가 쓴다.
     *
     * 대부분은 첫 지역(미국)의 href와 같다. **뉴스만 다르다**: `/news`가 3지역
     * 상위 허브라 대표 목적지이고, 미국은 `/news/us`라는 별도 지역 허브를 갖는다.
     * 그래서 "rootHref === regions[0].href"를 불변식으로 두지 않는다.
     * 모든 지역 href가 rootHref로 시작해야 한다는 것만 테스트가 고정한다.
     */
    readonly rootHref: string;
    readonly regions: readonly NavRegionLink[];
}

export const NAV_VERTICALS: readonly NavVertical[] = [
    {
        id: 'market',
        label: '시장 분석',
        rootHref: '/market',
        regions: [
            {
                region: 'us',
                label: '미국',
                fullLabel: '미국 시장 분석',
                href: '/market',
            },
            {
                region: 'kr',
                label: '한국',
                fullLabel: '한국 시장 분석',
                href: '/market/kr',
            },
        ],
    },
    {
        id: 'fear-greed',
        label: '공포·탐욕 지수',
        rootHref: '/fear-greed',
        regions: [
            {
                region: 'us',
                label: '미국',
                fullLabel: '미국 공포·탐욕 지수',
                href: '/fear-greed',
            },
            {
                region: 'kr',
                label: '한국',
                fullLabel: '한국 공포·탐욕 지수',
                href: '/fear-greed/kr',
            },
        ],
    },
    {
        id: 'news',
        label: '뉴스',
        rootHref: '/news',
        regions: [
            {
                region: 'us',
                label: '미국',
                fullLabel: '미국 시장 뉴스',
                href: '/news/us',
            },
            {
                region: 'kr',
                label: '한국',
                fullLabel: '한국 시장 뉴스',
                href: '/news/kr',
            },
            {
                region: 'crypto',
                label: '암호화폐',
                fullLabel: '암호화폐 뉴스',
                href: '/news/crypto',
            },
        ],
    },
    {
        id: 'economy',
        label: '경제',
        rootHref: '/economy',
        regions: [
            {
                region: 'us',
                label: '미국',
                fullLabel: '미국 경제',
                href: '/economy',
            },
            {
                region: 'kr',
                label: '한국',
                fullLabel: '한국 경제',
                href: '/economy/kr',
            },
        ],
    },
] as const;

/**
 * 한 버티컬의 지역 링크 조회 — 페이지가 자기 지역 탭 스트립을 그릴 때 쓴다.
 *
 * 페이지가 `NAV_VERTICALS`를 직접 훑어 `find`하면 오타 난 id가 조용히
 * `undefined`가 되어 탭이 통째로 사라진다. 여기서 한 번 던져 배선 실수를 드러낸다.
 */
export function regionsOf(verticalId: NavVerticalId): readonly NavRegionLink[] {
    const vertical = NAV_VERTICALS.find(v => v.id === verticalId);
    if (!vertical) {
        throw new Error(`[assetClassNav] unknown vertical: ${verticalId}`);
    }
    return vertical.regions;
}

/** 모든 지역 링크를 버티컬 순서대로 평탄화. 푸터와 사이트맵 정합성 테스트가 쓴다. */
export const ALL_NAV_REGION_LINKS: readonly NavRegionLink[] =
    NAV_VERTICALS.flatMap(v => v.regions);

/**
 * 이 버티컬의 루트가 지역 링크로 도달 가능한가.
 *
 * `/market`·`/fear-greed`·`/economy`는 자기 버티컬의 미국 지역 URL이기도 해서
 * 이미 지역 목록에 들어 있다. `/news`만 다르다 — 세 지역이 각자 다른 URL이라
 * 허브가 어느 지역에도 속하지 않는다.
 *
 * **판정식은 여기 한 곳에만 둔다.** 헤더 트리(`NAV_TREE.overview`)와 푸터가 같은
 * 식을 각자 적고 있으면, 그건 이 모듈이 생긴 사고(헤더와 히어로가 같은 목적지를
 * 다르게 부르다 한쪽만 갱신됨)와 같은 모양이다.
 */
export function hasRegionForRoot(vertical: NavVertical): boolean {
    return vertical.regions.some(r => r.href === vertical.rootHref);
}

/**
 * 지역 링크로는 도달하지 않는 버티컬 상위 페이지들(현재는 `/news` 하나).
 *
 * 이걸 안 걸면 이미 색인돼 있고 이번에 의미까지 바뀐 URL이 사이트 안에서 보이는
 * 앵커를 하나도 갖지 못한다 — 헤더 드롭다운은 `invisible` 패널 + `hidden lg:flex`
 * 안이라 크롤러 기준으로 약한 신호다.
 */
export const NAV_OVERVIEW_LINKS: readonly NavRegionLink[] =
    NAV_VERTICALS.flatMap(v =>
        hasRegionForRoot(v)
            ? []
            : [
                  {
                      region: v.regions[0]!.region,
                      label: v.label,
                      fullLabel: `${v.label} 전체`,
                      href: v.rootHref,
                  },
              ]
    );
