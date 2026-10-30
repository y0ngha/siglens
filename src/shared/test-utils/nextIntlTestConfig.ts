import { DEFAULT_LOCALE, isLocale, type Locale } from '@/shared/i18n/locales';
import { MESSAGE_CATALOGS } from './messageCatalogs';

/**
 * Vitest용 `next-intl/config` 대체 모듈.
 *
 * `next-intl/config`는 빌드 플러그인이 만드는 가상 모듈이라 vitest에는 없다.
 * 없으면 서버 컴포넌트의 `useTranslations`/`getTranslations`가
 * "Couldn't find next-intl config file"로 던져 페이지 테스트가 통째로 깨진다.
 * 프로덕션 설정(`src/shared/i18n/request.ts`)은 `headers()`를 읽으므로 그대로
 * 쓸 수 없다.
 *
 * ## 왜 인자를 존중해야 하는가
 *
 * 인자를 무시하고 **항상** ko를 돌려주면 로케일을 검증하는 서버 측 단언이 전부
 * 항등식이 된다 — `getTranslations({ locale: 'ja' })`가 한국어를 돌려주고,
 * `setRequestLocale('ja')` 뒤의 `getLocale()`이 `'ko'`가 된다.
 *
 * next-intl은 이 함수에 `{ locale?, requestLocale }`을 넘긴다. 둘 다 존중하고,
 * 아무것도 없을 때만 기본 로케일로 떨어진다.
 */
export default async function getTestRequestConfig(params?: {
    locale?: string;
    requestLocale?: Promise<string | undefined>;
}): Promise<{
    locale: Locale;
    messages: Record<string, unknown>;
    timeZone: string;
}> {
    // `requestLocale`은 next-intl이 `headers()`로 지연 해석하므로, 요청 스코프가
    // 없는 node 프로젝트 테스트에서 던진다. 명시 `locale`을 먼저 보고, 그게
    // 없을 때만 조심스럽게 시도한다.
    let requested = params?.locale;
    if (requested === undefined) {
        try {
            requested = await params?.requestLocale;
        } catch {
            requested = undefined;
        }
    }
    const locale =
        requested !== undefined && isLocale(requested)
            ? requested
            : DEFAULT_LOCALE;
    return {
        locale,
        messages: MESSAGE_CATALOGS[locale],
        timeZone: 'Asia/Seoul',
    };
}
