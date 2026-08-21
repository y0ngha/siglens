/**
 * 차트 라우트 h1 텍스트의 단일 소스.
 *
 * `page.tsx`의 SSR 크롤용 sr-only h1과 `SymbolPageClient`의 가시 h1은 반드시 동일해야
 * 한다 — 둘이 다르면 크롤러가 받는 h1 ≠ 사용자가 보는 h1, 즉 cloaking이 된다(SEO 위험).
 * 두 파일에 리터럴을 각각 두면 한쪽만 수정될 때 조용히 drift하므로 여기서 한 번만 만든다.
 */
/**
 * h1 메시지 키.
 *
 * **키만 내보내고 `t()` 호출은 소비 파일에서 한다.** 이 파일은 번역자를 인자로
 * 받을 뿐 스스로 선언하지 않는데, 추출기는 번역자 선언이 있는 파일에서만 키를
 * 수집한다(`keysForFiles`의 `translatorNamespace.size === 0` 조기 반환).
 * 여기서 `t('chartPageHeading.heading')`을 부르면 그 키가 **클라이언트
 * 페이로드에서 통째로 빠져**, 하이드레이션 후 가시 h1이 원시 키 문자열
 * `views.symbol.chartPageHeading.heading`으로 바뀐다 — 전 로케일에서, ko 포함.
 * `ko.json`에는 남아 있어 `i18n:verify`도 통과한다(실증).
 */
export const CHART_PAGE_HEADING_KEY = 'chartPageHeading.heading';
