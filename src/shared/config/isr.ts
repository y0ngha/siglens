/**
 * 사이트맵 보조 함수와 설정이 함께 쓰는 ISR revalidate 주기.
 *
 * 주의: 이 상수들을 Next.js 라우트 세그먼트 설정 값으로 쓰면 안 된다
 * (예: `export const revalidate = CRYPTO_CHART_ISR_PERIOD_HOURS * 3600`).
 * Next.js 정적 분석은 세그먼트 설정이 순수 숫자 리터럴이기를 요구한다 — 상수를
 * import하면 설정이 조용히 무시되고 라우트가 동적 렌더링으로 떨어진다.
 * (`src/app/CLAUDE.md`의 ISR 규약: 세그먼트 설정은 리터럴로 둔다 — 매직 넘버 추출
 * 규칙은 여기 적용되지 않는다.)
 *
 * 사이트맵 보조 함수, TTL 계산, 테스트 단언처럼 Next.js 정적 분석이 관여하지 않는 곳에서 쓴다.
 */

/**
 * 암호화폐 차트 페이지의 ISR 주기(시간 단위, `app/[symbol]/page.tsx`의
 * `revalidate = 21600`과 일치). 사이트맵 lastmod 양자화를 실제 페이지 재생성 주기에
 * 맞춰, 콘텐츠가 바뀔 수 있는 속도보다 Googlebot이 더 자주 재크롤하지 않게 한다.
 */
export const CRYPTO_CHART_ISR_PERIOD_HOURS = 6;
