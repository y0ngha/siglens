import { ContactDialog } from './ContactDialog';
import { CurrentYear } from './CurrentYear';
import {
    hasRegionForRoot,
    NAV_VERTICALS,
    type NavVertical,
} from '@/shared/config/assetClassNav';
import { GithubIcon } from '@/shared/ui/GithubIcon';
import {
    INVESTMENT_DISCLAIMER,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/shared/lib/legal';
import { GITHUB_URL, SITE_NAME } from '@/shared/lib/seo';
import { LABEL_GROUP } from '@/shared/lib/typographyStyles';
import Link from 'next/link';

/**
 * 푸터 링크 하나. `visible`만 눈에 보이고 `srPrefix`/`srSuffix`는 화면에서 숨는다.
 *
 * **왜 쪼개는가**: 카테고리 열로 묶으면 `시장 분석` 아래에 `미국 시장 분석`을
 * 다시 적는 게 시각적으로 군더더기다 — 헤더 드롭다운도 이 자리에서 `미국`만
 * 쓴다. 그런데 보이는 글자를 그냥 짧게 줄이면 **앵커 텍스트가 9개 바뀐다.**
 * 푸터는 전 페이지에 렌더되는 전역 링크 집합이라 그 변경의 사정거리가 사이트
 * 전체다. 그래서 눈에는 짧은 라벨만 보이되 크롤러가 읽는 텍스트는 `fullLabel`
 * 그대로 남긴다.
 */
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
 * 넣는다. 판정은 계속 `assetClassNav`의 `hasRegionForRoot`가 소유한다 — 같은 식을
 * 여기 또 적으면 그 모듈이 생긴 사고(두 표면이 각자 판정하다 한쪽만 갱신됨)와
 * 같은 모양이 된다.
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

const LINK_CLASSES =
    'rounded text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface FooterNavColumnProps {
    readonly column: FooterColumn;
}

/**
 * 열 제목은 `<h2>`가 아니라 `<p>` + `aria-labelledby`다.
 *
 * 헤딩으로 쓰면 전 페이지 문서 개요에 h2가 네 개씩 추가된다 — 푸터는 모든
 * 라우트에 렌더되므로 종목 페이지의 실제 h2들과 같은 층에 사이트맵 제목이
 * 섞인다. 목록에 이름을 붙이는 것만으로 스크린리더의 그룹 인지에는 충분하고,
 * 문서 개요는 건드리지 않는다.
 */
function FooterNavColumn({ column }: FooterNavColumnProps) {
    const headingId = `footer-nav-${column.id}`;
    return (
        <div>
            <p id={headingId} className={LABEL_GROUP}>
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
            </ul>
        </div>
    );
}

/**
 * 전폭 푸터. 헤더와 같은 폭 규약(전폭 `px-4`)을 쓴다.
 *
 * 크롬이 뷰포트에 맞으면 링크를 가운데 1200px 안에 모아둘 이유가 없어지는데,
 * 그렇다고 사이트맵만 왼쪽에 붙이면 넓은 화면에서 오른쪽 절반이 통째로 빈다.
 * 그래서 **한 가로 행의 양 끝**에 붙인다 — 왼쪽은 "누가 만들었고 어떤 약속을
 * 하는가"(저작권·저장소·약관·문의), 오른쪽은 "어디로 갈 수 있는가"(사이트맵).
 * 면책 고지는 둘 중 어느 쪽 축도 아니라 구분선 아래 자기 줄을 갖는다.
 *
 * `lg` 미만에서는 세로로 쌓이고, 그때는 사이트맵이 먼저 온다 — 좁은 화면에서
 * 푸터에 도달한 사람이 찾는 것은 대개 목적지이지 저작권 표기가 아니다.
 */
export function Footer() {
    return (
        <footer className="border-t border-secondary-700">
            <div className="w-full px-4 py-10">
                <div className="flex flex-col-reverse gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
                    {/* 왼쪽 — 저작권·저장소·약관·문의. 한 줄로 흐르되 좁아지면 감싼다. */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        {/* `whitespace-nowrap`: 320px에서 `© 2026` / `Siglens`
                            두 줄로 쪼개지던 회귀가 있었다(2026-08-25 사용자 제보). */}
                        <p className="text-sm whitespace-nowrap text-secondary-400">
                            © <CurrentYear /> {SITE_NAME}
                        </p>
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            // 외부 탭으로 여는 링크는 opener를 끊는다. `noreferrer`는
                            // `noopener`를 포함하지만 둘 다 적어 의도를 남긴다.
                            rel="noopener noreferrer"
                            aria-label={`${SITE_NAME} GitHub 저장소 (새 탭에서 열림)`}
                            className="rounded text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            <GithubIcon className="h-5 w-5" />
                        </a>
                        <nav
                            aria-label="사이트 정보"
                            className="flex flex-wrap items-center gap-x-4 gap-y-2"
                        >
                            <Link
                                href={PRIVACY_PATH}
                                // 위 사이트맵 링크와 동일 — 전역 푸터의 `_rsc` 파편화
                                // (docs/architecture/CDN_CACHING.md §1).
                                prefetch={false}
                                className={LINK_CLASSES}
                            >
                                {PRIVACY_TITLE}
                            </Link>
                            <Link
                                href={TERMS_PATH}
                                prefetch={false}
                                className={LINK_CLASSES}
                            >
                                {TERMS_TITLE}
                            </Link>
                            <ContactDialog
                                triggerLabel="문의하기"
                                triggerClassName={LINK_CLASSES}
                            />
                        </nav>
                    </div>

                    {/* 오른쪽 — 사이트맵. 좁은 화면에서는 2열, 넓어지면 버티컬 수만큼 편다. */}
                    <nav
                        aria-label="사이트맵"
                        className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 lg:gap-x-14"
                    >
                        {NAV_COLUMNS.map(column => (
                            <FooterNavColumn key={column.id} column={column} />
                        ))}
                    </nav>
                </div>

                <p
                    role="note"
                    aria-label="투자 면책 고지"
                    className="mt-10 border-t border-secondary-700 pt-6 text-xs leading-relaxed text-secondary-400"
                >
                    {INVESTMENT_DISCLAIMER}
                </p>
            </div>
        </footer>
    );
}
