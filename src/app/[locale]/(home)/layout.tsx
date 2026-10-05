import { routeLayout } from '@/shared/i18n/routeLayout';

/**
 * 홈 전용 메시지 프로바이더.
 *
 * 라우트 그룹 `(home)`은 URL에 나타나지 않는다 — `/`는 그대로다. 그런데도
 * 세그먼트를 만든 이유는 **페이로드**다. 홈은 자기 레이아웃이 없어 크롬
 * 프로바이더를 썼고, 그래서 홈에서만 쓰는 스킬 카탈로그가 크롬에 실려
 * `/login`·`/terms` 같은 가벼운 페이지까지 따라다녔다.
 *
 * 실측: 스킬 설명 카탈로그(당시 `shared.skillDescription` 8.4KB) + `shared.skillName`(0.9KB)만으로
 * 크롬이 카탈로그의 23.8%였다. 홈을 자기 버킷으로 떼면 그만큼이 빠진다.
 * 설명 카탈로그는 지금 이름으로 찾는 한 줄 요약 `shared.skillSummary`로 바뀌어 같은 자리를 쓴다.
 */
export default routeLayout('(home)');
