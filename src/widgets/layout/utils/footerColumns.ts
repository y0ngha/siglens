import {
    hasRegionForRoot,
    type NavVertical,
} from '@/shared/config/assetClassNav';

/**
 * 푸터 링크 하나. 화면에 보이는 텍스트가 곧 **전체 이름**이다(`미국 시장 분석`).
 *
 * 열 제목 아래에 `미국`·`한국` 같은 짧은 라벨만 보이면 앵커 텍스트(보이는 글자)가 목적지 주제를
 * 말하지 못한다. 열 제목과 시각적으로 겹치는 비용을 내고 앵커가 주제를 말하게 한다. 숨김 텍스트는
 * 두지 않는다 — 보이는 글자가 곧 이름이라 `aria-label`도 `sr-only` 조각도 필요 없다.
 */
export interface FooterLink {
    readonly href: string;
    /** 화면에 보이는 전체 이름. */
    readonly label: string;
}

export interface FooterColumn {
    readonly id: string;
    readonly label: string;
    readonly links: readonly FooterLink[];
}

/** 완전 수식 키를 푸는 번역 함수. */
export type NavTranslator = (
    key: string,
    values?: Record<string, string>
) => string;

/**
 * 버티컬 1개를 푸터 열로 만든다.
 *
 * 지역에 속하지 않는 상위 허브(현재 `/news`)는 자기 열의 **첫 항목**으로 넣는다. 판정은
 * `assetClassNav`의 `hasRegionForRoot`가 소유한다 — 같은 식을 여기 또 적으면 두 표면이 각자
 * 판정하다 한쪽만 갱신된다.
 */
export function columnOf(
    vertical: NavVertical,
    tNav: NavTranslator
): FooterColumn {
    const label = tNav(vertical.labelKey);
    const overview: readonly FooterLink[] = hasRegionForRoot(vertical)
        ? []
        : [
              {
                  href: vertical.rootHref,
                  label: tNav('shared.config.nav.overviewAll', { v0: label }),
              },
          ];
    return {
        id: vertical.id,
        label,
        links: [
            ...overview,
            ...vertical.regions.map(region => ({
                href: region.href,
                label: tNav(region.fullLabelKey),
            })),
        ],
    };
}
