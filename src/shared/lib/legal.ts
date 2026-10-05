import { SITE_NAME, SITE_URL, type SeoTranslator } from '@/shared/lib/seo';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';

/**
 * 투자 고지 문구는 `shared.lib.legal.investmentDisclaimer` 키다.
 *
 * 예전에는 여기 한국어 상수라 푸터·공유 페이지·약관·개인정보처리방침 **네 곳
 * 전부**가 로케일과 무관하게 한국어 고지를 렌더했다. 이 모듈은 요청 스코프가
 * 없으므로 문구를 들 수 없다.
 */
export const INVESTMENT_DISCLAIMER_KEY = 'investmentDisclaimer';

export const PRIVACY_PATH = '/privacy';
export const TERMS_PATH = '/terms';
export const ABOUT_PATH = '/about';
export const METHODOLOGY_PATH = '/methodology';

/**
 * 운영 주체 — `/about` 본문·`Person` JSON-LD·홈 `Organization.founder`가 공유하는
 * 단일 소스. 2026-09-11 사용자 결정: 실명·이메일·GitHub 전부 공개(YMYL 재평가에서
 * "운영 주체 불명 + AI 생성 대량"이 가장 불리한 프로필이라, 이걸 지우는 게 목적).
 * 이름은 로케일과 무관하게 한글 표기 하나만 쓴다 — 로마자 표기를 지어내지 않는다.
 */
export const SITE_OPERATOR = {
    name: 'y0ngha',
    email: 'dev.y0ngha@gmail.com',
    githubUrl: 'https://github.com/y0ngha',
    // 운영자 개인 블로그 — 실명 운영 주체의 외부 프로필로 `sameAs`에 싣는다.
    velogUrl: 'https://velog.io/@y0ngha',
} as const;

/**
 * 홈 `Organization.founder`와 `/about` `Person`이 공유하는 `sameAs`.
 * 두 노드는 `@id`가 같아 크롤러가 하나의 개체로 합치므로, 배열이 갈리면
 * 같은 사람이 서로 다른 프로필 목록을 주장하게 된다 — 한 상수로 묶는다.
 */
export const OPERATOR_SAME_AS: readonly string[] = [
    SITE_OPERATOR.githubUrl,
    SITE_OPERATOR.velogUrl,
];

/**
 * `/about` 본문 마지막 갱신일 — 본문(`messages/*.json`의 `views.about`)을 고치면
 * 함께 올린다. 화면 하단 "마지막 업데이트"와 `AboutPage.dateModified`가 읽는다.
 */
export const ABOUT_UPDATED_AT = new Date('2026-10-04T00:00:00+09:00');

/**
 * `/methodology` 본문 마지막 갱신일 — 본문(`messages/*.json`의 `views.methodology`)이나
 * 변경 이력(`views/methodology/lib/methodologyChangelog.ts`)을 고치면 함께 올린다.
 * 화면 하단 "마지막 업데이트", JSON-LD `WebPage.dateModified`, 정적 sitemap `lastmod`가
 * 이 값 하나를 읽는다 — 배포 시각을 쓰면 본문을 안 고친 배포까지 "갱신됨"으로 나간다.
 */
export const METHODOLOGY_UPDATED_AT = new Date('2026-10-05T00:00:00+09:00');

/**
 * `/about`의 `Person` 노드와 홈 `Organization.founder`가 공유하는 `@id`.
 * 두 페이지가 각자 `${SITE_URL}${ABOUT_PATH}#person`을 조립하면 오타 하나로
 * 크롤러가 두 노드를 다른 개체로 읽는다 — 상수 하나로 묶는다.
 */
export const OPERATOR_PERSON_JSON_LD_ID = `${SITE_URL}${ABOUT_PATH}#person`;

/**
 * title/description은 `shared.seo` 카탈로그에서 온다 — `terms`/`privacy` 페이지의
 * `generateMetadata`, JSON-LD, `LegalPageShell` h1이 전부 이 값을 공유하므로
 * 한 곳만 바꾸면 셋이 동시에 갱신된다(옛 모듈 상수와 동일한 단일 소스 원칙,
 * 로케일 인자만 늘었다). `intro`/약관 본문(`terms.body`, DB 마크다운)은 법률
 * 검토가 필요한 별도 콘텐츠라 이 함수들의 범위가 아니다.
 */
export function privacyTitle(t: SeoTranslator): string {
    return t('privacy.title');
}
export function privacyFullTitle(t: SeoTranslator): string {
    return `${privacyTitle(t)} | ${SITE_NAME}`;
}
export function privacyDescription(t: SeoTranslator): string {
    return t('privacy.description');
}

export function termsTitle(t: SeoTranslator): string {
    return t('terms.title');
}
export function termsFullTitle(t: SeoTranslator): string {
    return `${termsTitle(t)} | ${SITE_NAME}`;
}
export function termsDescription(t: SeoTranslator): string {
    return t('terms.description');
}

/**
 * 본문 제목·브레드크럼·푸터 링크 라벨(`Siglens 소개`). 한글 표기(`SITE_NAME_KO`)를
 * 일부러 넣지 않았다 — 한글 브랜드는 메타 제목·설명·히어로 윗줄에서 한 번 소개하면
 * 충분하고, 전 페이지 푸터 링크 라벨까지 길어지는 건 과하다(2026-10-04 사용자 결정:
 * 과하지 않게 넣는다).
 */
export function aboutTitle(t: SeoTranslator): string {
    return t('about.title');
}
/**
 * `<title>`·OG 제목. 다른 법무 페이지처럼 `${title} | Siglens`가 아니다 — 소개
 * 페이지는 브랜드 검색과 "AI 주식 분석" 류 검색을 함께 받으므로 무엇을 하는
 * 서비스인지가 제목에 들어가고, 그 문구가 이미 브랜드(ko는 `시그렌즈(Siglens)`)로
 * 시작한다.
 */
export function aboutFullTitle(t: SeoTranslator): string {
    return t('about.metaTitle');
}
export function aboutDescription(t: SeoTranslator): string {
    return t('about.description');
}

export function methodologyTitle(t: SeoTranslator): string {
    return t('methodology.title');
}
/**
 * `<title>`·OG 제목. `/about`과 같은 이유로 `| Siglens` 접미사를 붙이지 않는다 —
 * 카탈로그 문구가 이미 `Siglens`로 시작한다.
 */
export function methodologyFullTitle(t: SeoTranslator): string {
    return t('methodology.metaTitle');
}
export function methodologyDescription(t: SeoTranslator): string {
    return t('methodology.description');
}

/**
 * 약관 발효일 표기 — 로케일을 따른다.
 *
 * 예전에는 `'ko-KR'` 고정 상수 하나였다 — 그래서 `/en/terms`·`/en/privacy`의
 * `Effective Date`가 `2026년 4월 30일`을 찍었다. 타임존은 KST로 고정한다
 * (약관 발효일은 한국 법인 기준 날짜라 로케일과 무관).
 */
export function formatKoreanDate(date: Date, locale: Locale): string {
    return cachedDateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
}
