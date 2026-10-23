import { routeLayout } from '@/shared/i18n/routeLayout';

// `/methodology`와 같은 이유로 라우트 레이아웃을 둔다 — 문항 탐색기(클라이언트)가 쓰는
// 메시지만 이 라우트 몫으로 싣는다. `route` 문자열은 `messages/_meta/clientKeys.json`의
// 키와 같아야 한다(`i18n:extract --write`가 디렉터리에서 만든다).
export default routeLayout('benchmark');
