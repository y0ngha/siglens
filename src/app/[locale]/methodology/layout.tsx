import { routeLayout } from '@/shared/i18n/routeLayout';

// `/about`·`/terms`·`/privacy`와 같은 이유로 라우트 레이아웃을 둔다 — 페이지
// 서브트리의 클라이언트 컴포넌트(`LocaleLink`·`Breadcrumb` 아래 링크)가 쓰는
// 메시지만 이 라우트 몫으로 싣고, 없으면 크롬 전체 키로 떨어진다.
// `route` 문자열은 `messages/_meta/clientKeys.json`의 키(`i18n:extract --write`가
// 디렉터리에서 만든다)와 같아야 한다.
export default routeLayout('methodology');
