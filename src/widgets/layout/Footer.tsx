import { useTranslations } from 'next-intl';
import { AiNavLink } from './AiNavLink';
import { ContactDialog } from './ContactDialog';
import { CurrentYear } from './CurrentYear';
import {
    hasRegionForRoot,
    NAV_VERTICALS,
    type NavVertical,
} from '@/shared/config/assetClassNav';
import { GithubIcon } from '@/shared/ui/GithubIcon';
import { XIcon } from '@/shared/ui/XIcon';
import {
    ABOUT_PATH,
    aboutTitle,
    INVESTMENT_DISCLAIMER_KEY,
    METHODOLOGY_PATH,
    methodologyTitle,
    PRIVACY_PATH,
    privacyTitle,
    TERMS_PATH,
    termsTitle,
} from '@/shared/lib/legal';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import {
    GITHUB_URL,
    SITE_NAME,
    SITE_NAME_KO,
    SYMBOLS_PATH,
    X_URL,
} from '@/shared/lib/seo';
import { LABEL_GROUP } from '@/shared/lib/typographyStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

/**
 * 푸터 링크 하나. 화면에 보이는 텍스트가 곧 **전체 이름**이다(`미국 시장 분석`).
 *
 * **왜 풀 라벨을 보이게 하는가 (2026-10-05 크롤 감사)**: 예전에는 열 제목 아래에서 `미국`·`한국`
 * 같은 짧은 라벨만 보이고 전체 이름은 `aria-label`이 졌다. 그런데 앵커 텍스트로 쓰이는 건
 * 보이는 글자라, 전 페이지 푸터의 `/market`·`/market/kr`·`/news/us` … 링크가 전부 "미국"/"한국"만
 * 말해 목적지 주제를 알려 주지 못했다. 열 제목과 시각적으로 겹치는 비용(`시장 분석` 아래
 * `미국 시장 분석`)을 내고 앵커가 주제를 말하게 한다.
 *
 * **숨김 텍스트는 두지 않는다.** 보이는 글자가 곧 이름이라 `aria-label`도 `sr-only` 조각도
 * 필요 없다(전 페이지 전역 링크의 숨김 텍스트는 구글 정책에 걸린다 — 2026-09-17 감사가
 * 걷어낸 결정이 유효하다). 헤더 드롭다운은 같은 이유로 짧은 라벨(`미국`) 그대로 두고
 * 숨김 조각을 붙이지 않는다.
 */
interface FooterLink {
    readonly href: string;
    /** 화면에 보이는 전체 이름. */
    readonly label: string;
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
function columnOf(
    vertical: NavVertical,
    tNav: (key: string, values?: Record<string, string>) => string
): FooterColumn {
    const label = tNav(vertical.labelKey);
    const allLabel = tNav('shared.config.nav.overviewAll', { v0: label });
    const overview: readonly FooterLink[] = hasRegionForRoot(vertical)
        ? []
        : [{ href: vertical.rootHref, label: allLabel }];
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

const LINK_CLASSES =
    'tap-target rounded text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

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
                            // 전역 푸터 — 모든 페이지에서 렌더된다. prefetch는 진입
                            // 페이지마다 다른 `_rsc` 해시를 만들어 캐시를 파편화시킨다
                            // (docs/architecture/CDN_CACHING.md §1).
                            prefetch={false}
                            className={LINK_CLASSES}
                        >
                            {link.label}
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
    const t = useTranslations('widgets.layout');
    // 내비 라벨 키는 네임스페이스까지 포함된 완전 수식 키라 루트로 푼다.
    const tNav = useTranslations();
    const tSeo = useTranslations('shared.seo');
    const tLegal = useTranslations('shared.lib.legal');
    const locale = useResolvedLocale();
    // 라벨이 카탈로그에서 오므로 모듈 상수로 만들 수 없다 — 렌더에서 계산한다.
    const navColumns = NAV_VERTICALS.map(v => columnOf(v, tNav));
    return (
        <footer
            /*
             * `viewportFit: 'cover'`라 문서가 화면 **끝까지** 그려진다. iOS 26
             * 사파리는 주소창이 하단에 있어 그 띠가 마지막 콘텐츠를 덮는다 —
             * 푸터가 문서의 마지막 블록이므로 여기 한 곳에서 인셋을 비우면
             * 일반 스크롤 페이지 전체가 덮인다. 고정 요소(플로팅 챗·시트)는
             * 문서 흐름 밖이라 각자 따로 처리한다.
             */
            className="border-t border-secondary-700 pb-[env(safe-area-inset-bottom)]"
        >
            <div className="w-full px-4 py-10">
                <div className="flex flex-col-reverse gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
                    {/* 왼쪽 — 저작권·저장소·약관·문의. 한 줄로 흐르되 좁아지면 감싼다. */}
                    {/* `gap-x-6`: GitHub·X 아이콘의 터치 상자(44px)는 음수 마진(`-m-3`)으로 레이아웃에서
                        12px씩 바깥으로 나와 있다. 이웃 상자끼리 겹치지 않으려면 두 상자의
                        바깥 여백 합(12 + 12)만큼은 간격이 있어야 하므로 24px이다. */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        {/* `whitespace-nowrap`: 320px에서 `© 2026` / `SIGLENS`
                            두 줄로 쪼개지던 회귀가 있었다(2026-08-25 사용자 제보). */}
                        <p className="text-sm whitespace-nowrap text-secondary-400">
                            © <CurrentYear /> {SITE_NAME.toUpperCase()}
                            {/* 워드마크 옆 한글 표기 — 전 페이지에서 "시그렌즈"가
                                보이는 유일한 자리다(`SITE_NAME_KO` 주석). 한글 독음이라
                                ko에서만 낸다. */}
                            {locale === DEFAULT_LOCALE && (
                                <> · {SITE_NAME_KO}</>
                            )}
                        </p>
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            // 외부 탭으로 여는 링크는 opener를 끊는다. `noreferrer`는
                            // `noopener`를 포함하지만 둘 다 적어 의도를 남긴다.
                            rel="noopener noreferrer"
                            aria-label={t('githubRepoAria', { v0: SITE_NAME })}
                            // 아이콘은 20px이지만 터치 영역은 44px(`size-11`)이다 —
                            // 아래 X 링크와 같은 처리(음수 마진 근거는 그쪽 주석).
                            className="-m-3 inline-flex size-11 items-center justify-center rounded text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            <GithubIcon className="h-5 w-5" />
                        </a>
                        <a
                            href={X_URL}
                            target="_blank"
                            // GitHub 링크와 같다 — 외부 탭은 opener를 끊는다.
                            rel="noopener noreferrer"
                            aria-label={t('xAccountAria', { v0: SITE_NAME })}
                            // 아이콘은 20px이지만 터치 영역은 44px(`size-11`)이어야 한다.
                            // 음수 마진(`-m-3`)이 늘어난 12px씩을 되돌려 레이아웃 몫은 20px
                            // 그대로다. 행 간격(`gap-x-6` = 24px)이 이웃 상자와의 바깥 여백
                            // 합(12 + 12)과 같아 GitHub 상자와 X 상자가 겹치지 않는다.
                            className="-m-3 inline-flex size-11 items-center justify-center rounded text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            <XIcon className="h-5 w-5" />
                        </a>
                        <nav
                            aria-label={t('Footer.5f5d12')}
                            className="flex flex-wrap items-center gap-x-4 gap-y-2"
                        >
                            {/* 소개가 약관보다 앞 — 크롤러·독자 모두 "누가 만들었나"를
                                먼저 본다(SEO_RECOVERY_2026_09 §5-B1). 전 페이지에서
                                크롤 가능한 유일한 `/about` 링크다. */}
                            <Link
                                href={ABOUT_PATH}
                                prefetch={false}
                                className={LINK_CLASSES}
                            >
                                {aboutTitle(tSeo)}
                            </Link>
                            {/* 분석 방법은 소개 바로 뒤 — 산문 하단의 출처 고지와 `/about`이
                                모두 이 페이지로 건다. 전 페이지에서 크롤 가능한 링크다. */}
                            <Link
                                href={METHODOLOGY_PATH}
                                prefetch={false}
                                className={LINK_CLASSES}
                            >
                                {methodologyTitle(tSeo)}
                            </Link>
                            {/*
                             * 종목 디렉터리 — 이 링크가 있는 이유는 크롤 구조다.
                             * 2026-09-18 실측에서 sitemap 심볼 416개 중 147개가
                             * 홈에서 3클릭 안에 닿지 않았다. 푸터는 전 라우트에
                             * 렌더되므로 이 한 줄로 디렉터리가 1클릭, 목록의 모든
                             * 종목이 2클릭이 된다.
                             */}
                            <Link
                                href={SYMBOLS_PATH}
                                prefetch={false}
                                className={LINK_CLASSES}
                            >
                                {t('Footer.symbolsLink')}
                            </Link>
                            <AiNavLink
                                variant="text"
                                className={LINK_CLASSES}
                            />
                            <Link
                                href={PRIVACY_PATH}
                                // 위 사이트맵 링크와 동일 — 전역 푸터의 `_rsc` 파편화
                                // (docs/architecture/CDN_CACHING.md §1).
                                prefetch={false}
                                className={LINK_CLASSES}
                            >
                                {privacyTitle(tSeo)}
                            </Link>
                            <Link
                                href={TERMS_PATH}
                                prefetch={false}
                                className={LINK_CLASSES}
                            >
                                {termsTitle(tSeo)}
                            </Link>
                            <ContactDialog
                                triggerLabel={t('Footer.531f6a')}
                                triggerClassName={LINK_CLASSES}
                            />
                        </nav>
                    </div>

                    {/* 오른쪽 — 사이트맵. 좁은 화면에서는 2열, 넓어지면 버티컬 수만큼 편다. */}
                    <nav
                        aria-label={t('Footer.40df0a')}
                        className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 lg:gap-x-14"
                    >
                        {navColumns.map(column => (
                            <FooterNavColumn key={column.id} column={column} />
                        ))}
                    </nav>
                </div>

                <p
                    role="note"
                    aria-label={t('Footer.693b62')}
                    className="mt-10 border-t border-secondary-700 pt-6 text-xs leading-relaxed text-secondary-400"
                >
                    {tLegal(INVESTMENT_DISCLAIMER_KEY)}
                </p>
            </div>
        </footer>
    );
}
