import 'server-only';
import { getLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales';

/**
 * 서버 액션·라우트 핸들러에서 요청 로케일을 얻는다.
 *
 * `getLocale()`은 next-intl 미들웨어가 심는 `X-NEXT-INTL-LOCALE` 헤더로
 * 폴백하지만, 헤더가 없는 경로(테스트·직접 호출)에서는 던진다. 여기서
 * 던지게 두면 메일 발송처럼 **로케일이 부수적인** 작업까지 통째로 실패하므로
 * 기본 로케일로 떨어뜨린다.
 */
export async function resolveRequestLocale(): Promise<Locale> {
    try {
        const value = await getLocale();
        return isLocale(value) ? value : DEFAULT_LOCALE;
    } catch {
        return DEFAULT_LOCALE;
    }
}
