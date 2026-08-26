import { ContactDialog } from './ContactDialog';
import { CurrentYear } from './CurrentYear';
import {
    hasRegionForRoot,
    NAV_VERTICALS,
    type NavVertical,
} from '@/shared/config/assetClassNav';
import {
    INVESTMENT_DISCLAIMER,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/shared/lib/legal';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * 푸터 링크 하나. `visible`만 눈에 보이고 `srPrefix`/`srSuffix`는 화면에서 숨는다.
 *
 * **왜 쪼개는가**: 카테고리 열로 묶으면 `시장 분석` 아래에 `미국 시장 분석`을
 * 다시 적는 게 시각적으로 군더더기다 — 헤더 드롭다운도 이 자리에서 `미국`만
 * 쓴다. 그런데 보이는 글자를 그냥 짧게 줄이면 **앵커 텍스트가 9개 바뀐다.**
 * 푸터는 전 페이지에 렌더되는 전역 링크 집합이라 그 변경의 사정거리가 사이트
 * 전체다. 그래서 눈에는 짧은 라벨만 보이되 접근성 이름과 크롤러가 읽는 텍스트는
 * `fullLabel` 그대로 남긴다.
 */
/** `fullLabel`을 눈에 보이는 조각과 숨는 조각으로 가른 결과. */
interface FooterLabelParts {
    readonly srPrefix: string;
    readonly visible: string;
    readonly srSuffix: string;
}

interface FooterLink extends FooterLabelParts {
    readonly href: string;
    /**
     * 접근성 이름으로 그대로 건다.
     *
     * 쪼갠 조각만으로는 이름이 붙지 않는다 — `computeAccessibleName`이 텍스트
     * 노드를 **각각 trim한 뒤 이어붙여서** 조각 사이의 공백이 사라진다
     * (`미국` + `sr-only(" 시장 분석")` → `미국시장 분석`). 공백을 어느 조각에
     * 넣어도 그 조각의 끝/앞이라 똑같이 잘린다. 그래서 이름은 쪼개기와 무관하게
     * `aria-label`로 못박는다.
     *
     * 앵커 텍스트는 이것과 별개다 — 크롤러는 접근성 트리가 아니라 DOM 텍스트를
     * 읽으므로 `sr-only` 조각이 계속 제 일을 한다. WCAG 2.5.3(Label in Name)도
     * 이름이 보이는 글자를 포함하므로 충족한다.
     */
    readonly fullLabel: string;
}

/**
 * `fullLabel` 안에서 `visible` 토큰의 앞뒤를 갈라낸다.
 *
 * 조합이 규칙적이지 않아 문자열 연결로는 못 만든다 — `미국` + `뉴스`는
 * `미국 뉴스`지만 실제 `fullLabel`은 `미국 시장 뉴스`이고, 상위 허브는
 * 토큰이 뒤가 아니라 **앞**에 붙는다(`뉴스 전체`). 그래서 만들지 않고 **자른다.**
 * 자르는 방식이면 `assetClassNav`가 라벨을 바꿔도 여기가 따라온다.
 *
 * 토큰이 없으면(있어선 안 되지만) 전체를 그대로 보여준다 — 라벨을 잃는 것보다
 * 군더더기가 낫다.
 */
export function splitFooterLabel(
    fullLabel: string,
    visible: string
): FooterLabelParts {
    const at = fullLabel.indexOf(visible);
    if (at < 0) {
        return { srPrefix: '', visible: fullLabel, srSuffix: '' };
    }
    return {
        srPrefix: fullLabel.slice(0, at),
        visible,
        srSuffix: fullLabel.slice(at + visible.length),
    };
}

interface FooterColumn {
    readonly id: string;
    readonly label: string;
    readonly links: readonly FooterLink[];
}

/**
 * 지역에 속하지 않는 상위 허브(현재 `/news`)를 자기 버티컬 열의 **첫 항목**으로
 * 넣는다. 평탄 목록이던 시절에는 `NAV_OVERVIEW_LINKS`로 앞에 몰아 붙였는데,
 * 열로 나뉜 지금은 그 링크가 어느 열에 속하는지가 정해져 있다. 판정은 계속
 * `assetClassNav`의 `hasRegionForRoot`가 소유한다 — 같은 식을 여기 또 적으면
 * 그 모듈이 생긴 사고(두 표면이 각자 판정하다 한쪽만 갱신됨)와 같은 모양이 된다.
 */
function columnOf(vertical: NavVertical): FooterColumn {
    const overview: readonly FooterLink[] = hasRegionForRoot(vertical)
        ? []
        : [
              {
                  href: vertical.rootHref,
                  fullLabel: `${vertical.label} 전체`,
                  ...splitFooterLabel(`${vertical.label} 전체`, '전체'),
              },
          ];
    return {
        id: vertical.id,
        label: vertical.label,
        links: [
            ...overview,
            ...vertical.regions.map(region => ({
                href: region.href,
                fullLabel: region.fullLabel,
                ...splitFooterLabel(region.fullLabel, region.label),
            })),
        ],
    };
}

const NAV_COLUMNS: readonly FooterColumn[] = NAV_VERTICALS.map(columnOf);

/**
 * 목적지가 사이트 정보인 마지막 열. 버티컬에서 파생되지 않으므로 직접 적되,
 * **껍데기는 버티컬 열과 공유한다**(`FooterNavColumn`). 제목 클래스·`<ul>`·
 * `aria-labelledby` 배선을 여기 또 적으면 두 곳 중 한 곳만 바뀐다 — 이 PR이
 * `DESIGN.md`에 넣은 체크리스트 3번이 금지하는 바로 그 형태다.
 */
const INFO_COLUMN: FooterColumn = {
    id: 'info',
    label: '서비스',
    links: [
        {
            href: PRIVACY_PATH,
            fullLabel: PRIVACY_TITLE,
            srPrefix: '',
            visible: PRIVACY_TITLE,
            srSuffix: '',
        },
        {
            href: TERMS_PATH,
            fullLabel: TERMS_TITLE,
            srPrefix: '',
            visible: TERMS_TITLE,
            srSuffix: '',
        },
    ],
};

const LINK_CLASSES =
    'rounded text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 열 제목은 `<h2>`가 아니라 `<p>` + `aria-labelledby`다.
 *
 * 헤딩으로 쓰면 전 페이지 문서 개요에 h2가 다섯 개씩 추가된다 — 푸터는 모든
 * 라우트에 렌더되므로 종목 페이지의 실제 h2들과 같은 층에 사이트맵 제목이
 * 섞인다. 목록에 이름을 붙이는 것만으로 스크린리더의 그룹 인지에는 충분하고,
 * 문서 개요는 건드리지 않는다.
 */
interface FooterNavColumnProps {
    readonly column: FooterColumn;
    /** 링크가 아닌 항목(현재는 문의하기 다이얼로그 트리거)을 목록 끝에 붙인다. */
    readonly children?: ReactNode;
}

function FooterNavColumn({ column, children }: FooterNavColumnProps) {
    const headingId = `footer-nav-${column.id}`;
    return (
        <div>
            <p
                id={headingId}
                className="text-sm font-semibold text-secondary-200"
            >
                {column.label}
            </p>
            <ul aria-labelledby={headingId} className="mt-3 space-y-2">
                {column.links.map(link => (
                    <li key={link.href}>
                        <Link
                            href={link.href}
                            aria-label={link.fullLabel}
                            // 전역 푸터 — 모든 페이지에서 렌더된다. prefetch는 진입
                            // 페이지마다 다른 `_rsc` 해시를 만들어 캐시를 파편화시킨다
                            // (docs/architecture/CDN_CACHING.md §1).
                            prefetch={false}
                            className={LINK_CLASSES}
                        >
                            {link.srPrefix && (
                                <span className="sr-only">{link.srPrefix}</span>
                            )}
                            {link.visible}
                            {link.srSuffix && (
                                <span className="sr-only">{link.srSuffix}</span>
                            )}
                        </Link>
                    </li>
                ))}
                {children}
            </ul>
        </div>
    );
}

export function Footer() {
    return (
        <footer className="border-t border-secondary-700">
            <div className="page-container py-10">
                <nav
                    aria-label="사이트 정보"
                    className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
                >
                    {NAV_COLUMNS.map(column => (
                        <FooterNavColumn key={column.id} column={column} />
                    ))}
                    <FooterNavColumn column={INFO_COLUMN}>
                        <li>
                            <ContactDialog
                                triggerLabel="문의하기"
                                triggerClassName={LINK_CLASSES}
                            />
                        </li>
                    </FooterNavColumn>
                </nav>

                <div className="mt-10 flex flex-col gap-3 border-t border-secondary-700 pt-6">
                    <p
                        role="note"
                        aria-label="투자 면책 고지"
                        className="text-xs leading-relaxed text-secondary-400 sm:text-sm"
                    >
                        {INVESTMENT_DISCLAIMER}
                    </p>
                    {/* `whitespace-nowrap`: 320px에서 `© 2026` / `Siglens` 두 줄로
                        쪼개지던 회귀가 있었다(2026-08-25 사용자 제보). 당시 원인은
                        옆에 있던 `flex-wrap` nav가 폭을 뺏은 것이었고 지금은 이
                        문단이 자기 행을 독점하지만, 좁은 화면에서 저작권 한 줄이
                        쪼개질 이유는 여전히 없다. */}
                    <p className="text-sm whitespace-nowrap text-secondary-400">
                        © <CurrentYear /> Siglens
                    </p>
                </div>
            </div>
        </footer>
    );
}
