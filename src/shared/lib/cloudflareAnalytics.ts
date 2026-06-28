/** Cloudflare Web Analytics 설정 */

// beacon token은 모든 방문자의 HTML에 노출되는 public 식별자이므로 하드코딩한다.
// (DB/API secret과 달리 비밀값이 아니다.) 값이 truthy일 때만 layout이 beacon을
// 렌더하므로, dev에서 빈 문자열로 바꾸면 로컬 트래픽 집계를 손쉽게 끌 수 있다.
//
// E2E_TEST=1 환경(e2e 빌드)에서는 빈 문자열을 반환한다. E2E 픽스처는
// localhost:4300 이외의 외부 호스트 요청을 금지하므로, beacon 요청
// (https://static.cloudflareinsights.com/beacon.min.js)이 발생하면
// 여러 스펙이 "Unstubbed external requests" 오류로 실패한다.
// 빈 문자열이면 layout의 `{CF_BEACON_TOKEN && <Script .../>}` 가드가
// beacon을 렌더하지 않으므로 요청 자체가 발생하지 않는다.
export const CF_BEACON_TOKEN =
    process.env.E2E_TEST === '1' ? '' : '24c85b35acb0491297ff6cfe470bdc99';
