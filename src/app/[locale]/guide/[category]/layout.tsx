import { routeLayout } from '@/shared/i18n/routeLayout';

// 하위 라우트(`[slug]`)를 가진 접두사 라우트라 자기 메시지 레이아웃을 둔다 —
// `clientNamespaces` 가드가 강제하는 규칙(`/guide` 레이아웃과 같은 이유).
export default routeLayout('guide/[category]');
