import { routeLayout } from '@/shared/i18n/routeLayout';

/**
 * 홈 전용 메시지 프로바이더.
 *
 * 라우트 그룹 `(home)`은 URL에 나타나지 않는다 — `/`는 그대로다. 그런데도 세그먼트를 두는 이유는
 * **페이로드**다. 홈에서만 쓰는 스킬 카탈로그(`shared.skillSummary`·`shared.skillName`)를 홈 버킷에
 * 실어, 크롬 프로바이더를 타고 `/login`·`/terms` 같은 가벼운 페이지까지 따라다니지 않게 한다.
 */
export default routeLayout('(home)');
