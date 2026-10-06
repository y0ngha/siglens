import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { buildTitleSubject } from '@/shared/lib/seo';

/**
 * 차트 탭 서술 문장(`TechnicalFactsSummary`)의 주어.
 *
 * ko는 `애플(AAPL)`·`삼성전자(005930)`처럼 검색어와 같은 표기를 쓴다 — 첫 문장이
 * 네이버 스니펫이 되므로 티커 단독(`AAPL`)보다 이름이 들어간 쪽이 매칭에 유리하다.
 * 비-ko는 `composeSymbolTitle`과 같이 한글명을 쓰지 않고 티커만 남긴다.
 *
 * 서버(`[symbol]/page.tsx`의 Suspense fallback)와 클라이언트(`SymbolPageClient`)가
 * 같은 규칙으로 주어를 만들도록 한 곳에 둔다.
 */
export function symbolFactsSubject(
    ticker: string,
    koreanName: string | undefined,
    locale: Locale
): string {
    return locale === DEFAULT_LOCALE
        ? buildTitleSubject(ticker, koreanName)
        : buildTitleSubject(ticker);
}
