import { routeLayout } from '@/shared/i18n/routeLayout';

// `/methodology`·`/about`과 같은 이유로 라우트 레이아웃을 둔다 — 페이지 서브트리의
// 클라이언트 컴포넌트(`GuideBrowser`·`LocaleLink`)가 쓰는 메시지만 이 라우트 몫으로 싣는다.
// `route` 문자열은 `messages/_meta/clientKeys.json`의 키(`i18n:extract --write`가
// 디렉터리에서 만든다)와 같아야 한다.
export default routeLayout('guide');
