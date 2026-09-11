import { SITE_NAME, type SeoTranslator } from '@/shared/lib/seo';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';

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

/**
 * 운영 주체 — `/about` 본문·`Person` JSON-LD·홈 `Organization.founder`가 공유하는
 * 단일 소스. 2026-09-11 사용자 결정: 실명·이메일·GitHub 전부 공개(YMYL 재평가에서
 * "운영 주체 불명 + AI 생성 대량"이 가장 불리한 프로필이라, 이걸 지우는 게 목적).
 * 이름은 로케일과 무관하게 한글 표기 하나만 쓴다 — 로마자 표기를 지어내지 않는다.
 */
export const SITE_OPERATOR = {
    name: '신용하',
    email: 'dev.y0ngha@gmail.com',
    githubUrl: 'https://github.com/y0ngha',
} as const;

/** `/about` 본문 마지막 갱신일 — 본문(`about/content.ts`)을 고치면 함께 올린다. */
export const ABOUT_UPDATED_AT = new Date('2026-09-11T00:00:00+09:00');

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

export function aboutTitle(t: SeoTranslator): string {
    return t('about.title');
}
export function aboutFullTitle(t: SeoTranslator): string {
    return `${aboutTitle(t)} | ${SITE_NAME}`;
}
export function aboutDescription(t: SeoTranslator): string {
    return t('about.description');
}

/**
 * 로케일별 포맷터 캐시.
 *
 * 예전에는 `'ko-KR'` 고정 상수 하나였다 — 그래서 `/en/terms`·`/en/privacy`의
 * `Effective Date`가 `2026년 4월 30일`을 찍었다. 타임존은 KST로 고정한다
 * (약관 발효일은 한국 법인 기준 날짜라 로케일과 무관).
 */
const FORMATTER_CACHE = new Map<Locale, Intl.DateTimeFormat>();

function formatterFor(locale: Locale): Intl.DateTimeFormat {
    const cached = FORMATTER_CACHE.get(locale);
    if (cached) return cached;
    const formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    FORMATTER_CACHE.set(locale, formatter);
    return formatter;
}

export function formatKoreanDate(date: Date, locale: Locale): string {
    return formatterFor(locale).format(date);
}
