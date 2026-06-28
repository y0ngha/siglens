/** Cloudflare Web Analytics 설정 */

// beacon token은 모든 방문자의 HTML에 노출되는 public 식별자이므로 하드코딩한다.
// (DB/API secret과 달리 비밀값이 아니다.) 값이 truthy일 때만 layout이 beacon을
// 렌더하므로, dev에서 빈 문자열로 바꾸면 로컬 트래픽 집계를 손쉽게 끌 수 있다.
export const CF_BEACON_TOKEN = '24c85b35acb0491297ff6cfe470bdc99';
