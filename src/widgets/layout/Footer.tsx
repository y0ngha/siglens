import { useTranslations } from 'next-intl';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { NAV_VERTICALS } from '@/shared/config/assetClassNav';
import { BENCHMARK_PATH, BENCHMARK_PUBLISHED } from '@/shared/config/benchmark';
import { DEVELOPERS_PATH } from '@/shared/config/publicApi';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { localePath } from '@/shared/i18n/locales';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { brandName } from '@/shared/lib/brandName';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
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
import { GITHUB_URL, SYMBOLS_PATH, VELOG_URL, X_URL } from '@/shared/lib/seo';
import { GithubIcon } from '@/shared/ui/GithubIcon';
import { VelogIcon } from '@/shared/ui/VelogIcon';
import { XIcon } from '@/shared/ui/XIcon';
import { AiNavLink } from './AiNavLink';
import { ContactDialog } from './ContactDialog';
import { CurrentYear } from './CurrentYear';
import { FooterDisclaimer } from './ui/footer/FooterDisclaimer';
import { FOOTER_LINK_CLASSES } from './ui/footer/footerLinkStyles';
import { FooterNavColumn } from './ui/footer/FooterNavColumn';
import { FooterSocialLink } from './ui/footer/FooterSocialLink';
import { FooterTextLink } from './ui/footer/FooterTextLink';
import { columnOf } from './utils/footerColumns';

/**
 * 전폭 푸터. 헤더와 같은 폭 규약(전폭 `px-4`)을 쓴다.
 *
 * 크롬이 뷰포트에 맞으면 링크를 가운데 1200px 안에 모아둘 이유가 없어지는데, 그렇다고 사이트맵만
 * 왼쪽에 붙이면 넓은 화면에서 오른쪽 절반이 통째로 빈다. 그래서 **한 가로 행의 양 끝**에 붙인다 —
 * 왼쪽은 "누가 만들었고 어떤 약속을 하는가"(저작권·저장소·약관·문의), 오른쪽은 "어디로 갈 수
 * 있는가"(사이트맵). 면책 고지는 둘 중 어느 쪽 축도 아니라 구분선 아래 자기 줄을 갖는다.
 *
 * `lg` 미만에서는 세로로 쌓이고, 그때는 사이트맵이 먼저 온다 — 좁은 화면에서 푸터에 도달한 사람이
 * 찾는 것은 대개 목적지이지 저작권 표기가 아니다.
 *
 * 번역은 이 컴포넌트가 모아서 문자열로 내려보낸다(서버 컴포넌트 — 하위 ui는 번역 훅을 쓰지 않는다).
 */
export function Footer() {
    const t = useTranslations('widgets.layout');
    // 내비 라벨 키는 네임스페이스까지 포함된 완전 수식 키라 루트로 푼다.
    const tNav = useTranslations();
    const tSeo = useTranslations('shared.seo');
    const tLegal = useTranslations('shared.lib.legal');
    const locale = useResolvedLocale();
    const brand = brandName(locale);
    // 라벨이 카탈로그에서 오므로 모듈 상수로 만들 수 없다 — 렌더에서 계산한다.
    const navColumns = NAV_VERTICALS.map(vertical => columnOf(vertical, tNav));
    return (
        <footer
            // `viewportFit: 'cover'`라 문서가 화면 **끝까지** 그려진다. iOS 26 사파리는 주소창이
            // 하단에 있어 그 띠가 마지막 콘텐츠를 덮는다 — 푸터가 문서의 마지막 블록이므로 여기
            // 한 곳에서 인셋을 비우면 일반 스크롤 페이지 전체가 덮인다.
            className="border-t border-secondary-700 pb-[env(safe-area-inset-bottom)]"
        >
            <div className="w-full px-4 py-10">
                <div className="flex flex-col-reverse gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
                    {/* 왼쪽 — 저작권·저장소·약관·문의. 한 줄로 흐르되 좁아지면 감싼다.
                        `gap-x-6`은 소셜 링크 터치 상자가 서로 겹치지 않는 최소 간격이다. */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        {/* `whitespace-nowrap`: 320px에서 `© 2026` / 브랜드가 두 줄로 쪼개지지 않게 한다. */}
                        <p className="text-sm whitespace-nowrap text-secondary-400">
                            © <CurrentYear /> {brand}
                        </p>
                        <FooterSocialLink
                            href={GITHUB_URL}
                            label={t('githubRepoAria', { v0: brand })}
                        >
                            <GithubIcon className="h-5 w-5" />
                        </FooterSocialLink>
                        <FooterSocialLink
                            href={X_URL}
                            label={t('xAccountAria', { v0: brand })}
                        >
                            <XIcon className="h-5 w-5" />
                        </FooterSocialLink>
                        <FooterSocialLink
                            href={VELOG_URL}
                            label={t('velogBlogAria', { v0: brand })}
                        >
                            <VelogIcon className="h-5 w-5" />
                        </FooterSocialLink>
                        <nav
                            aria-label={t('Footer.5f5d12')}
                            className="flex flex-wrap items-center gap-x-4 gap-y-2"
                        >
                            {/* 소개가 약관보다 앞 — 크롤러·독자 모두 "누가 만들었나"를 먼저 본다.
                                전 페이지에서 크롤 가능한 유일한 `/about` 링크다. */}
                            <FooterTextLink href={ABOUT_PATH}>
                                {aboutTitle(tSeo)}
                            </FooterTextLink>
                            {/* 분석 방법은 소개 바로 뒤 — 산문 하단의 출처 고지와 `/about`이 모두
                                이 페이지로 건다. */}
                            <FooterTextLink href={METHODOLOGY_PATH}>
                                {methodologyTitle(tSeo)}
                            </FooterTextLink>
                            {/* 벤치마크 결과 — 공개 전(`BENCHMARK_PUBLISHED` 꺼짐)에는 페이지가 404라
                                링크도 내지 않는다. 정본이 ai 호스트에 있어 절대 URL의 일반 앵커다. */}
                            {BENCHMARK_PUBLISHED && (
                                <a
                                    href={`${AI_SITE_URL}${localePath(locale, BENCHMARK_PATH)}`}
                                    className={FOOTER_LINK_CLASSES}
                                >
                                    {t('Footer.benchmarkLink')}
                                </a>
                            )}
                            {/* 차트 가이드 — 방법론 바로 뒤. 용어 설명 90개 항목의 전역 진입 앵커. */}
                            <FooterTextLink href={GUIDE_PATH}>
                                {t('Footer.guideLink')}
                            </FooterTextLink>
                            {/* 개발자 API — 공개 API 출시 전(`isPublicApiEnabled` 꺼짐)에는 페이지가
                                404라 링크도 내지 않는다. */}
                            {isPublicApiEnabled() && (
                                <FooterTextLink href={DEVELOPERS_PATH}>
                                    {t('Footer.developersLink')}
                                </FooterTextLink>
                            )}
                            {/* 종목 디렉터리 — 크롤 구조를 위한 링크다. 푸터는 전 라우트에 렌더되므로
                                디렉터리가 1클릭, 목록의 모든 종목이 2클릭이 된다. */}
                            <FooterTextLink href={SYMBOLS_PATH}>
                                {t('Footer.symbolsLink')}
                            </FooterTextLink>
                            <AiNavLink
                                variant="text"
                                className={FOOTER_LINK_CLASSES}
                            />
                            <FooterTextLink href={PRIVACY_PATH}>
                                {privacyTitle(tSeo)}
                            </FooterTextLink>
                            <FooterTextLink href={TERMS_PATH}>
                                {termsTitle(tSeo)}
                            </FooterTextLink>
                            <ContactDialog
                                triggerLabel={t('Footer.531f6a')}
                                triggerClassName={FOOTER_LINK_CLASSES}
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

                <FooterDisclaimer label={t('Footer.693b62')}>
                    {tLegal(INVESTMENT_DISCLAIMER_KEY)}
                </FooterDisclaimer>
            </div>
        </footer>
    );
}
